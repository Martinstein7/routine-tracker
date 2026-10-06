import type { Priority, Recurrence, Role, Task, TaskStatus } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const todayISO = () => toISO(new Date())
export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(s: string, n: number): string {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export function startOfWeek(s: string): string {
  const day = parseISO(s).getDay()
  return addDays(s, day === 0 ? -6 : 1 - day)
}
export function startOfMonth(s: string): string {
  return `${s.slice(0, 7)}-01`
}
export function endOfMonth(s: string): string {
  const d = parseISO(startOfMonth(s))
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return toISO(d)
}
export function addMonths(s: string, n: number): string {
  const d = parseISO(startOfMonth(s))
  d.setMonth(d.getMonth() + n)
  return toISO(d)
}
export function nowHM(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const longFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const dayMonthFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const formatLong = (s: string) => capitalize(longFmt.format(parseISO(s)))
export const formatMonth = (s: string) => capitalize(monthFmt.format(parseISO(s)))
export const formatWeekday = (s: string) => capitalize(weekdayFmt.format(parseISO(s)).replace('.', ''))
export const formatDayMonth = (s: string) => dayMonthFmt.format(parseISO(s)).replace('.', '')
export const formatDate = (s: string) => s.split('-').reverse().join('/')
export const formatClock = (iso: string) => timeFmt.format(new Date(iso))

export function relativeDay(s: string): string {
  const today = todayISO()
  if (s === today) return 'Hoje'
  if (s === addDays(today, -1)) return 'Ontem'
  if (s === addDays(today, 1)) return 'Amanhã'
  return formatLong(s)
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  if (h === 0) return `${m}min`
  return `${h}h${m % 60 ? ` ${pad(m % 60)}min` : ''}`
}

export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function liveSeconds(task: Pick<Task, 'trackedSeconds' | 'startedAt'>, now = Date.now()): number {
  const running = task.startedAt ? Math.max(0, Math.floor((now - new Date(task.startedAt).getTime()) / 1000)) : 0
  return task.trackedSeconds + running
}

/** Atrasada: não concluída, não está rodando e o horário já passou. */
export function isOverdue(t: Pick<Task, 'status' | 'date' | 'startTime' | 'endTime'>): boolean {
  if (t.status === 'DONE' || t.status === 'IN_PROGRESS') return false
  const today = todayISO()
  if (t.date < today) return true
  return t.date === today && (t.endTime ?? t.startTime) < nowHM()
}

export const statusMeta: Record<TaskStatus, { label: string; dot: string; text: string }> = {
  PENDING: { label: 'Pendente', dot: 'bg-warn', text: 'text-warn' },
  IN_PROGRESS: { label: 'Em andamento', dot: 'bg-accent', text: 'text-accent' },
  PAUSED: { label: 'Pausada', dot: 'bg-faint', text: 'text-muted' },
  BLOCKED: { label: 'Bloqueada', dot: 'bg-bad', text: 'text-bad' },
  DONE: { label: 'Concluída', dot: 'bg-ok', text: 'text-ok' },
}
export const statusOrder: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'PAUSED', 'BLOCKED', 'DONE']

export const priorityMeta: Record<Priority, { label: string; text: string }> = {
  LOW: { label: 'Baixa', text: 'text-muted' },
  MEDIUM: { label: 'Média', text: 'text-warn' },
  HIGH: { label: 'Alta', text: 'text-bad' },
}

export const recurrenceLabel: Record<Recurrence, string> = {
  DAILY: 'Todos os dias',
  WEEKDAYS: 'Dias úteis',
  WEEKLY: 'Toda semana',
}

export const roleLabel: Record<Role, string> = { ADMIN: 'Admin', MANAGER: 'Gestora' }

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
