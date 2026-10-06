import { useState } from 'react'
import { CurrentActivity, pickCurrent } from '../components/CurrentActivity'
import { Comments } from '../components/Comments'
import { IncidentForm } from '../components/IncidentForm'
import { PageHeader } from '../components/Layout'
import { OnDemandCard } from '../components/OnDemand'
import { OwnerSelect } from '../components/OwnerSelect'
import { TaskForm } from '../components/TaskForm'
import { TaskRow } from '../components/TaskRow'
import { Button, Card, cx, Empty, Icon } from '../components/ui'
import { useAuth, useMe } from '../lib/auth'
import { addDays, formatLong, formatWeekday, greeting, isOverdue, relativeDay, startOfWeek, todayISO } from '../lib/format'
import { useOwner } from '../lib/owner'
import { useIncidents, useNow, useTasks } from '../lib/queries'
import type { Task } from '../types'

export function TodayPage() {
  const me = useMe()
  const { can } = useAuth()
  const { ownerId, owner } = useOwner()
  useNow(60_000) // reavalia atrasos a cada minuto

  const today = todayISO()
  const [date, setDate] = useState(today)
  const [selectedId, setSelectedId] = useState<string>()
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [incidentOpen, setIncidentOpen] = useState(false)

  const tasks = useTasks(date, date, ownerId)
  const incidents = useIncidents(date, date)
  const list = tasks.data ?? []
  const isToday = date === today

  const current = isToday ? pickCurrent(list) : undefined
  const selected = list.find((t) => t.id === selectedId) ?? current ?? list[0]

  const done = list.filter((t) => t.status === 'DONE').length
  const stats = [
    { label: 'Total', value: list.length },
    { label: 'Concluídas', value: done, tone: 'text-ok' },
    { label: 'Em andamento', value: list.filter((t) => t.status === 'IN_PROGRESS').length, tone: 'text-accent' },
    { label: 'Pendentes', value: list.filter((t) => t.status === 'PENDING' || t.status === 'PAUSED').length, tone: 'text-warn' },
    { label: 'Atrasadas', value: list.filter(isOverdue).length, tone: 'text-bad' },
  ]
  const progress = list.length ? Math.round((done / list.length) * 100) : 0
  const firstName = me.name.split(' ')[0]
  const viewingOther = owner && owner.id !== me.id

  return (
    <>
      <PageHeader
        title={isToday ? `${greeting()}, ${firstName}` : relativeDay(date)}
        subtitle={`${formatLong(date)}${viewingOther ? ` · rotina de ${owner.name}` : ''}`}
        actions={
          <>
            <OwnerSelect />
            <div className="flex items-center rounded-md border border-line-strong bg-surface">
              <button type="button" onClick={() => setDate(addDays(date, -1))} className="p-2 text-muted hover:text-ink" aria-label="Dia anterior">
                <Icon name="left" />
              </button>
              <button type="button" onClick={() => setDate(today)} disabled={isToday} className="px-2 text-[13px] font-medium disabled:text-muted">
                Hoje
              </button>
              <button type="button" onClick={() => setDate(addDays(date, 1))} className="p-2 text-muted hover:text-ink" aria-label="Próximo dia">
                <Icon name="right" />
              </button>
            </div>
            {can('incidents.create') && (
              <Button onClick={() => setIncidentOpen(true)}>
                <Icon name="bolt" className="size-3.5" />
                Imprevisto
              </Button>
            )}
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Icon name="plus" className="size-3.5" />
              Nova tarefa
            </Button>
          </>
        }
      />

      <section aria-label="Resumo do dia" className="mb-6 flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 md:flex-row md:items-center">
        <dl className="grid flex-1 grid-cols-3 gap-4 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className={cx('mt-0.5 text-2xl font-semibold tabular', s.value > 0 && s.tone)}>{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="md:w-64 md:border-l md:border-line md:pl-6">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted">Progresso do dia</span>
            <span className="text-sm font-semibold tabular">{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted tabular">
            {done} de {list.length} atividades
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title={isToday ? 'Rotina de hoje' : 'Rotina'}>
            {tasks.isPending ? (
              <Empty>Carregando…</Empty>
            ) : list.length === 0 ? (
              <Empty>Nenhuma atividade neste dia. Use “Nova tarefa” para adicionar a primeira.</Empty>
            ) : (
              <ol className="py-2">
                {list.map((t, i) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    first={i === 0}
                    last={i === list.length - 1}
                    selected={selected?.id === t.id}
                    onSelect={() => setSelectedId(t.id)}
                    onEdit={() => setEditing(t)}
                  />
                ))}
              </ol>
            )}
          </Card>

          {incidents.data && incidents.data.length > 0 && (
            <Card title="Imprevistos">
              <ul className="divide-y divide-line">
                {incidents.data.map((i) => (
                  <li key={i.id} className="flex gap-3 px-4 py-3 text-sm">
                    <span className="w-12 shrink-0 text-right font-semibold tabular">{i.startTime}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{i.title}</p>
                      <p className="text-xs text-muted">
                        {i.durationMinutes} min
                        {i.task && ` · interrompeu “${i.task.title}”`}
                        {i.description && ` · ${i.description}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {isToday && <CurrentActivity task={current} onEdit={setEditing} />}
          {isToday && <OnDemandCard ownerId={ownerId} />}
          <Comments task={selected} />
          <WeekSummary date={date} ownerId={ownerId} onPick={setDate} />
        </div>
      </div>

      {editing && <TaskForm task={editing === 'new' ? undefined : editing} defaults={{ date, assigneeId: ownerId }} onClose={() => setEditing(null)} />}
      {incidentOpen && <IncidentForm tasks={isToday ? list : []} onClose={() => setIncidentOpen(false)} />}
    </>
  )
}

function WeekSummary({ date, ownerId, onPick }: { date: string; ownerId?: string; onPick: (d: string) => void }) {
  const monday = startOfWeek(date)
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i))
  const tasks = useTasks(monday, days[4], ownerId)
  const today = todayISO()

  return (
    <Card title="Resumo da semana">
      <ul className="grid grid-cols-5 gap-1 p-3">
        {days.map((d) => {
          const list = (tasks.data ?? []).filter((t) => t.date === d)
          const done = list.filter((t) => t.status === 'DONE').length
          const pct = list.length ? Math.round((done / list.length) * 100) : null
          const future = d > today
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => onPick(d)}
                className={cx('flex w-full flex-col items-center gap-1.5 rounded-md py-2 hover:bg-canvas', d === date && 'bg-accent-soft/60')}
              >
                <span className={cx('text-xs', d === today ? 'font-semibold text-accent' : 'text-muted')}>{formatWeekday(d)}</span>
                <span className="relative h-10 w-1.5 overflow-hidden rounded-full bg-canvas">
                  <span
                    className={cx('absolute inset-x-0 bottom-0 rounded-full', pct === null || future ? 'bg-line' : pct >= 75 ? 'bg-ok' : pct >= 50 ? 'bg-warn' : 'bg-bad')}
                    style={{ height: `${pct ?? 0}%` }}
                  />
                </span>
                <span className="text-xs font-medium tabular">{pct === null || future ? '–' : `${pct}%`}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
