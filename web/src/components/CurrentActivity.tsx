import { formatTimer, liveSeconds, statusMeta } from '../lib/format'
import { useNow, useTaskActions } from '../lib/queries'
import type { Task, TaskStatus } from '../types'
import { Button, Card, Icon } from './ui'

/** A tarefa rodando; senão a pausada; senão a próxima pendente. */
export function pickCurrent(tasks: Task[]): Task | undefined {
  return (
    tasks.find((t) => t.status === 'IN_PROGRESS') ??
    tasks.find((t) => t.status === 'PAUSED') ??
    tasks.find((t) => t.status === 'PENDING') ??
    tasks.find((t) => t.status === 'BLOCKED')
  )
}

export function CurrentActivity({ task, onEdit }: { task: Task | undefined; onEdit: (t: Task) => void }) {
  const now = useNow(1000)
  const { setStatus } = useTaskActions()

  if (!task) {
    return (
      <Card title="Atividade atual">
        <p className="px-4 py-6 text-sm text-muted">Nada pendente por aqui.</p>
      </Card>
    )
  }

  const go = (status: TaskStatus) => setStatus.mutate({ id: task.id, status })
  const running = task.status === 'IN_PROGRESS'

  return (
    <Card title="Atividade atual">
      <div className="flex flex-col gap-4 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted tabular">
            {task.startTime}
            {task.endTime && ` – ${task.endTime}`}
            {task.category && ` · ${task.category.name}`}
          </p>
          <p className="mt-1 text-[15px] font-semibold">{task.title}</p>
          <p className={`mt-1 text-[13px] ${statusMeta[task.status].text}`}>{statusMeta[task.status].label}</p>
        </div>

        <p className="text-3xl font-light tracking-tight tabular" aria-live="off">
          {formatTimer(liveSeconds(task, now))}
        </p>

        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button onClick={() => go('PAUSED')} disabled={setStatus.isPending}>
              <Icon name="pause" className="size-3.5" />
              Pausar
            </Button>
          ) : (
            <Button variant="primary" onClick={() => go('IN_PROGRESS')} disabled={setStatus.isPending}>
              <Icon name="play" className="size-3.5" />
              {task.status === 'PENDING' ? 'Iniciar' : 'Retomar'}
            </Button>
          )}
          <Button onClick={() => go('DONE')} disabled={setStatus.isPending}>
            <Icon name="check" className="size-3.5" />
            Concluir
          </Button>
          {task.status !== 'BLOCKED' && (
            <Button variant="ghost" onClick={() => go('BLOCKED')} disabled={setStatus.isPending}>
              <Icon name="block" className="size-3.5" />
              Bloquear
            </Button>
          )}
          <Button variant="ghost" onClick={() => onEdit(task)}>
            <Icon name="edit" className="size-3.5" />
            Editar
          </Button>
        </div>
      </div>
    </Card>
  )
}
