import { prisma } from '../db.ts'
import { daysBetween, weekday } from './dates.ts'
import { badRequest } from './errors.ts'

// Dias sem rotina: os bloqueados pelo admin e, se ele ativar, todos os fins de semana.

export const WEEKEND_KEY = 'blockWeekends'
export const WEEKEND_REASON = 'Fim de semana'

export async function weekendsBlocked(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: WEEKEND_KEY } })
  return row?.value === true
}

export const isWeekend = (date: string) => weekday(date) === 0 || weekday(date) === 6

/** Datas bloqueadas no intervalo, com o motivo. */
export async function blockedDates(from: string, to: string): Promise<Map<string, string>> {
  const [days, weekends] = await Promise.all([
    prisma.blockedDay.findMany({ where: { date: { gte: from, lte: to } } }),
    weekendsBlocked(),
  ])
  const out = new Map<string, string>()
  if (weekends) for (const d of daysBetween(from, to)) if (isWeekend(d)) out.set(d, WEEKEND_REASON)
  for (const d of days) out.set(d.date, d.reason)
  return out
}

export async function assertNotBlocked(date: string) {
  const reason = (await blockedDates(date, date)).get(date)
  if (reason) {
    const day = date.split('-').reverse().join('/')
    throw badRequest(`O dia ${day} está bloqueado (${reason}). Para usar, desbloqueie em Configurações → Dias bloqueados.`)
  }
}
