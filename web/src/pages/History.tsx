import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { Avatar, Button, Card, ConfirmButton, Empty, ErrorText, Field, inputCls, Segmented } from '../components/ui'
import { api, qs } from '../lib/api'
import { useAuth } from '../lib/auth'
import { addDays, formatClock, relativeDay, todayISO, toISO } from '../lib/format'
import { useIncidents, useTaskActions, useUsers } from '../lib/queries'
import type { HistoryEvent } from '../types'

type Tab = 'events' | 'incidents'

export function HistoryPage() {
  const today = todayISO()
  const [tab, setTab] = useState<Tab>('events')
  const [from, setFrom] = useState(addDays(today, -6))
  const [to, setTo] = useState(today)
  const [actorId, setActorId] = useState('')
  const users = useUsers()

  return (
    <>
      <PageHeader title="Histórico" subtitle="Tudo o que foi feito na rotina, por quem e quando." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Segmented<Tab>
          label="Tipo"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'events', label: 'Atividades' },
            { value: 'incidents', label: 'Imprevistos' },
          ]}
        />
        <div className="w-40">
          <Field label="De" htmlFor="h-from">
            <input id="h-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="w-40">
          <Field label="Até" htmlFor="h-to">
            <input id="h-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </Field>
        </div>
        {tab === 'events' && (
          <div className="w-48">
            <Field label="Pessoa" htmlFor="h-actor">
              <select id="h-actor" value={actorId} onChange={(e) => setActorId(e.target.value)} className={inputCls}>
                <option value="">Todos</option>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      {tab === 'events' ? <Events from={from} to={to} actorId={actorId} /> : <Incidents from={from} to={to} />}
    </>
  )
}

function Events({ from, to, actorId }: { from: string; to: string; actorId: string }) {
  const history = useInfiniteQuery({
    queryKey: ['history', from, to, actorId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<{ events: HistoryEvent[]; hasMore: boolean }>(`/api/history${qs({ from, to, actorId, before: pageParam, take: 50 })}`),
    getNextPageParam: (last) => (last.hasMore ? last.events.at(-1)?.createdAt : undefined),
  })

  const events = history.data?.pages.flatMap((p) => p.events) ?? []
  const groups = new Map<string, HistoryEvent[]>()
  for (const e of events) {
    const day = toISO(new Date(e.createdAt))
    groups.set(day, [...(groups.get(day) ?? []), e])
  }

  if (!events.length) {
    return (
      <Card>
        <Empty>{history.isPending ? 'Carregando…' : 'Nada registrado neste período.'}</Empty>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {[...groups].map(([day, list]) => (
        <Card key={day} title={relativeDay(day)}>
          <ol className="divide-y divide-line">
            {list.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ol>
        </Card>
      ))}
      {history.hasNextPage && (
        <div className="flex justify-center">
          <Button onClick={() => history.fetchNextPage()} disabled={history.isFetchingNextPage}>
            {history.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  )
}

function EventRow({ event }: { event: HistoryEvent }) {
  const { can } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [summary, setSummary] = useState(event.summary)
  const [detail, setDetail] = useState(event.detail)
  const refresh = () => qc.invalidateQueries({ queryKey: ['history'] })
  const save = useMutation({ mutationFn: () => api.patch(`/api/history/${event.id}`, { summary, detail }), onSuccess: () => (refresh(), setEditing(false)) })
  const remove = useMutation({ mutationFn: () => api.del(`/api/history/${event.id}`), onSuccess: refresh })

  return (
    <li className="group flex gap-3 px-4 py-3">
      <span className="w-11 shrink-0 pt-0.5 text-xs text-muted tabular">{formatClock(event.createdAt)}</span>
      {event.actor ? <Avatar name={event.actor.name} size="sm" /> : <span className="size-6 shrink-0" />}
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input aria-label="Texto do registro" value={summary} onChange={(e) => setSummary(e.target.value)} className={inputCls} />
            <textarea aria-label="Detalhes do registro" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} className={`${inputCls} h-auto py-2`} />
            <ErrorText>{save.error?.message}</ErrorText>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
                Salvar
              </Button>
              <Button size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm">{event.summary}</p>
            {event.detail && <p className="mt-0.5 text-xs whitespace-pre-line text-muted">{event.detail}</p>}
            {event.editedAt && <p className="mt-0.5 text-[11px] text-faint">editado</p>}
          </>
        )}
      </div>
      {can('admin') && !editing && (
        <div className="flex shrink-0 items-start gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <ConfirmButton size="sm" label="Apagar" confirmLabel="Apagar mesmo" onConfirm={() => remove.mutate()} />
        </div>
      )}
    </li>
  )
}

function Incidents({ from, to }: { from: string; to: string }) {
  const { can } = useAuth()
  const incidents = useIncidents(from, to)
  const { deleteIncident } = useTaskActions()
  const list = incidents.data ?? []
  const total = list.reduce((sum, i) => sum + i.durationMinutes, 0)

  return (
    <Card title="Imprevistos" action={list.length > 0 && <span className="text-xs text-muted tabular">{list.length} · {total} min no total</span>}>
      {list.length === 0 ? (
        <Empty>{incidents.isPending ? 'Carregando…' : 'Nenhum imprevisto neste período.'}</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((i) => (
            <li key={i.id} className="group flex gap-3 px-4 py-3">
              <div className="w-24 shrink-0 text-xs text-muted tabular">
                <p>{i.date.split('-').reverse().slice(0, 2).join('/')}</p>
                <p>{i.startTime}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {i.durationMinutes} min · registrado por {i.author.name}
                  {i.task && ` · interrompeu “${i.task.title}”`}
                </p>
                {i.description && <p className="mt-1 text-sm text-muted">{i.description}</p>}
              </div>
              {can('admin') && (
                <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <ConfirmButton size="sm" label="Apagar" confirmLabel="Apagar mesmo" onConfirm={() => deleteIncident.mutate(i.id)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
