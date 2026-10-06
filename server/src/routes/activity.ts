import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.ts'
import { authenticate } from '../lib/auth.ts'
import { DATE_RE, nowTime, TIME_RE, today } from '../lib/dates.ts'
import { badRequest, notFound } from '../lib/errors.ts'
import { record } from '../lib/history.ts'
import { assertCan } from '../lib/permissions.ts'
import { broadcast } from '../lib/realtime.ts'

const date = z.string().regex(DATE_RE, 'Data inválida.')
const author = { select: { id: true, name: true, role: true } }

const incidentBody = z.object({
  title: z.string().trim().min(1, 'Informe o que aconteceu.').max(120),
  description: z.string().trim().max(2000).default(''),
  date,
  startTime: z.string().regex(TIME_RE, 'Horário inválido. Use HH:MM.'),
  durationMinutes: z.coerce.number().int().min(1, 'Informe a duração.').max(24 * 60),
  taskId: z.string().nullable().optional(),
})

const historyQuery = z.object({
  from: date.optional(),
  to: date.optional(),
  actorId: z.string().optional(),
  taskId: z.string().optional(),
  before: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
})

const clearQuery = z.object({
  from: date.optional(),
  to: date.optional(),
  actorId: z.string().optional(),
})

const historyPatch = z.object({
  summary: z.string().trim().min(1, 'O texto não pode ficar vazio.').max(300),
  detail: z.string().trim().max(2000).default(''),
})

