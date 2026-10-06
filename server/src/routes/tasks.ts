import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.ts'
import type { Prisma, Task, TaskStatus, User } from '../generated/prisma/client.ts'
import { authenticate } from '../lib/auth.ts'
import { assertNotBlocked } from '../lib/blocked.ts'
import { DATE_RE, daysBetween, TIME_RE, today, weekday } from '../lib/dates.ts'
import { badRequest, forbidden, notFound } from '../lib/errors.ts'
import { record } from '../lib/history.ts'
import { priorityLabel, statusLabel } from '../lib/labels.ts'
import { assertCan } from '../lib/permissions.ts'
import { broadcast } from '../lib/realtime.ts'
import { materialize } from '../lib/recurrence.ts'

const MAX_RANGE_DAYS = 62

export const taskInclude = {
  category: true,
  assignee: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  rule: { select: { id: true, pattern: true, active: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude

const time = z.string().regex(TIME_RE, 'Horário inválido. Use HH:MM.')
const date = z.string().regex(DATE_RE, 'Data inválida.')
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH'])
const status = z.enum(['PENDING', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'DONE'])

const taskFields = {
  title: z.string().trim().min(1, 'Informe o título.').max(120, 'Título muito longo.'),
  description: z.string().trim().max(2000),
  date,
  startTime: time,
  endTime: time.nullable(),
  priority,
  categoryId: z.string().nullable(),
}

const createBody = z.object({
  ...taskFields,
  description: taskFields.description.default(''),
  endTime: taskFields.endTime.optional().default(null),
  priority: priority.default('MEDIUM'),
  categoryId: taskFields.categoryId.optional().default(null),
  assigneeId: z.string(),
  recurrence: z
    .object({
      pattern: z.enum(['DAILY', 'WEEKDAYS', 'WEEKLY']),
      endDate: date.nullable().optional(),
    })
    .nullable()
    .optional(),
})

const updateBody = z.object(taskFields).partial()

const rangeQuery = z.object({ from: date, to: date, assigneeId: z.string().optional() })

function checkTimes(start?: string, end?: string | null) {
  if (start && end && end <= start) throw badRequest('O horário de término precisa ser depois do início.')
}

async function loadTask(id: string) {
  const task = await prisma.task.findFirst({ where: { id, deletedAt: null }, include: taskInclude })
  if (!task) throw notFound('Tarefa não encontrada.')
  return task
}

/** Quem pode ter tarefas criadas por quem: a gestora cria para o admin e, se liberado, para si. */
export async function assertCanAssign(me: User, assigneeId: string) {
  const assignee = await prisma.user.findUnique({ where: { id: assigneeId } })
  if (!assignee || !assignee.active) throw badRequest('Responsável inválido.')
  if (me.role === 'ADMIN') return
  if (assignee.id === me.id) return assertCan(me, 'tasks.createOwn')
  if (assignee.role !== 'ADMIN') throw forbidden()
}

const shiftTime = (hhmm: string, minutes: number) => {
  const total = Math.min(Math.max(Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + minutes, 0), 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

function elapsed(task: Pick<Task, 'startedAt'>, now: Date) {
  return task.startedAt ? Math.max(0, Math.floor((now.getTime() - task.startedAt.getTime()) / 1000)) : 0
}

/** Pausa o que estiver em andamento para a pessoa, somando o tempo corrido. Devolve os títulos pausados. */
export async function pauseRunning(tx: Prisma.TransactionClient, assigneeId: string, exceptId: string | null, now: Date) {
  const running = await tx.task.findMany({
    where: { assigneeId, status: 'IN_PROGRESS', deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
  })
  for (const r of running) {
    await tx.task.update({
      where: { id: r.id },
      data: { status: 'PAUSED', startedAt: null, trackedSeconds: r.trackedSeconds + elapsed(r, now) },
    })
  }
  return running.map((r) => r.title)
}

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/api/tasks', async (request) => {
    const { from, to, assigneeId } = rangeQuery.parse(request.query)
    if (to < from) throw badRequest('Intervalo inválido.')
    if (daysBetween(from, to).length > MAX_RANGE_DAYS) throw badRequest('Escolha um intervalo de até 2 meses.')
    await materialize(from, to)
    return prisma.task.findMany({
      where: { date: { gte: from, lte: to }, deletedAt: null, ...(assigneeId ? { assigneeId } : {}) },
      include: taskInclude,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    })
  })

  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (request) => loadTask(request.params.id))

  app.post('/api/tasks', async (request) => {
    const me = request.me
    const body = createBody.parse(request.body)
    checkTimes(body.startTime, body.endTime)
    await assertCanAssign(me, body.assigneeId)
    await assertNotBlocked(body.date)

    let ruleId: string | null = null
    if (body.recurrence) {
      await assertCan(me, 'tasks.recurring')
      if (body.recurrence.endDate && body.recurrence.endDate < body.date) throw badRequest('A recorrência precisa terminar depois da data inicial.')
      const rule = await prisma.recurringRule.create({
        data: {
          title: body.title,
          description: body.description,
          startTime: body.startTime,
          endTime: body.endTime,
          priority: body.priority,
          categoryId: body.categoryId,
          assigneeId: body.assigneeId,
          createdById: me.id,
          pattern: body.recurrence.pattern,
          weekday: body.recurrence.pattern === 'WEEKLY' ? weekday(body.date) : null,
          startDate: body.date,
          endDate: body.recurrence.endDate ?? null,
        },
      })
      ruleId = rule.id
    }

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        priority: body.priority,
        categoryId: body.categoryId,
        assigneeId: body.assigneeId,
        createdById: me.id,
        ruleId,
      },
      include: taskInclude,
    })

    const forWhom = task.assigneeId === me.id ? '' : ` para ${task.assignee.name}`
    await record({
      actorId: me.id,
      action: 'task.created',
      taskId: task.id,
      summary: `${me.name} adicionou a tarefa "${task.title}"${forWhom}`,
      detail: `${task.date.split('-').reverse().join('/')} às ${task.startTime}${ruleId ? ' · recorrente' : ''}`,
    })
    broadcast(['tasks'], me.id)
    return task
  })

  app.patch<{ Params: { id: string } }>('/api/tasks/:id', async (request) => {
    const me = request.me
    const body = updateBody.parse(request.body)
    const task = await loadTask(request.params.id)
    checkTimes(body.startTime ?? task.startTime, body.endTime === undefined ? task.endTime : body.endTime)
    if (body.date !== undefined && body.date !== task.date) await assertNotBlocked(body.date)

    const changes: { field: string; line: string }[] = []
    if (body.title !== undefined && body.title !== task.title) changes.push({ field: 'o título', line: `Título: ${task.title} → ${body.title}` })
    if (body.description !== undefined && body.description !== task.description) changes.push({ field: 'a descrição', line: 'Descrição atualizada' })
    if (body.date !== undefined && body.date !== task.date) {
      const fmt = (d: string) => d.split('-').reverse().join('/')
      changes.push({ field: 'a data', line: `Data: ${fmt(task.date)} → ${fmt(body.date)}` })
    }
    const newStart = body.startTime ?? task.startTime
    const newEnd = body.endTime === undefined ? task.endTime : body.endTime
    if (newStart !== task.startTime || newEnd !== task.endTime) {
      const fmt = (s: string, e: string | null) => (e ? `${s}–${e}` : s)
      changes.push({ field: 'o horário', line: `Horário: ${fmt(task.startTime, task.endTime)} → ${fmt(newStart, newEnd)}` })
    }
    if (body.priority !== undefined && body.priority !== task.priority) {
      changes.push({ field: 'a prioridade', line: `Prioridade: ${priorityLabel[task.priority]} → ${priorityLabel[body.priority]}` })
    }
    if (body.categoryId !== undefined && body.categoryId !== task.categoryId) {
      await assertCan(me, 'tasks.changeCategory')
      const next = body.categoryId ? await prisma.category.findUnique({ where: { id: body.categoryId } }) : null
      changes.push({ field: 'a categoria', line: `Categoria: ${task.category?.name ?? 'Sem categoria'} → ${next?.name ?? 'Sem categoria'}` })
    }
    if (!changes.length) return task

    const updated = await prisma.task.update({ where: { id: task.id }, data: body, include: taskInclude })
    await record({
      actorId: me.id,
      action: 'task.updated',
      taskId: task.id,
      summary:
        changes.length === 1
          ? `${me.name} alterou ${changes[0].field} de "${updated.title}"`
          : `${me.name} editou "${updated.title}"`,
      detail: changes.map((c) => c.line).join('\n'),
    })
    broadcast(['tasks'], me.id)
    return updated
  })

  // Status com cronômetro: só uma tarefa por pessoa fica "em andamento" de cada vez.
  app.post<{ Params: { id: string } }>('/api/tasks/:id/status', async (request) => {
    const me = request.me
    const next = z.object({ status }).parse(request.body).status as TaskStatus
    const task = await loadTask(request.params.id)
    if (task.status === next) return task
    const now = new Date()

    const paused = await prisma.$transaction(async (tx) => {
      const pausedTitles = next === 'IN_PROGRESS' ? await pauseRunning(tx, task.assigneeId, task.id, now) : []
      await tx.task.update({
        where: { id: task.id },
        data: {
          status: next,
          trackedSeconds: task.trackedSeconds + elapsed(task, now),
          startedAt: next === 'IN_PROGRESS' ? now : null,
          completedAt: next === 'DONE' ? now : null,
        },
      })
      return pausedTitles
    })

    await record({
      actorId: me.id,
      action: 'task.status',
      taskId: task.id,
      summary:
        next === 'DONE'
          ? `${me.name} marcou "${task.title}" como concluída`
          : `${me.name} alterou o status de "${task.title}": ${statusLabel[task.status]} → ${statusLabel[next]}`,
      detail: paused.length ? `Pausada automaticamente: ${paused.join(', ')}` : '',
    })
    broadcast(['tasks'], me.id)
    return loadTask(task.id)
  })

  // Reordenar: troca o horário com a tarefa vizinha do mesmo dia, mantendo a duração de cada uma.
  app.post<{ Params: { id: string } }>('/api/tasks/:id/move', async (request) => {
    const me = request.me
    const { direction } = z.object({ direction: z.enum(['up', 'down']) }).parse(request.body)
    const task = await loadTask(request.params.id)
    const day = await prisma.task.findMany({
      where: { assigneeId: task.assigneeId, date: task.date, deletedAt: null },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
    })
    const index = day.findIndex((t) => t.id === task.id)
    const other = day[direction === 'up' ? index - 1 : index + 1]
    if (!other) return task

    const duration = (t: Task) => (t.endTime ? minutesOf(t.endTime) - minutesOf(t.startTime) : null)
    const moves = [
      { t: task as Task, start: other.startTime },
      { t: other, start: task.startTime },
    ]
    await prisma.$transaction(
      moves.map(({ t, start }) => {
        const d = duration(t)
        return prisma.task.update({
          where: { id: t.id },
          data: { startTime: start, endTime: d === null ? null : shiftTime(start, d) },
        })
      }),
    )
    await record({
      actorId: me.id,
      action: 'task.moved',
      taskId: task.id,
      summary: `${me.name} reorganizou a rotina: "${task.title}" foi para ${direction === 'up' ? 'antes de' : 'depois de'} "${other.title}"`,
    })
    broadcast(['tasks'], me.id)
    return { ok: true }
  })

  app.delete<{ Params: { id: string } }>('/api/tasks/:id', async (request) => {
    const me = request.me
    await assertCan(me, 'tasks.delete')
    const task = await loadTask(request.params.id)
    await prisma.task.update({ where: { id: task.id }, data: { deletedAt: new Date(), startedAt: null } })
    await record({ actorId: me.id, action: 'task.deleted', taskId: task.id, summary: `${me.name} excluiu a tarefa "${task.title}"` })
    broadcast(['tasks'], me.id)
    return { ok: true }
  })

  // Encerra uma recorrência: mantém o que já passou e remove as próximas ocorrências pendentes.
  app.post<{ Params: { id: string } }>('/api/rules/:id/stop', async (request) => {
    const me = request.me
    await assertCan(me, 'tasks.recurring')
    const rule = await prisma.recurringRule.findUnique({ where: { id: request.params.id } })
    if (!rule) throw notFound()
    const last = today()
    await prisma.$transaction([
      prisma.recurringRule.update({ where: { id: rule.id }, data: { active: false, endDate: last } }),
      prisma.task.updateMany({
        where: { ruleId: rule.id, date: { gt: last }, status: 'PENDING', deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ])
    await record({ actorId: me.id, action: 'rule.stopped', summary: `${me.name} encerrou a recorrência de "${rule.title}"` })
    broadcast(['tasks'], me.id)
    return { ok: true }
  })
}
