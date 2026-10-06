import { useState } from 'react'
import { isOverdue, priorityMeta, statusMeta, statusOrder } from '../lib/format'
import { useTaskActions } from '../lib/queries'
import type { Task, TaskStatus } from '../types'
import { cx, Icon } from './ui'

type Props = {
  task: Task
  selected?: boolean
  first?: boolean
  last?: boolean
  onSelect?: () => void
  onEdit: () => void
}

export function StatusSelect({ task }: { task: Task }) {
  const { setStatus } = useTaskActions()
  const meta = statusMeta[task.status]
  return (
    <span className="relative inline-flex items-center">
      <span className={cx('pointer-events-none absolute left-2 size-1.5 rounded-full', meta.dot)} />
      <select
        aria-label={`Status de ${task.title}`}
        value={task.status}
        disabled={setStatus.isPending}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setStatus.mutate({ id: task.id, status: e.target.value as TaskStatus })}
        className={cx(
          'h-7 cursor-pointer appearance-none rounded-md border border-transparent bg-transparent pr-2 pl-5 text-[13px] hover:border-line-strong focus:border-accent focus:outline-none',
          meta.text,
        )}
      >
        {statusOrder.map((s) => (
          <option key={s} value={s} className="text-ink">
            {statusMeta[s].label}
          </option>
        ))}
      </select>
    </span>
  )
}

export function TaskRow({ task, selected, first, last, onSelect, onEdit }: Props) {
  const { move } = useTaskActions()
  const [hover, setHover] = useState(false)
  const overdue = isOverdue(task)
  const done = task.status === 'DONE'

  return (
    <li
      className={cx('group relative flex gap-3 px-4 transition-colors', selected ? 'bg-accent-soft/60' : 'hover:bg-canvas')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="w-12 shrink-0 py-3 text-right tabular">
        <p className={cx('text-sm font-semibold', done && 'text-muted')}>{task.startTime}</p>
        {task.endTime && <p className="text-xs text-faint">{task.endTime}</p>}
      </div>

      <div className="relative flex w-3 shrink-0 justify-center" aria-hidden="true">
        <span className={cx('absolute w-px bg-line', first ? 'top-[18px]' : 'top-0', last ? 'h-[18px]' : 'bottom-0')} />
        <span className={cx('relative mt-[14px] size-2.5 rounded-full ring-4 ring-surface', statusMeta[task.status].dot)} />
      </div>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 py-3 text-left focus-visible:outline-none">
        <p className={cx('truncate text-sm font-medium', done && 'text-muted line-through decoration-faint')}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted">
          {task.category && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: task.category.color }} />
              {task.category.name}
            </span>
          )}
          {task.priority !== 'MEDIUM' && <span className={priorityMeta[task.priority].text}>Prioridade {priorityMeta[task.priority].label.toLowerCase()}</span>}
          <span>por {task.createdBy.name.split(' ')[0]}</span>
          {task.rule && (
            <span className="inline-flex items-center gap-1" title="Recorrente">
              <Icon name="repeat" className="size-3" />
            </span>
          )}
          {task._count.comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="chat" className="size-3" />
              {task._count.comments}
            </span>
          )}
          {overdue && <span className="font-medium text-bad">Atrasada</span>}
        </p>
      </button>

      <div className="flex shrink-0 items-center gap-1 py-2">
        <div className={cx('hidden items-center sm:flex', hover || selected ? 'opacity-100' : 'opacity-0 focus-within:opacity-100')}>
          <RowButton label="Mover para cima" icon="up" disabled={first || move.isPending} onClick={() => move.mutate({ id: task.id, direction: 'up' })} />
          <RowButton label="Mover para baixo" icon="down" disabled={last || move.isPending} onClick={() => move.mutate({ id: task.id, direction: 'down' })} />
          <RowButton label="Editar" icon="edit" onClick={onEdit} />
        </div>
        <StatusSelect task={task} />
      </div>
    </li>
  )
}

function RowButton({ label, icon, onClick, disabled }: { label: string; icon: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="rounded p-1.5 text-muted hover:bg-surface hover:text-ink disabled:opacity-30"
    >
      <Icon name={icon} className="size-3.5" />
    </button>
  )
}