// Fim do dia local em UTC, para filtrar o histórico por data.
const dayStart = (d: string) => new Date(`${d}T00:00:00`)
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`)

export async function activityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // Comentários
  app.get<{ Params: { id: string } }>('/api/tasks/:id/comments', async (request) => {
    return prisma.comment.findMany({
      where: { taskId: request.params.id },
      include: { author },
      orderBy: { createdAt: 'asc' },
    })
  })

  app.post<{ Params: { id: string } }>('/api/tasks/:id/comments', async (request) => {
    const me = request.me
    const { body } = z.object({ body: z.string().trim().min(1, 'Escreva um comentário.').max(2000) }).parse(request.body)
    const task = await prisma.task.findFirst({ where: { id: request.params.id, deletedAt: null } })
    if (!task) throw notFound('Tarefa não encontrada.')
    const comment = await prisma.comment.create({ data: { taskId: task.id, authorId: me.id, body }, include: { author } })
    await record({
      actorId: me.id,
      action: 'comment.created',
      taskId: task.id,
      summary: `${me.name} comentou em "${task.title}"`,
      detail: body,
    })
    broadcast(['comments', 'tasks'], me.id)
    return comment
  })

  app.delete<{ Params: { id: string } }>('/api/comments/:id', async (request) => {
    const me = request.me
    const comment = await prisma.comment.findUnique({ where: { id: request.params.id } })
    if (!comment) throw notFound()
    if (comment.authorId !== me.id) await assertCan(me, 'admin')
    await prisma.comment.delete({ where: { id: comment.id } })
    broadcast(['comments', 'tasks'], me.id)
    return { ok: true }
  })

  // Imprevistos
  app.get('/api/incidents', async (request) => {
    const { from, to } = z.object({ from: date, to: date }).parse(request.query)
    return prisma.incident.findMany({
      where: { date: { gte: from, lte: to } },
      include: { author, task: { select: { id: true, title: true } } },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    })
  })

  app.post('/api/incidents', async (request) => {
    const me = request.me
    await assertCan(me, 'incidents.create')
    const body = incidentBody.parse(request.body)
    if (body.date > today() || (body.date === today() && body.startTime > nowTime())) {
      throw badRequest('Um imprevisto só pode ser registrado no passado ou agora.')
    }
    const incident = await prisma.incident.create({
      data: { ...body, taskId: body.taskId ?? null, authorId: me.id },
      include: { author, task: { select: { id: true, title: true } } },
    })
    const interrupted = incident.task ? ` · interrompeu "${incident.task.title}"` : ''
    await record({
      actorId: me.id,
      action: 'incident.created',
      taskId: incident.taskId,
      summary: `${me.name} registrou um imprevisto: ${incident.title}`,
      detail: [incident.description, `Duração: ${incident.durationMinutes} min${interrupted}`].filter(Boolean).join('\n'),
    })
    broadcast(['incidents'], me.id)
    return incident
  })

  app.delete<{ Params: { id: string } }>('/api/incidents/:id', async (request) => {
    await assertCan(request.me, 'admin')
    await prisma.incident.delete({ where: { id: request.params.id } })
    broadcast(['incidents'], request.me.id)
    return { ok: true }
  })

  // Histórico: as duas pessoas veem; só o admin edita ou apaga.
  app.get('/api/history', async (request) => {
    const q = historyQuery.parse(request.query)
    const createdAt: { gte?: Date; lte?: Date; lt?: Date } = {}
    if (q.from) createdAt.gte = dayStart(q.from)
    if (q.to) createdAt.lte = dayEnd(q.to)
    if (q.before) createdAt.lt = new Date(q.before)
    const events = await prisma.historyEvent.findMany({
      where: {
        createdAt,
        ...(q.actorId ? { actorId: q.actorId } : {}),
        ...(q.taskId ? { taskId: q.taskId } : {}),
      },
      include: { actor: author },
      orderBy: { createdAt: 'desc' },
      take: q.take + 1,
    })
    const hasMore = events.length > q.take
    return { events: events.slice(0, q.take), hasMore }
  })

  app.patch<{ Params: { id: string } }>('/api/history/:id', async (request) => {
    await assertCan(request.me, 'admin')
    const body = historyPatch.parse(request.body)
    const event = await prisma.historyEvent.update({
      where: { id: request.params.id },
      data: { ...body, editedAt: new Date() },
    })
    broadcast(['history'], request.me.id)
    return event
  })

  app.delete<{ Params: { id: string } }>('/api/history/:id', async (request) => {
    await assertCan(request.me, 'admin')
    await prisma.historyEvent.delete({ where: { id: request.params.id } })
    broadcast(['history'], request.me.id)
    return { ok: true }
  })

  // Limpeza em massa: sem filtros, apaga tudo; com período e/ou pessoa, só o que bate.
  const clearWhere = (q: z.infer<typeof clearQuery>) => {
    const createdAt: { gte?: Date; lte?: Date } = {}
    if (q.from) createdAt.gte = dayStart(q.from)
    if (q.to) createdAt.lte = dayEnd(q.to)
    return { createdAt, ...(q.actorId ? { actorId: q.actorId } : {}) }
  }

  app.get('/api/history/count', async (request) => {
    await assertCan(request.me, 'admin')
    return { count: await prisma.historyEvent.count({ where: clearWhere(clearQuery.parse(request.query)) }) }
  })

  app.post('/api/history/clear', async (request) => {
    const me = request.me
    await assertCan(me, 'admin')
    const q = clearQuery.parse(request.body)
    const { count } = await prisma.historyEvent.deleteMany({ where: clearWhere(q) })
    // Fica uma linha dizendo que houve limpeza, já que a gestora também acompanha o histórico.
    if (count > 0) {
      const fmt = (d: string) => d.split('-').reverse().join('/')
      const scope = q.from || q.to ? ` de ${q.from ? fmt(q.from) : 'início'} a ${q.to ? fmt(q.to) : 'hoje'}` : ''
      await record({ actorId: me.id, action: 'history.cleared', summary: `${me.name} limpou o histórico${scope}`, detail: `${count} registro${count === 1 ? '' : 's'} apagado${count === 1 ? '' : 's'}` })
    }
    broadcast(['history'], me.id)
    return { deleted: count }
  })
}
