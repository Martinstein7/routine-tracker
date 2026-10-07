import { NavLink, Outlet } from 'react-router-dom'
import { useAuth, useMe } from '../lib/auth'
import { formatClock, roleLabel } from '../lib/format'
import { useDemo } from '../lib/queries'
import { useRealtime } from '../lib/realtime'
import { ReminderProvider } from '../lib/reminders'
import { Bell } from './Bell'
import { Brand } from './Brand'
import { Avatar, cx, Icon } from './ui'

const nav = [
  { to: '/', label: 'Hoje', icon: 'home', end: true },
  { to: '/calendario', label: 'Calendário', icon: 'calendar' },
  { to: '/tarefas', label: 'Tarefas', icon: 'list' },
  { to: '/historico', label: 'Histórico', icon: 'history' },
  { to: '/relatorios', label: 'Relatórios', icon: 'chart' },
]

function DemoBanner({ resetAt }: { resetAt: string | null }) {
  return (
    <div role="status" className="border-b border-line bg-accent-soft px-4 py-2 text-center text-[13px] text-ink">
      <strong className="font-semibold">Demonstração</strong> com dados fictícios. Fique à vontade para clicar em tudo.{' '}
      <span className="text-muted">
        {resetAt
          ? `As alterações voltam ao padrão às ${formatClock(resetAt)}.`
          : 'Se algo for alterado, tudo volta ao padrão 10 minutos depois.'}
      </span>
    </div>
  )
}

// Os lembretes de horário rodam enquanto qualquer página logada estiver aberta.
export function Layout() {
  return (
    <ReminderProvider>
      <Shell />
    </ReminderProvider>
  )
}

function Shell() {
  const me = useMe()
  const { logout } = useAuth()
  const connected = useRealtime()
  const demo = useDemo().data
  const items = [...nav, { to: '/configuracoes', label: 'Configurações', icon: 'settings' }]

  // Na demonstração não há login, então também não há "Sair".
  const canLogout = !demo?.demo

  return (
    <div className="flex min-h-full flex-col">
      {demo?.demo && <DemoBanner resetAt={demo.resetAt} />}
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="relative z-20 border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-4 py-3 lg:px-5 lg:py-5">
            <Brand />
            <div className="flex items-center gap-1">
              <Bell />
              {canLogout && (
                <button type="button" onClick={logout} className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink lg:hidden" aria-label="Sair">
                  <Icon name="logout" />
                </button>
              )}
            </div>
          </div>
          <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
                    isActive ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-canvas hover:text-ink',
                  )
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2.5 border-t border-line px-4 py-3 lg:flex">
            <Avatar name={me.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{me.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className={cx('size-1.5 rounded-full', connected ? 'bg-ok' : 'bg-faint')} title={connected ? 'Atualizando em tempo real' : 'Reconectando…'} />
                {roleLabel[me.role]}
              </p>
            </div>
            {canLogout && (
              <button type="button" onClick={logout} className="rounded p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label="Sair" title="Sair">
                <Icon name="logout" />
              </button>
            )}
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
