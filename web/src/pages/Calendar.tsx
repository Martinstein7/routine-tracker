import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { OwnerSelect } from '../components/OwnerSelect'
import { TaskForm } from '../components/TaskForm'
import { Button, cx, Icon, Segmented } from '../components/ui'
import { addDays, addMonths, endOfMonth, formatDayMonth, formatMonth, formatWeekday, parseISO, startOfMonth, startOfWeek, statusMeta, todayISO } from '../lib/format'
import { useOwner } from '../lib/owner'
import { useTasks } from '../lib/queries'
import type { Task } from '../types'

type View = 'week' | 'month'

export function CalendarPage() {
  const { ownerId } = useOwner()
  const today = todayISO()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(today)
  const [editing, setEditing] = useState<{ task?: Task; date?: string } | null>(null)

  const weekStart = startOfWeek(anchor)
  const from = view === 'week' ? weekStart : startOfWeek(startOfMonth(anchor))
  const to = view === 'week' ? addDays(weekStart, 6) : addDays(startOfWeek(endOfMonth(anchor)), 6)
  const tasks = useTasks(from, to, ownerId)
  const byDay = new Map<string, Task[]>()
  for (const t of tasks.data ?? []) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t])

  const step = (dir: 1 | -1) => setAnchor(view === 'week' ? addDays(anchor, 7 * dir) : addMonths(anchor, dir))
  const title = view === 'week' ? `${formatDayMonth(weekStart)} – ${formatDayMonth(addDays(weekStart, 6))}` : formatMonth(anchor)

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle={title}
        actions={
          <>
            <OwnerSelect />
            <Segmented<View>
              label="Visualização"
              value={view}
              onChange={setView}
              options={[
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mês' },
              ]}
            />
            <div className="flex items-center rounded-md border border-line-strong bg-surface">
              <button type="button" onClick={() => step(-1)} className="p-2 text-muted hover:text-ink" aria-label="Anterior">
                <Icon name="left" />
              </button>
              <button type="button" onClick={() => setAnchor(today)} className="px-2 text-[13px] font-medium">
                Hoje
              </button>
              <button type="button" onClick={() => step(1)} className="p-2 text-muted hover:text-ink" aria-label="Próximo">
                <Icon name="right" />
              </button>
            </div>
            <Button variant="primary" onClick={() => setEditing({ date: anchor })}>
              <Icon name="plus" className="size-3.5" />
              Nova tarefa
            </Button>
          </>
        }
      />

      {view === 'week' ? (
        <div className="grid gap-3 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => (
            <section key={d} className={cx('flex min-w-0 flex-col rounded-lg border bg-surface', d === today ? 'border-accent/40' : 'border-line')}>
              <header className="flex items-center justify-between border-b border-line px-3 py-2">
                <div>
                  <p className={cx('text-xs', d === today ? 'font-semibold text-accent' : 'text-muted')}>{formatWeekday(d)}</p>
                  <p className="text-sm font-semibold tabular">{parseISO(d).getDate()}</p>
                </div>
                <button type="button" onClick={() => setEditing({ date: d })} className="rounded p-1 text-faint hover:bg-canvas hover:text-ink" aria-label={`Nova tarefa em ${formatDayMonth(d)}`}>
                  <Icon name="plus" className="size-3.5" />
                </button>
              </header>
              <ul className="flex flex-1 flex-col gap-1 p-1.5 md:min-h-64">
                {(byDay.get(d) ?? []).map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setEditing({ task: t })} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-canvas">
                      <p className="flex items-center gap-1.5 text-[11px] text-muted tabular">
                        <span className={cx('size-1.5 rounded-full', statusMeta[t.status].dot)} />
                        {t.startTime}
                      </p>
                      <p className={cx('mt-0.5 text-[13px] leading-snug', t.status === 'DONE' && 'text-muted line-through decoration-faint')}>{t.title}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <div className="grid min-w-[640px] grid-cols-7">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((w) => (
              <div key={w} className="border-b border-line px-3 py-2 text-xs text-muted">
                {w}
              </div>
            ))}
            {Array.from({ length: Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000) + 1 }, (_, i) => addDays(from, i)).map((d, i) => {
              const list = byDay.get(d) ?? []
              const outside = d.slice(0, 7) !== anchor.slice(0, 7)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setAnchor(d)
                    setView('week')
                  }}
                  className={cx('flex min-h-28 flex-col gap-1 border-line p-2 text-left hover:bg-canvas', i % 7 !== 6 && 'border-r', 'border-b', outside && 'bg-canvas/60')}
                >
                  <span
                    className={cx(
                      'inline-flex size-6 items-center justify-center rounded-full text-xs tabular',
                      d === today ? 'bg-accent font-semibold text-white' : outside ? 'text-faint' : 'text-ink',
                    )}
                  >
                    {parseISO(d).getDate()}
                  </span>
                  {list.slice(0, 3).map((t) => (
                    <span key={t.id} className="flex min-w-0 items-center gap-1.5 text-[11px]">
                      <span className={cx('size-1.5 shrink-0 rounded-full', statusMeta[t.status].dot)} />
                      <span className="text-muted tabular">{t.startTime}</span>
                      <span className="truncate">{t.title}</span>
                    </span>
                  ))}
                  {list.length > 3 && <span className="text-[11px] text-muted">+{list.length - 3} mais</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {editing && <TaskForm task={editing.task} defaults={{ date: editing.date, assigneeId: ownerId }} onClose={() => setEditing(null)} />}
    </>
  )
}
