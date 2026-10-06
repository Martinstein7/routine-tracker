import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.ts'
import type { Task } from '../generated/prisma/client.ts'
import { authenticate } from '../lib/auth.ts'
import { DATE_RE, daysBetween, nowTime, today } from '../lib/dates.ts'
import { badRequest } from '../lib/errors.ts'
import { materialize } from '../lib/recurrence.ts'

const query = z.object({
  from: z.string().regex(DATE_RE),
  to: z.string().regex(DATE_RE),
  assigneeId: z.string().optional(),
})

/** Atrasada: não concluída, não está rodando e o horário já passou. */
export function isOverdue(t: Pick<Task, 'status' | 'date' | 'startTime' | 'endTime'>, day = today(), now = nowTime()) {
  if (t.status === 'DONE' || t.status === 'IN_PROGRESS') return false
  if (t.date < day) return true
  return t.date === day && (t.endTime ?? t.startTime) < now
}

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/api/reports', async (request) => {
    const { from, to, assigneeId } = query.parse(request.query)
    if (to < from) throw badRequest('Intervalo inválido.')
    const days = daysBetween(from, to)
    if (days.length > 370) throw badRequest('Escolha um intervalo de até um ano.')
    if (days.length <= 62) await materialize(from, to)

    const [tasks, incidents, categories] = await Promise.all([
      prisma.task.findMany({
        where: { date: { gte: from, lte: to }, deletedAt: null, ...(assigneeId ? { assigneeId } : {}) },
      }),
      prisma.incident.findMany({ where: { date: { gte: from, lte: to } } }),
      prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    ])

    const now = new Date()
    const tracked = (t: Task) =>
      t.trackedSeconds + (t.startedAt ? Math.max(0, Math.floor((now.getTime() - t.startedAt.getTime()) / 1000)) : 0)

    const byStatus = { PENDING: 0, IN_PROGRESS: 0, PAUSED: 0, BLOCKED: 0, DONE: 0 }
    const byPriority = { LOW: 0, MEDIUM: 0, HIGH: 0 }
    let overdue = 0
    let trackedSeconds = 0
    for (const t of tasks) {
      byStatus[t.status]++
      byPriority[t.priority]++
      if (isOverdue(t)) overdue++
      trackedSeconds += tracked(t)
    }

    const byCategory = [...categories, { id: null, name: 'Sem categoria', color: '#a3a3a3' }]
      .map((c) => {
        const list = tasks.filter((t) => t.categoryId === c.id)
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          total: list.length,
          done: list.filter((t) => t.status === 'DONE').length,
          trackedSeconds: list.reduce((sum, t) => sum + tracked(t), 0),
        }
      })
      .filter((c) => c.total > 0)

    const byDay = days.map((d) => {
      const list = tasks.filter((t) => t.date === d)
      return { date: d, total: list.length, done: list.filter((t) => t.status === 'DONE').length }
    })

    return {
      from,
      to,
      total: tasks.length,
      done: byStatus.DONE,
      completionRate: tasks.length ? byStatus.DONE / tasks.length : 0,
      overdue,
      trackedSeconds,
      byStatus,
      byPriority,
      byCategory,
      byDay,
      incidents: {
        count: incidents.length,
        minutes: incidents.reduce((sum, i) => sum + i.durationMinutes, 0),
      },
    }
  })
}
