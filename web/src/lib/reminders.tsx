import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task } from '../types'
import { useMe } from './auth'
import { todayISO } from './format'
import { useNow, useTasks } from './queries'

// Lembrete de horário: avisa quando chega a hora (ou alguns minutos antes) de começar cada tarefa
// da própria pessoa. Funciona com o site aberto numa aba, mesmo minimizada: notificação do Windows
// (se permitida) e o sino com a lista do dia. Preferências ficam neste navegador.

export type Lead = 0 | 5 | 10 | 15
type Prefs = { enabled: boolean; lead: Lead; desktop: boolean }
export type Reminder = { key: string; task: Task; at: number } // at = minuto do dia em que o lembrete vale

const PREFS_KEY = 'rt-reminders'
const SENT_KEY = 'rt-reminders-sent'
const SEEN_KEY = 'rt-reminders-seen'
const LATE_TOLERANCE = 10 // minutos: abriu o site um pouco depois do horário, ainda avisa

const defaults: Prefs = { enabled: true, lead: 5, desktop: true }

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...JSON.parse(v) } : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem armazenamento local: só não lembra entre recarregamentos.
  }
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
const nowMinutes = (ms: number) => {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes()
}

/** Notificações do Windows só existem em conexão segura (localhost ou https), não pelo IP da rede. */
export const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext

/** Texto do aviso a partir da hora atual: "Começa em 3 min" ou "Começa agora". */
export function reminderText(r: Reminder, minuteNow: number) {
  const left = minutesOf(r.task.startTime) - minuteNow
  return left > 0 ? `Começa em ${left} min` : 'Começa agora'
}

type ReminderValue = {
  prefs: Prefs
  setPrefs: (p: Partial<Prefs>) => void
  permission: NotificationPermission | 'unsupported'
  requestPermission: () => Promise<void>
  test: () => Promise<string>
  today: Reminder[] // lembretes de hoje que já chegaram, do mais recente para o mais antigo
  unread: number // avisos que de fato dispararam e ainda não foram vistos no sino
  markSeen: () => void
}

const ReminderContext = createContext<ReminderValue | null>(null)

export function ReminderProvider({ children }: { children: ReactNode }) {
  const me = useMe()
  const navigate = useNavigate()
  const now = useNow(20_000)
  const day = todayISO()
  const tasks = useTasks(day, day, me.id)
  const [prefs, setPrefsState] = useState<Prefs>(() => read(PREFS_KEY, defaults))
  const [permission, setPermission] = useState<ReminderValue['permission']>(() => (desktopSupported() ? Notification.permission : 'unsupported'))
  // sent: avisos já disparados hoje (não repetem ao recarregar); seen: os que já foram vistos no sino.
  const sent = useRef<{ day: string; keys: string[] }>(read(SENT_KEY, { day: '', keys: [] }))
  const [sentKeys, setSentKeys] = useState<string[]>(() => (sent.current.day === todayISO() ? sent.current.keys : []))
  const [seen, setSeen] = useState<{ day: string; keys: string[] }>(() => read(SEEN_KEY, { day: '', keys: [] }))

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...p }
      write(PREFS_KEY, next)
      return next
    })
  }, [])

  const notify = useCallback(
    (title: string, body: string, tag: string) => {
      if (!prefs.desktop || !desktopSupported() || Notification.permission !== 'granted') return
      try {
        const n = new Notification(title, { body, tag, icon: '/favicon.svg' })
        n.onclick = () => {
          window.focus()
          navigate('/')
          n.close()
        }
      } catch {
        // Alguns navegadores não deixam criar notificação fora de um service worker.
      }
    },
    [prefs.desktop, navigate],
  )

  // Todos os lembretes de hoje (das tarefas da própria pessoa), com o minuto em que valem.
  const all = useMemo<Reminder[]>(
    () =>
      (tasks.data ?? [])
        .filter((t) => t.assigneeId === me.id && t.date === day)
        .map((t) => ({ key: `${t.id}@${day}`, task: t, at: Math.max(0, minutesOf(t.startTime) - prefs.lead) })),
    [tasks.data, me.id, day, prefs.lead],
  )

  // Dispara o que chegou agora e ainda não foi avisado (só tarefas que ainda não começaram).
  useEffect(() => {
    if (!prefs.enabled) return
    if (sent.current.day !== day) sent.current = { day, keys: [] }
    const minute = nowMinutes(now)
    let fired = false
    for (const r of all) {
      if (r.task.status !== 'PENDING' || sent.current.keys.includes(r.key)) continue
      if (r.at > minute || minute - r.at > LATE_TOLERANCE) continue
      sent.current.keys.push(r.key)
      fired = true
      notify(`${reminderText(r, minute)} · ${r.task.startTime}`, r.task.title + (r.task.category ? ` · ${r.task.category.name}` : ''), r.key)
    }
    write(SENT_KEY, sent.current)
    if (fired) setSentKeys([...sent.current.keys])
  }, [all, now, day, prefs.enabled, notify])

  const minute = nowMinutes(now)
  const today = prefs.enabled ? all.filter((r) => r.at <= minute).sort((a, b) => b.at - a.at) : []
  const seenToday = seen.day === day ? seen.keys : []
  const unread = prefs.enabled ? sentKeys.filter((k) => k.endsWith(`@${day}`) && !seenToday.includes(k)).length : 0

  const value: ReminderValue = {
    prefs,
    setPrefs,
    permission,
    requestPermission: async () => {
      if (!desktopSupported()) return
      setPermission(await Notification.requestPermission())
    },
    // Teste com diagnóstico: diz o que impediu, ou se o navegador entregou o aviso ao Windows.
    test: () =>
      new Promise<string>((resolve) => {
        if (!desktopSupported()) return resolve('Este endereço não permite notificações. Abra por http://localhost:3000.')
        if (Notification.permission !== 'granted') return resolve(`O navegador ainda não deu permissão (estado: ${Notification.permission}).`)
        try {
          const n = new Notification('Teste do Routine Tracker', { body: 'Assim aparecem os lembretes das suas tarefas.', tag: 'rt-test', icon: '/favicon.svg' })
          n.onshow = () =>
            resolve('O navegador entregou o aviso ao Windows. Se nada apareceu no canto da tela, o Windows está segurando: veja o "Não perturbe" e as notificações do navegador nas configurações do Windows.')
          n.onerror = () => resolve('O navegador recusou mostrar o aviso. Confira a permissão de notificações deste site no navegador.')
          window.setTimeout(() => resolve('O navegador não respondeu. Confira as notificações do navegador nas configurações do Windows.'), 5000)
        } catch (e) {
          resolve(`Erro ao criar o aviso: ${e instanceof Error ? e.message : e}`)
        }
      }),
    today,
    unread,
    markSeen: () => {
      const next = { day, keys: [...sentKeys] }
      setSeen(next)
      write(SEEN_KEY, next)
    },
  }

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>
}

export function useReminders() {
  const ctx = useContext(ReminderContext)
  if (!ctx) throw new Error('useReminders fora do ReminderProvider')
  return ctx
}
