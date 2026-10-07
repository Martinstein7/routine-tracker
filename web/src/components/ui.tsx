import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { initials, statusMeta } from '../lib/format'
import type { TaskStatus } from '../types'

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')
export { cx }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-on-accent hover:bg-accent-hover',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-canvas',
        variant === 'ghost' && 'text-muted hover:bg-canvas hover:text-ink',
        variant === 'danger' && 'border border-line-strong bg-surface text-bad hover:bg-bad-soft',
        className,
      )}
    />
  )
}

export const inputCls =
  'h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none disabled:bg-canvas disabled:text-muted'

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-lg border border-line bg-surface', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatusLabel({ status }: { status: TaskStatus }) {
  const meta = statusMeta[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[13px]', meta.text)}>
      <span className={cx('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted">{children}</p>
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-[13px] text-bad">
      {children}
    </p>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  const titleId = useId()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:pt-[8vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('w-full rounded-lg border border-line bg-surface shadow-xl', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id={titleId} className="text-[15px] font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-canvas hover:text-ink" aria-label="Fechar">
            <Icon name="x" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

/** Botão que pede confirmação no próprio lugar antes de executar. */
export function ConfirmButton({ label, confirmLabel = 'Confirmar', onConfirm, size = 'md' }: { label: string; confirmLabel?: string; onConfirm: () => void; size?: 'sm' | 'md' }) {
  const [asking, setAsking] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  if (!asking) {
    return (
      <Button
        size={size}
        variant="danger"
        onClick={() => {
          setAsking(true)
          timer.current = window.setTimeout(() => setAsking(false), 4000)
        }}
      >
        {label}
      </Button>
    )
  }
  return (
    <Button size={size} variant="danger" className="bg-bad! text-white! hover:opacity-90" onClick={onConfirm}>
      {confirmLabel}
    </Button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line-strong bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-7 rounded px-3 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const letters = initials(name)
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent',
        size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs',
      )}
    >
      {letters}
    </span>
  )
}

const paths: Record<string, string> = {
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  chat: 'M5 5h14v10H9l-4 4V5z',
  play: 'M8 5v14l11-7z',
  pause: 'M8 5v14M16 5v14',
  check: 'M5 12l5 5L20 7',
  block: 'M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z',
  bell: 'M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 004 0',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  history: 'M3 12a9 9 0 103-6.7M3 4v4h4M12 8v4l3 2',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
}

export function Icon({ name, className = 'size-4' }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={cx('shrink-0', className)} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
