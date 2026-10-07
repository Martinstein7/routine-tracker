import { prisma } from '../db.ts'
import type { BlockRule } from '../generated/prisma/client.ts'
import { daysBetween, weekday } from './dates.ts'
import { badRequest } from './errors.ts'

// Dias sem rotina: os bloqueados pelo admin (um dia, um período ou repetindo) e,
// se ele ativar, todos os fins de semana.

export const WEEKEND_KEY = 'blockWeekends'
export const WEEKEND_REASON = 'Fim de semana'

export async function weekendsBlocked(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: WEEKEND_KEY } })
  return row?.value === true
}

export const isWeekend = (date: string) => weekday(date) === 0 || weekday(date) === 6

const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** A regra cai nesta data? Mesmo dia da semana (a cada 1 ou 2 semanas), do mês ou do ano que startDate. */
export function blockRuleOccurs(rule: Pick<BlockRule, 'pattern' | 'startDate' | 'endDate'>, date: string): boolean {
  if (date < rule.startDate || (rule.endDate && date > rule.endDate)) return false
  const diff = dayNumber(date) - dayNumber(rule.startDate)
  if (rule.pattern === 'WEEKLY') return diff % 7 === 0
  if (rule.pattern === 'BIWEEKLY') return diff % 14 === 0
  if (rule.pattern === 'MONTHLY') return date.slice(8) === rule.startDate.slice(8)
  return date.slice(5) === rule.startDate.slice(5)
}

/** Datas bloqueadas no intervalo, com o motivo. */
export async function blockedDates(from: string, to: string): Promise<Map<string, string>> {
  const [days, rules, weekends] = await Promise.all([
    prisma.blockedDay.findMany({ where: { date: { gte: from, lte: to } } }),
    prisma.blockRule.findMany({ where: { startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] } }),
    weekendsBlocked(),
  ])
  const out = new Map<string, string>()
  for (const d of daysBetween(from, to)) {
    if (weekends && isWeekend(d)) out.set(d, WEEKEND_REASON)
    const rule = rules.find((r) => blockRuleOccurs(r, d))
    if (rule) out.set(d, rule.reason)
  }
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
