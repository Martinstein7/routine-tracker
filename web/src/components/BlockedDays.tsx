import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, qs } from '../lib/api'
import { formatDate, formatWeekday, todayISO } from '../lib/format'
import { useBlockedDays, useTaskActions } from '../lib/queries'
import { Button, Card, cx, Empty, ErrorText, Field, inputCls } from './ui'

const REASONS = ['Consulta', 'Feriado', 'Folga', 'Férias', 'Outro'] as const

/** Só o admin: bloqueia dias para rotina (um dia, um período ou todos os fins de semana). */
export function BlockedDaysCard() {
  const today = todayISO()
  const blocked = useBlockedDays()
  const actions = useTaskActions()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState('')
  const [reason, setReason] = useState<(typeof REASONS)[number]>('Consulta')
  const [other, setOther] = useState('')
  const [removeTasks, setRemoveTasks] = useState(true)
  const [showPast, setShowPast] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const end = to && to >= from ? to : from
  const impact = useQuery({
    queryKey: ['blocked-impact', from, end],
    queryFn: () => api.get<{ manual: number; recurring: number }>(`/api/blocked-days/impact${qs({ from, to: end })}`),
    enabled: !!from,
    staleTime: 0,
  })

  const days = blocked.data?.days ?? []
  const upcoming = days.filter((d) => d.date >= today)
  const past = days.filter((d) => d.date < today).reverse()
  const finalReason = reason === 'Outro' ? other.trim() : reason

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setDone('')
    try {
      const r = await actions.blockDays.mutateAsync({ from, to: end, reason: finalReason, removeTasks })
      setDone(
        `${r.blocked === 1 ? 'Dia bloqueado' : `${r.blocked} dias bloqueados`}` +
          (r.removedTasks ? ` · ${r.removedTasks} tarefa${r.removedTasks === 1 ? '' : 's'} removida${r.removedTasks === 1 ? '' : 's'}.` : '.'),
      )
      setTo('')
      setOther('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível bloquear.')
    }
  }

  return (
    <Card title="Dias bloqueados">
      <div className="flex flex-col gap-5 px-4 py-4">
        <p className="text-sm text-muted">
          Para consultas, feriados ou folgas: num dia bloqueado não dá para adicionar rotina, e as tarefas recorrentes não aparecem. Só você altera; a gestora
          vê os bloqueios no calendário.
        </p>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="block-weekends" className="text-sm">
            <span className="block font-medium">Bloquear fins de semana</span>
            <span className="block text-xs text-muted">Sábados e domingos ficam sem rotina.</span>
          </label>
          <button
            id="block-weekends"
            type="button"
            role="switch"
            aria-checked={!!blocked.data?.weekends}
            disabled={actions.setWeekendsBlocked.isPending || !blocked.data}
            onClick={() => actions.setWeekendsBlocked.mutate(!blocked.data?.weekends)}
            className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', blocked.data?.weekends ? 'bg-accent' : 'bg-line-strong')}
          >
            <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', blocked.data?.weekends ? 'left-4.5' : 'left-0.5')} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border border-line p-3">
          <p className="text-sm font-medium">Bloquear um dia ou período</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="De" htmlFor="block-from">
              <input id="block-from" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Até" htmlFor="block-to" hint="Vazio = só um dia.">
              <input id="block-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Motivo" htmlFor="block-reason">
            <select id="block-reason" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])} className={inputCls}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          {reason === 'Outro' && (
            <Field label="Qual?" htmlFor="block-other">
              <input id="block-other" required maxLength={60} value={other} onChange={(e) => setOther(e.target.value)} className={inputCls} placeholder="Ex.: Viagem a trabalho" />
            </Field>
          )}

          {impact.data && impact.data.manual + impact.data.recurring > 0 && (
            <div className="rounded-md bg-warn-soft px-3 py-2 text-[13px]">
              <p>
                Já existe{impact.data.manual + impact.data.recurring === 1 ? '' : 'm'} {impact.data.manual + impact.data.recurring} tarefa
                {impact.data.manual + impact.data.recurring === 1 ? '' : 's'} em aberto nesse período.
                {impact.data.recurring > 0 && ` As ${impact.data.recurring} recorrentes saem e voltam sozinhas se você desbloquear.`}
              </p>
              {impact.data.manual > 0 && (
                <label className="mt-1.5 flex items-center gap-2">
                  <input type="checkbox" checked={removeTasks} onChange={(e) => setRemoveTasks(e.target.checked)} className="size-4 accent-accent" />
                  Remover também {impact.data.manual === 1 ? 'a tarefa criada' : `as ${impact.data.manual} tarefas criadas`} manualmente
                </label>
              )}
            </div>
          )}

          <ErrorText>{error}</ErrorText>
          {done && <p className="text-[13px] text-ok">{done}</p>}
          <div>
            <Button type="submit" variant="primary" disabled={actions.blockDays.isPending || (reason === 'Outro' && !other.trim())}>
              {actions.blockDays.isPending ? 'Bloqueando…' : end !== from ? 'Bloquear período' : 'Bloquear dia'}
            </Button>
          </div>
        </form>

        <div>
          <p className="mb-2 text-sm font-medium">Próximos dias bloqueados</p>
          {upcoming.length === 0 ? (
            <Empty>Nenhum dia bloqueado daqui para frente.</Empty>
          ) : (
            <DayList days={upcoming} onUnblock={(d) => actions.unblockDay.mutate(d)} busy={actions.unblockDay.isPending} />
          )}
          {past.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowPast(!showPast)} className="text-xs font-medium text-accent hover:underline">
                {showPast ? 'Ocultar anteriores' : `Ver anteriores (${past.length})`}
              </button>
              {showPast && (
                <div className="mt-2">
                  <DayList days={past} onUnblock={(d) => actions.unblockDay.mutate(d)} busy={actions.unblockDay.isPending} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function DayList({ days, onUnblock, busy }: { days: { date: string; reason: string }[]; onUnblock: (date: string) => void; busy: boolean }) {
  return (
    <ul className="divide-y divide-line rounded-md border border-line">
      {days.map((d) => (
        <li key={d.date} className="flex items-center gap-3 px-3 py-2">
          <span className="w-24 shrink-0 text-sm tabular">{formatDate(d.date)}</span>
          <span className="w-10 shrink-0 text-xs text-muted">{formatWeekday(d.date)}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{d.reason}</span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onUnblock(d.date)}>
            Desbloquear
          </Button>
        </li>
      ))}
    </ul>
  )
}
