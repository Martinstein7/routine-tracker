import { prisma } from '../db.ts'
import { broadcast } from './realtime.ts'

type Entry = {
  actorId: string
  action: string
  summary: string
  detail?: string
  taskId?: string | null
}

export async function record(entry: Entry) {
  await prisma.historyEvent.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      summary: entry.summary,
      detail: entry.detail ?? '',
      taskId: entry.taskId ?? null,
    },
  })
  broadcast(['history'], entry.actorId)
}
