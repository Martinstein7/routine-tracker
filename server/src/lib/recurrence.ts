import { prisma } from '../db.ts'
import type { RecurringRule } from '../generated/prisma/client.ts'
import { blockedDates } from './blocked.ts'
import { daysBetween, weekday } from './dates.ts'

export function occursOn(rule: Pick<RecurringRule, 'pattern' | 'weekday'>, date: string): boolean {
  const day = weekday(date)
  if (rule.pattern === 'DAILY') return true
  if (rule.pattern === 'WEEKDAYS') return day >= 1 && day <= 5
  return day === rule.weekday
}

/** Cria as ocorrências das tarefas recorrentes que caem no intervalo e ainda não existem. */
export async function materialize(from: string, to: string) {
  const rules = await prisma.recurringRule.findMany({
    where: {
      active: true,
      startDate: { lte: to },
      OR: [{ endDate: null }, { endDate: { gte: from } }],
    },
  })
  const blocked = await blockedDates(from, to)
  const data = []
  for (const rule of rules) {
    const start = rule.startDate > from ? rule.startDate : from
    const end = rule.endDate && rule.endDate < to ? rule.endDate : to
    for (const date of daysBetween(start, end)) {
      if (!occursOn(rule, date) || blocked.has(date)) continue
      data.push({
        title: rule.title,
        description: rule.description,
        date,
        startTime: rule.startTime,
        endTime: rule.endTime,
        priority: rule.priority,
        categoryId: rule.categoryId,
        assigneeId: rule.assigneeId,
        createdById: rule.createdById,
        ruleId: rule.id,
      })
    }
  }
  if (data.length) await prisma.task.createMany({ data, skipDuplicates: true })
}
