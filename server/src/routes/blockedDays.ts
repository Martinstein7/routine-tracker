import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.ts'
import { authenticate } from '../lib/auth.ts'
import { blockRuleOccurs, isWeekend, WEEKEND_KEY, weekendsBlocked } from '../lib/blocked.ts'
import { DATE_RE, daysBetween, today } from '../lib/dates.ts'
import { badRequest, notFound } from '../lib/errors.ts'
import { record } from '../lib/history.ts'
import { assertCan } from '../lib/permissions.ts'
import { broadcast } from '../lib/realtime.ts'

const date = z.string().regex(DATE_RE, 'Data inválida.')
const repeat = z.enum(['NONE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY']).default('NONE')
// Com repetição, "to" é até quando repetir (vazio = sem fim); sem repetição, é o fim do período.
const range = z.object({ from: date, to: date.optional(), repeat })
const blockBody = z.object({
  from: date,
  to: date.optional(),
  repeat,
  reason: z.string().trim().min(1, 'Informe o motivo.').max(60, 'Motivo muito longo.'),
  removeTasks: z.boolean().default(false),
})

type Repeat = z.infer<typeof repeat>
const repeatLabel: Record<Exclude<Repeat, 'NONE'>, string> = {
  WEEKLY: 'toda semana',
  BIWEEKLY: 'a cada 2 semanas',
  MONTHLY: 'todo mês',
  YEARLY: 'todo ano',
}

