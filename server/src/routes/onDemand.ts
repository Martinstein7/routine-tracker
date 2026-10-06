import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.ts'
import { authenticate } from '../lib/auth.ts'
import { nowTime, today } from '../lib/dates.ts'
import { notFound } from '../lib/errors.ts'
import { record } from '../lib/history.ts'
import { assertCan } from '../lib/permissions.ts'
import { broadcast } from '../lib/realtime.ts'
import { assertCanAssign, pauseRunning, taskInclude } from './tasks.ts'

const fields = {
  title: z.string().trim().min(1, 'Informe o nome da atividade.').max(120, 'Nome muito longo.'),
  description: z.string().trim().max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  categoryId: z.string().nullable(),
}

const createBody = z.object({
  ...fields,
  description: fields.description.default(''),
  priority: fields.priority.default('MEDIUM'),
  categoryId: fields.categoryId.optional().default(null),
  assigneeId: z.string(),
})

const updateBody = z.object(fields).partial()

const include = { category: true } as const

async function loadActivity(id: string) {
  const activity = await prisma.onDemandActivity.findFirst({ where: { id, active: true }, include })
  if (!activity) throw notFound('Atividade sob demanda não encontrada.')
  return activity
}

export async function onDemandRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // Lista com quantas vezes cada uma já aconteceu hoje e a hora da última vez.
  app.get('/api/on-demand', async (request) => {
    const { assigneeId } = z.object({ assigneeId: z.string().optional() }).parse(request.query)
    const activities = await prisma.onDemandActivity.findMany({
      where: { active: true, ...(assigneeId ? { assigneeId } : {}) },
      include,
      orderBy: [{ title: 'asc' }],
    })
    const occurrences = await prisma.task.findMany({
      where: { onDemandId: { in: activities.map((a) => a.id) }, date: today(), deletedAt: null },
      select: { onDemandId: true, startTime: true },
      orderBy: { startTime: 'asc' },
    })
    return activities.map((a) => {
      const mine = occurrences.filter((o) => o.onDemandId === a.id)
      return { ...a, todayCount: mine.length, lastTime: mine.at(-1)?.startTime ?? null }
    })
  })

  app.post('/api/on-demand', async (request) => {
    const me = request.me
    const body = createBody.parse(request.body)
    await assertCanAssign(me, body.assigneeId)
    const activity = await prisma.onDemandActivity.create({ data: { ...body, createdById: me.id }, include })
    await record({ actorId: me.id, action: 'ondemand.created', summary: `${me.name} adicionou a atividade sob demanda "${activity.title}"` })
    broadcast(['onDemand'], me.id)
    return activity
  })

  app.patch<{ Params: { id: string } }>('/api/on-demand/:id', async (request) => {
    const me = request.me
    const body = updateBody.parse(request.body)
    const activity = await loadActivity(request.params.id)
    await assertCanAssign(me, activity.assigneeId)
    if (body.categoryId !== undefined && body.categoryId !== activity.categoryId) await assertCan(me, 'tasks.changeCategory')
    const updated = await prisma.onDemandActivity.update({ where: { id: activity.id }, data: body, include })
    await record({ actorId: me.id, action: 'ondemand.updated', summary: `${me.name} editou a atividade sob demanda "${updated.title}"` })
    broadcast(['onDemand'], me.id)
    return updated
  })

  // Remover só tira da lista: as ocorrências já registradas continuam na rotina e nos relatórios.
  app.delete<{ Params: { id: string } }>('/api/on-demand/:id', async (request) => {
    const me = request.me
    await assertCan(me, 'tasks.delete')
    const activity = await loadActivity(request.params.id)
    await prisma.onDemandActivity.update({ where: { id: activity.id }, data: { active: false } })
    await record({ actorId: me.id, action: 'ondemand.removed', summary: `${me.name} removeu a atividade sob demanda "${activity.title}"` })
    broadcast(['onDemand'], me.id)
    return { ok: true }
  })

  // Registra uma ocorrência agora: vira uma tarefa de hoje, no horário atual,
  // já em andamento (com cronômetro) ou já concluída.
  app.post<{ Params: { id: string } }>('/api/on-demand/:id/log', async (request) => {
    const me = request.me
    const { mode } = z.object({ mode: z.enum(['start', 'done']) }).parse(request.body)
    const activity = await loadActivity(request.params.id)
    await assertCanAssign(me, activity.assigneeId)
    const now = new Date()

    const { task, paused } = await prisma.$transaction(async (tx) => {
      const paused = mode === 'start' ? await pauseRunning(tx, activity.assigneeId, null, now) : []
      const task = await tx.task.create({
        data: {
          title: activity.title,
          description: activity.description,
          date: today(),
          startTime: nowTime(),
          priority: activity.priority,
          categoryId: activity.categoryId,
          assigneeId: activity.assigneeId,
          createdById: me.id,
          onDemandId: activity.id,
          status: mode === 'start' ? 'IN_PROGRESS' : 'DONE',
          startedAt: mode === 'start' ? now : null,
          completedAt: mode === 'done' ? now : null,
        },
        include: taskInclude,
      })
      return { task, paused }
    })

    await record({
      actorId: me.id,
      action: 'ondemand.logged',
      taskId: task.id,
      summary:
        mode === 'start'
          ? `${me.name} iniciou "${task.title}" (sob demanda) às ${task.startTime}`
          : `${me.name} registrou "${task.title}" (sob demanda) como feita às ${task.startTime}`,
      detail: paused.length ? `Pausada automaticamente: ${paused.join(', ')}` : '',
    })
    broadcast(['tasks', 'onDemand'], me.id)
    return task
  })
}
