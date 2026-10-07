import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReminders } from '../lib/reminders'
import { cx, Icon, StatusLabel } from './ui'

/** Sino com os lembretes de horário de hoje. Abrir marca como lidos. */
export function Bell() {
  const { today, unread, markSeen, prefs } = useReminders()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          if (!open) markSeen()
        }}
        aria-expanded={open}
        aria-label={unread ? `Lembretes: ${unread} novo${unread === 1 ? '' : 's'}` : 'Lembretes'}
        title="Lembretes de hoje"
        className="relative rounded p-1.5 text-muted hover:bg-canvas hover:text-ink"
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white tabular">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface shadow-xl lg:right-auto lg:left-0">
          <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold">Lembretes de hoje</p>
            <button type="button" onClick={() => go('/configuracoes')} className="text-xs font-medium text-accent hover:underline">
              Configurar
            </button>
          </header>
          {!prefs.enabled ? (
            <p className="px-4 py-5 text-sm text-muted">Os lembretes estão desligados. Ligue em Configurações → Notificações.</p>
          ) : today.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">
              Nenhum lembrete até agora. Você é avisado {prefs.lead === 0 ? 'na hora de começar' : `${prefs.lead} min antes`} de cada tarefa sua.
            </p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {today.map((r) => (
                <li key={r.key}>
                  <button type="button" onClick={() => go('/')} className="flex w-full gap-3 px-4 py-2.5 text-left hover:bg-canvas">
                    <span className="w-11 shrink-0 pt-0.5 text-sm font-semibold tabular">{r.task.startTime}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('block truncate text-sm', r.task.status === 'DONE' && 'text-muted line-through decoration-faint')}>{r.task.title}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        {r.task.status === 'PENDING' ? 'Ainda não iniciada' : <StatusLabel status={r.task.status} />}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