const fmt = (d: string) => d.split('-').reverse().join('/')
const fmtRange = (dates: string[]) => (dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])} a ${fmt(dates.at(-1)!)}`)

function datesOf(from: string, to = from) {
  if (to < from) throw badRequest('A data final precisa ser depois da inicial.')
  const dates = daysBetween(from, to)
  if (dates.length > 366) throw badRequest('Escolha um período de até um ano.')
  return dates
}

/**
 * Datas já existentes em que um bloqueio cai, para tirar/contar tarefas.
 * Com repetição sem fim, olha só as tarefas que já existem (as recorrentes futuras nem chegam a ser criadas).
 */
async function affectedDates(from: string, to: string | undefined, rep: Repeat) {
  if (rep === 'NONE') return datesOf(from, to)
  if (to && to < from) throw badRequest('A data final da repetição precisa ser depois do início.')
  const rule = { pattern: rep, startDate: from, endDate: to ?? null }
  const existing = await prisma.task.findMany({
    where: { date: { gte: from, ...(to ? { lte: to } : {}) }, deletedAt: null },
    select: { date: true },
    distinct: ['date'],
  })
  return existing.map((t) => t.date).filter((d) => blockRuleOccurs(rule, d))
}

// Tarefas que um bloqueio afeta: as que ainda não começaram (as em andamento e concluídas ficam).
const openStatus = { in: ['PENDING', 'PAUSED', 'BLOCKED'] as ('PENDING' | 'PAUSED' | 'BLOCKED')[] }

export async function blockedDayRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // As duas pessoas veem os bloqueios (calendário, tela Hoje); só o admin altera.
  app.get('/api/blocked-days', async () => {
    const [weekends, days, rules] = await Promise.all([
      weekendsBlocked(),
      prisma.blockedDay.findMany({ orderBy: { date: 'asc' }, include: { createdBy: { select: { name: true } } } }),
      prisma.blockRule.findMany({ orderBy: { startDate: 'asc' } }),
    ])
    return {
      weekends,
      days: days.map((d) => ({ date: d.date, reason: d.reason, createdBy: d.createdBy.name })),
      rules: rules.map((r) => ({ id: r.id, reason: r.reason, pattern: r.pattern, startDate: r.startDate, endDate: r.endDate })),
    }
  })

  // Quantas tarefas em aberto já existem nas datas afetadas, para avisar antes de bloquear.
  app.get('/api/blocked-days/impact', async (request) => {
    await assertCan(request.me, 'admin')
    const { from, to, repeat: rep } = range.parse(request.query)
    const dates = await affectedDates(from, to, rep)
    const tasks = await prisma.task.findMany({
      where: { date: { in: dates }, deletedAt: null, status: openStatus },
      select: { ruleId: true },
    })
    return { manual: tasks.filter((t) => !t.ruleId).length, recurring: tasks.filter((t) => t.ruleId).length }
  })

  app.post('/api/blocked-days', async (request) => {
    const me = request.me
    await assertCan(me, 'admin')
    const body = blockBody.parse(request.body)
    const repeating = body.repeat !== 'NONE'
    const dates = repeating ? await affectedDates(body.from, body.to, body.repeat) : datesOf(body.from, body.to)

    const removed = await prisma.$transaction(async (tx) => {
      if (body.repeat !== 'NONE') {
        await tx.blockRule.create({
          data: { reason: body.reason, pattern: body.repeat, startDate: body.from, endDate: body.to ?? null, createdById: me.id },
        })
      } else {
        for (const d of dates) {
          await tx.blockedDay.upsert({
            where: { date: d },
            update: { reason: body.reason },
            create: { date: d, reason: body.reason, createdById: me.id },
          })
        }
      }
      // Ocorrências recorrentes saem de vez: se o dia for desbloqueado, elas são recriadas.
      const recurring = await tx.task.deleteMany({ where: { date: { in: dates }, ruleId: { not: null }, status: 'PENDING' } })
      const manual = body.removeTasks
        ? await tx.task.updateMany({
            where: { date: { in: dates }, deletedAt: null, status: openStatus },
            data: { deletedAt: new Date(), startedAt: null },
          })
        : { count: 0 }
      return recurring.count + manual.count
    })

    const summary =
      body.repeat !== 'NONE'
        ? `${me.name} bloqueou ${repeatLabel[body.repeat]} a partir de ${fmt(body.from)}${body.to ? ` até ${fmt(body.to)}` : ''}: ${body.reason}`
        : `${me.name} bloqueou ${dates.length === 1 ? 'o dia' : 'os dias'} ${fmtRange(dates)}: ${body.reason}`
    await record({
      actorId: me.id,
      action: 'day.blocked',
      summary,
      detail: removed ? `${removed} tarefa${removed === 1 ? '' : 's'} em aberto removida${removed === 1 ? '' : 's'}` : '',
    })
    broadcast(['blocked', 'tasks'], me.id)
    return { blocked: repeating ? null : dates.length, repeating, removedTasks: removed }
  })

  app.delete<{ Params: { id: string } }>('/api/blocked-days/rules/:id', async (request) => {
    const me = request.me
    await assertCan(me, 'admin')
    const rule = await prisma.blockRule.findUnique({ where: { id: request.params.id } })
    if (!rule) throw notFound('Esta repetição não existe mais.')
    await prisma.blockRule.delete({ where: { id: rule.id } })
    await record({ actorId: me.id, action: 'day.unblocked', summary: `${me.name} removeu o bloqueio que se repetia ${repeatLabel[rule.pattern]} (${rule.reason})` })
    broadcast(['blocked', 'tasks'], me.id)
    return { ok: true }
  })

  app.delete<{ Params: { date: string } }>('/api/blocked-days/:date', async (request) => {
    const me = request.me
    await assertCan(me, 'admin')
    const day = await prisma.blockedDay.findUnique({ where: { date: request.params.date } })
    if (!day) throw notFound('Este dia não está bloqueado.')
    await prisma.blockedDay.delete({ where: { date: day.date } })
    await record({ actorId: me.id, action: 'day.unblocked', summary: `${me.name} desbloqueou o dia ${fmt(day.date)} (${day.reason})` })
    broadcast(['blocked', 'tasks'], me.id)
    return { ok: true }
  })

  app.put('/api/blocked-days/weekends', async (request) => {
    const me = request.me
    await assertCan(me, 'admin')
    const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body)
    await prisma.setting.upsert({ where: { key: WEEKEND_KEY }, update: { value: enabled }, create: { key: WEEKEND_KEY, value: enabled } })

    // Ao ligar, tira as recorrentes já geradas para os próximos fins de semana (as diárias, por exemplo).
    if (enabled) {
      const future = await prisma.task.findMany({
        where: { date: { gte: today() }, ruleId: { not: null }, status: 'PENDING' },
        select: { id: true, date: true },
      })
      const ids = future.filter((t) => isWeekend(t.date)).map((t) => t.id)
      if (ids.length) await prisma.task.deleteMany({ where: { id: { in: ids } } })
    }

    await record({
      actorId: me.id,
      action: enabled ? 'weekends.blocked' : 'weekends.unblocked',
      summary: enabled ? `${me.name} bloqueou os fins de semana para rotina` : `${me.name} liberou os fins de semana para rotina`,
    })
    broadcast(['blocked', 'tasks'], me.id)
    return { weekends: enabled }
  })
}
