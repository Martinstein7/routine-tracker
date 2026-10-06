import type { Priority, TaskStatus } from '../generated/prisma/client.ts'

export const statusLabel: Record<TaskStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  PAUSED: 'Pausada',
  BLOCKED: 'Bloqueada',
  DONE: 'Concluída',
}

export const priorityLabel: Record<Priority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
}
