import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { OwnerSelect } from '../components/OwnerSelect'
import { Card, cx, Empty, Segmented } from '../components/ui'
import { api, qs } from '../lib/api'
import { addDays, endOfMonth, formatDate, formatDuration, formatWeekday, parseISO, priorityMeta, startOfMonth, startOfWeek, statusMeta, statusOrder, todayISO } from '../lib/format'
import { useOwner } from '../lib/owner'
import type { Priority, Report } from '../types'

type Period = 'week' | 'month' | 'last30'

function range(period: Period): [string, string] {
  const today = todayISO()
  if (period === 'week') return [startOfWeek(today), addDays(startOfWeek(today), 6)]
  if (period === 'month') return [startOfMonth(today), endOfMonth(today)]
  return [addDays(today, -29), today]
}

export function ReportsPage() {
  const { ownerId } = useOwner()
  const [period, setPeriod] = useState<Period>('week')
  const [from, to] = range(period)
  const report = useQuery({
    queryKey: ['reports', from, to, ownerId],
    queryFn: () => api.get<Report>(`/api/reports${qs({ from, to, assigneeId: ownerId })}`),
    placeholderData: (prev) => prev,
  })
  const r = report.data

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle={`${formatDate(from)} a ${formatDate(to)}`}
        actions={
          <>
            <OwnerSelect />
            <Segmented<Period>
              label="Período"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'week', label: 'Esta semana' },
                { value: 'month', label: 'Este mês' },
                { value: 'last30', label: 'Últimos 30 dias' },
              ]}
            />
          </>
        }
      />

      {!r ? (
        <Card>
          <Empty>Carregando…</Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Atividades" value={String(r.total)} />
            <Kpi label="Concluídas" value={String(r.done)} />
            <Kpi label="Taxa de conclusão" value={`${Math.round(r.completionRate * 100)}%`} tone={r.total ? (r.completionRate >= 0.75 ? 'text-ok' : r.completionRate >= 0.5 ? 'text-warn' : 'text-bad') : undefined} />
            <Kpi label="Atrasadas" value={String(r.overdue)} tone={r.overdue ? 'text-bad' : undefined} />
            <Kpi label="Tempo registrado" value={formatDuration(r.trackedSeconds)} />
            <Kpi label="Imprevistos" value={String(r.incidents.count)} note={r.incidents.count ? `${r.incidents.minutes} min` : undefined} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
            <Card title="Conclusão por dia">
              <ByDay report={r} />
            </Card>
            <Card title="Por categoria">
              {r.byCategory.length === 0 ? (
                <Empty>Sem atividades no período.</Empty>
              ) : (
                <ul className="flex flex-col gap-3.5 p-4">
                  {r.byCategory.map((c) => (
                    <li key={c.id ?? 'none'}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="size-2 shrink-0 rounded-sm" style={{ background: c.color }} />
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted tabular">
                          {c.done}/{c.total}
                          {c.trackedSeconds > 0 && ` · ${formatDuration(c.trackedSeconds)}`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                        <div className="h-full rounded-full" style={{ width: `${(c.total / Math.max(...r.byCategory.map((x) => x.total))) * 100}%`, background: c.color }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Por status">
              <Breakdown
                total={r.total}
                rows={statusOrder.map((s) => ({ key: s, label: statusMeta[s].label, value: r.byStatus[s], dot: statusMeta[s].dot }))}
              />
            </Card>
            <Card title="Por prioridade">
              <Breakdown
                total={r.total}
                rows={(['HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => ({
                  key: p,
                  label: priorityMeta[p].label,
                  value: r.byPriority[p],
                  dot: p === 'HIGH' ? 'bg-bad' : p === 'MEDIUM' ? 'bg-warn' : 'bg-faint',
                }))}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

function Kpi({ label, value, tone, note }: { label: string; value: string; tone?: string; note?: string }) {
  return (
    <div className="bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular', tone)}>{value}</p>
      {note && <p className="text-xs text-muted tabular">{note}</p>}
    </div>
  )
}

function ByDay({ report }: { report: Report }) {
  const days = report.byDay
  const max = Math.max(1, ...days.map((d) => d.total))
  const dense = days.length > 10
  const today = todayISO()

  return (
    <div className="overflow-x-auto p-4">
      <div className={cx('flex h-48 items-end gap-1.5', dense ? 'min-w-[560px]' : '')}>
        {days.map((d) => (
          <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${formatDate(d.date)}: ${d.done} de ${d.total}`}>
            <span className="text-[10px] text-muted tabular">{d.total ? `${d.done}/${d.total}` : ''}</span>
            <div className="relative w-full max-w-8 rounded-t-sm bg-canvas" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 4 : 0 }}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-sm bg-ok" style={{ height: d.total ? `${(d.done / d.total) * 100}%` : 0 }} />
            </div>
            <span className={cx('text-[10px] tabular', d.date === today ? 'font-semibold text-accent' : 'text-muted')}>
              {dense ? parseISO(d.date).getDate() : formatWeekday(d.date)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-ok" /> Concluídas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-canvas ring-1 ring-line" /> Planejadas
        </span>
      </p>
    </div>
  )
}

function Breakdown({ total, rows }: { total: number; rows: { key: string; label: string; value: number; dot: string }[] }) {
  if (!total) return <Empty>Sem atividades no período.</Empty>
  return (
    <ul className="flex flex-col gap-2.5 p-4">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-3 text-sm">
          <span className="flex w-32 shrink-0 items-center gap-2">
            <span className={cx('size-1.5 rounded-full', row.dot)} />
            {row.label}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
            <span className={cx('block h-full rounded-full', row.dot)} style={{ width: `${(row.value / total) * 100}%` }} />
          </span>
          <span className="w-8 text-right text-xs text-muted tabular">{row.value}</span>
        </li>
      ))}
    </ul>
  )
}
