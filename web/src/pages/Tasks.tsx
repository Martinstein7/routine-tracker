import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { OwnerSelect } from '../components/OwnerSelect'
import { TaskForm } from '../components/TaskForm'
import { StatusSelect } from '../components/TaskRow'
import { Button, Card, cx, Empty, Icon, inputCls, Segmented } from '../components/ui'
import { addDays, endOfMonth, formatDate, isOverdue, priorityMeta, startOfMonth, startOfWeek, todayISO } from '../lib/format'
import { useOwner } from '../lib/owner'
import { useTasks } from '../lib/queries'
import type { Task, TaskStatus } from '../types'

type Period = 'next7' | 'week' | 'month' | 'overdue'
type StatusFilter = 'all' | 'open' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'

const statusFilters: { value: StatusFilter; label: string; match: (s: TaskStatus) => boolean }[] = [
  { value: 'all', label: 'Todas', match: () => true },
  { value: 'open', label: 'Pendentes', match: (s) => s === 'PENDING' || s === 'PAUSED' },
  { value: 'IN_PROGRESS', label: 'Em andamento', match: (s) => s === 'IN_PROGRESS' },
  { value: 'BLOCKED', label: 'Bloqueadas', match: (s) => s === 'BLOCKED' },
  { value: 'DONE', label: 'Concluídas', match: (s) => s === 'DONE' },
]

function range(period: Period): [string, string] {
  const today = todayISO()
  if (period === 'week') return [startOfWeek(today), addDays(startOfWeek(today), 6)]
  if (period === 'month') return [startOfMonth(today), endOfMonth(today)]
  if (period === 'overdue') return [addDays(today, -30), today]
  return [today, addDays(today, 6)]
}

export function TasksPage() {
  const { ownerId } = useOwner()
  const [period, setPeriod] = useState<Period>('next7')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [from, to] = range(period)
  const tasks = useTasks(from, to, ownerId)

  const term = search.trim().toLowerCase()
  const match = statusFilters.find((f) => f.value === status)!.match
  const list = (tasks.data ?? []).filter(
    (t) =>
      (period !== 'overdue' || isOverdue(t)) &&
      match(t.status) &&
      (!term || t.title.toLowerCase().includes(term) || t.category?.name.toLowerCase().includes(term)),
  )

  return (
    <>
      <PageHeader
        title="Tarefas"
        subtitle={period === 'overdue' ? 'Atrasadas nos últimos 30 dias' : `${formatDate(from)} a ${formatDate(to)}`}
        actions={
          <>
            <OwnerSelect />
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Icon name="plus" className="size-3.5" />
              Nova tarefa
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<Period>
          label="Período"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'next7', label: 'Próximos 7 dias' },
            { value: 'week', label: 'Esta semana' },
            { value: 'month', label: 'Este mês' },
            { value: 'overdue', label: 'Atrasadas' },
          ]}
        />
        <input type="search" aria-label="Buscar tarefas" placeholder="Buscar por título ou categoria" value={search} onChange={(e) => setSearch(e.target.value)} className={cx(inputCls, 'max-w-xs')} />
      </div>

      <Card>
        <div role="tablist" aria-label="Status" className="flex gap-1 overflow-x-auto border-b border-line px-3">
          {statusFilters.map((f) => {
            const count = (tasks.data ?? []).filter((t) => (period !== 'overdue' || isOverdue(t)) && f.match(t.status)).length
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={status === f.value}
                onClick={() => setStatus(f.value)}
                className={cx(
                  '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium',
                  status === f.value ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {f.label} <span className="ml-1 text-faint tabular">{count}</span>
              </button>
            )
          })}
        </div>

        {list.length === 0 ? (
          <Empty>{tasks.isPending ? 'Carregando…' : 'Nenhuma tarefa encontrada com esses filtros.'}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 py-2.5 font-medium">Tarefa</th>
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Horário</th>
                  <th className="px-4 py-2.5 font-medium">Prioridade</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Criada por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-t border-line">
                {list.map((t) => (
                  <tr key={t.id} onClick={() => setEditing(t)} className="cursor-pointer hover:bg-canvas">
                    <td className="max-w-72 px-4 py-2.5">
                      <p className={cx('truncate font-medium', t.status === 'DONE' && 'text-muted')}>{t.title}</p>
                      {t.category && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <span className="size-2 rounded-sm" style={{ background: t.category.color }} />
                          {t.category.name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular">
                      {formatDate(t.date)}
                      {isOverdue(t) && <span className="ml-2 text-xs font-medium text-bad">Atrasada</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted tabular">
                      {t.startTime}
                      {t.endTime && `–${t.endTime}`}
                    </td>
                    <td className={cx('px-4 py-2.5', priorityMeta[t.priority].text)}>{priorityMeta[t.priority].label}</td>
                    <td className="px-4 py-1.5">
                      <StatusSelect task={t} />
                    </td>
                    <td className="px-4 py-2.5 text-muted">{t.createdBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <TaskForm task={editing === 'new' ? undefined : editing} defaults={{ assigneeId: ownerId }} onClose={() => setEditing(null)} />}
    </>
  )
}
