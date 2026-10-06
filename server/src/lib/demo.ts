import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.ts'
import { env } from '../env.ts'
import type { Prisma, Priority, TaskStatus } from '../generated/prisma/client.ts'
import { addDays, nowTime, today, weekday } from './dates.ts'
import { HttpError } from './errors.ts'
import { broadcast, type Topic } from './realtime.ts'

// Demonstração para apresentar o projeto: banco à parte, dados fictícios, entra sem login.
// Qualquer alteração de um visitante é desfeita 10 minutos depois da primeira mudança.

export const RESET_AFTER_MS = 10 * 60 * 1000

export function notInDemo() {
  if (env.demo) throw new HttpError(403, 'Indisponível na demonstração.')
}

let resetAt: Date | null = null
let timer: NodeJS.Timeout | undefined

export const demoStatus = () => ({ demo: env.demo, resetAt: resetAt?.toISOString() ?? null })

const ALL_TOPICS: Topic[] = ['tasks', 'onDemand', 'comments', 'incidents', 'history', 'categories', 'users', 'permissions', 'blocked', 'demo']

/** Chamado depois de cada alteração bem-sucedida: agenda a volta ao padrão, se ainda não houver uma agendada. */
export function scheduleReset(log: (msg: string) => void) {
  if (!env.demo || timer) return
  resetAt = new Date(Date.now() + RESET_AFTER_MS)
  log(`Demonstração alterada: volta ao padrão às ${resetAt.toLocaleTimeString('pt-BR')}`)
  broadcast(['demo'], 'demo')
  timer = setTimeout(async () => {
    try {
      await seedDemo()
      log('Demonstração restaurada ao padrão.')
    } catch (e) {
      log(`Falha ao restaurar a demonstração: ${e instanceof Error ? e.message : e}`)
    } finally {
      timer = undefined
      resetAt = null
      broadcast(ALL_TOPICS, 'demo')
    }
  }, RESET_AFTER_MS)
}

// ---------------------------------------------------------------------------------------------
// Dados fictícios. Datas relativas a hoje: a semana atual, o mês passado e um pouco antes,
// para o calendário e os relatórios terem o que mostrar.

const CATEGORIES = [
  { name: 'Suporte', color: '#3b82f6' },
  { name: 'Manutenção', color: '#14b8a6' },
  { name: 'Projetos', color: '#8b5cf6' },
  { name: 'Reuniões', color: '#f59e0b' },
  { name: 'Administrativo', color: '#64748b' },
  { name: 'Pausa', color: '#a3a3a3' },
  { name: 'Outros', color: '#ec4899' },
]

type Slot = { start: string; end: string; title: string; category: string; priority?: Priority; byManager?: boolean; rule?: boolean }

const ROUTINE: Slot[] = [
  { start: '08:00', end: '08:30', title: 'Verificar chamados abertos', category: 'Suporte', rule: true },
  { start: '08:30', end: '09:00', title: 'Conferir backups da noite', category: 'Manutenção' },
  { start: '09:00', end: '09:30', title: 'Reunião diária com a equipe', category: 'Reuniões' },
  { start: '09:30', end: '11:30', title: 'Projeto: novo portal interno', category: 'Projetos', priority: 'HIGH' },
  { start: '11:30', end: '12:00', title: 'Responder e-mails', category: 'Administrativo', priority: 'LOW' },
  { start: '13:00', end: '14:00', title: 'Atualizar inventário de equipamentos', category: 'Manutenção', byManager: true },
  { start: '14:00', end: '16:00', title: 'Atendimento a usuários', category: 'Suporte' },
  { start: '16:00', end: '16:30', title: 'Relatório do dia', category: 'Administrativo', byManager: true },
]

// Um compromisso a mais em alguns dias da semana (0 = domingo).
const EXTRAS: Record<number, Slot> = {
  2: { start: '16:30', end: '17:30', title: 'Treinamento de segurança da informação', category: 'Outros', priority: 'LOW' },
  4: { start: '16:30', end: '17:00', title: 'Revisar contrato do fornecedor de internet', category: 'Administrativo', priority: 'HIGH', byManager: true },
  5: { start: '15:00', end: '15:45', title: 'Reunião semanal com a gestora', category: 'Reuniões', byManager: true },
}

const ON_DEMAND = [
  { title: 'Atender chamado urgente', category: 'Suporte', priority: 'HIGH' as Priority, description: 'Chamado que não pode esperar a fila.' },
  { title: 'Reset de senha', category: 'Suporte', priority: 'LOW' as Priority, description: '' },
  { title: 'Ajuda com impressora', category: 'Suporte', priority: 'MEDIUM' as Priority, description: '' },
]

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const at = (date: string, time: string) => new Date(`${date}T${time}:00`)

/** Número pseudoaleatório estável (0–1) a partir de um texto: os mesmos dados a cada reinício. */
function chance(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export async function seedDemo() {
  await prisma.$transaction([
    prisma.historyEvent.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.task.deleteMany(),
    prisma.recurringRule.deleteMany(),
    prisma.onDemandActivity.deleteMany(),
    prisma.invite.deleteMany(),
    prisma.managerPermission.deleteMany(),
    prisma.blockedDay.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.user.deleteMany(),
    prisma.category.deleteMany(),
  ])

  const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 4)
  const visitor = await prisma.user.create({
    data: { name: 'Visitante', email: 'visitante@demo.local', passwordHash, role: 'ADMIN', createdAt: new Date(Date.now() - 60 * 86_400_000) },
  })
  const manager = await prisma.user.create({ data: { name: 'Marina Costa', email: 'marina@demo.local', passwordHash, role: 'MANAGER' } })

  await prisma.category.createMany({ data: CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })) })
  const categoryId = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.name, c.id]))

  await prisma.managerPermission.createMany({
    data: [
      { key: 'incidents.create', enabled: true },
      { key: 'tasks.recurring', enabled: false },
      { key: 'tasks.delete', enabled: false },
    ],
  })

  const day = today()
  const now = nowTime()
  const first = addDays(day, -45)
  const last = addDays(day, 6 - ((weekday(day) + 6) % 7)) // domingo desta semana

  const rule = await prisma.recurringRule.create({
    data: {
      title: ROUTINE[0].title,
      startTime: ROUTINE[0].start,
      endTime: ROUTINE[0].end,
      priority: 'MEDIUM',
      categoryId: categoryId[ROUTINE[0].category],
      assigneeId: visitor.id,
      createdById: visitor.id,
      pattern: 'WEEKDAYS',
      startDate: first,
    },
  })

  const tasks: Prisma.TaskCreateManyInput[] = []
  const history: { actorId: string; action: string; summary: string; detail?: string; createdAt: Date }[] = []
  let runningSet = false

  for (let date = first; date <= last; date = addDays(date, 1)) {
    const wd = weekday(date)
    if (wd === 0 || wd === 6) continue
    const slots = EXTRAS[wd] ? [...ROUTINE, EXTRAS[wd]] : ROUTINE

    for (const s of slots) {
      const r = chance(date + s.title)
      let status: TaskStatus = 'PENDING'
      let startedAt: Date | null = null
      let completedAt: Date | null = null
      let trackedSeconds = 0
      const duration = (minutes(s.end) - minutes(s.start)) * 60

      if (date < day || (date === day && s.end <= now)) {
        // Passado: quase tudo feito, com um ou outro atraso ou bloqueio.
        status = r < 0.86 ? 'DONE' : r < 0.95 ? 'PENDING' : 'BLOCKED'
        if (status === 'DONE') {
          trackedSeconds = Math.round(duration * (0.75 + chance(s.title + date) * 0.5))
          completedAt = at(date, hhmm(Math.min(minutes(s.end) + Math.round(r * 15), 23 * 60)))
        }
      } else if (date === day && s.start <= now && !runningSet) {
        // A atividade do horário atual fica em andamento, com o cronômetro rodando.
        status = 'IN_PROGRESS'
        runningSet = true
        const sinceStart = (minutes(now) - minutes(s.start)) * 60
        startedAt = new Date(Date.now() - Math.min(sinceStart, 20 * 60) * 1000)
        trackedSeconds = Math.max(0, sinceStart - 20 * 60)
      }

      tasks.push({
        title: s.title,
        description: '',
        date,
        startTime: s.start,
        endTime: s.end,
        priority: s.priority ?? 'MEDIUM',
        status,
        categoryId: categoryId[s.category],
        assigneeId: visitor.id,
        createdById: s.byManager ? manager.id : visitor.id,
        ruleId: s.rule ? rule.id : null,
        startedAt,
        trackedSeconds,
        completedAt,
        createdAt: at(addDays(date, -1), '17:00'),
      })

      if (completedAt && date >= addDays(day, -6)) {
        history.push({ actorId: visitor.id, action: 'task.status', summary: `Visitante marcou "${s.title}" como concluída`, createdAt: completedAt })
      }
      if (s.byManager && date >= addDays(day, -6) && date <= day) {
        history.push({
          actorId: manager.id,
          action: 'task.created',
          summary: `Marina Costa adicionou a tarefa "${s.title}" para Visitante`,
          detail: `${date.split('-').reverse().join('/')} às ${s.start}`,
          createdAt: at(addDays(date, -1), '17:00'),
        })
      }
    }
  }

  // Atividades sob demanda e as vezes em que aconteceram.
  for (const a of ON_DEMAND) {
    const activity = await prisma.onDemandActivity.create({
      data: {
        title: a.title,
        description: a.description,
        priority: a.priority,
        categoryId: categoryId[a.category],
        assigneeId: visitor.id,
        createdById: visitor.id,
        createdAt: at(first, '08:00'),
      },
    })
    for (let date = first; date <= day; date = addDays(date, 1)) {
      const wd = weekday(date)
      if (wd === 0 || wd === 6) continue
      const times = Math.floor(chance(a.title + date) * 3)
      for (let i = 0; i < times; i++) {
        const start = hhmm(8 * 60 + 30 + Math.floor(chance(a.title + date + i) * 8 * 60))
        if (date === day && start > now) continue
        const spent = 5 + Math.floor(chance(date + a.title + i) * 20)
        tasks.push({
          title: a.title,
          description: '',
          date,
          startTime: start,
          priority: a.priority,
          status: 'DONE',
          categoryId: categoryId[a.category],
          assigneeId: visitor.id,
          createdById: visitor.id,
          onDemandId: activity.id,
          trackedSeconds: spent * 60,
          completedAt: new Date(at(date, start).getTime() + spent * 60_000),
          createdAt: at(date, start),
        })
        if (date >= addDays(day, -6)) {
          history.push({ actorId: visitor.id, action: 'ondemand.logged', summary: `Visitante registrou "${a.title}" (sob demanda) como feita às ${start}`, createdAt: at(date, start) })
        }
      }
    }
  }

  await prisma.task.createMany({ data: tasks })

  // Conversa com a gestora e imprevistos de hoje e de dias recentes.
  const find = (title: string, date = day) => prisma.task.findFirst({ where: { title, date } })
  const project = await find('Projeto: novo portal interno')
  const inventory = await find('Atualizar inventário de equipamentos')
  const comments = [
    project && { taskId: project.id, authorId: manager.id, body: 'Conseguimos mostrar uma prévia do portal na reunião de sexta?', createdAt: at(day, '09:40') },
    project && { taskId: project.id, authorId: visitor.id, body: 'Sim! Deixo a prévia pronta até quinta.', createdAt: at(day, '09:52') },
    inventory && { taskId: inventory.id, authorId: manager.id, body: 'Inclua os notebooks novos do financeiro, por favor.', createdAt: at(day, '08:15') },
  ].filter((c) => !!c)
  await prisma.comment.createMany({ data: comments })
  for (const c of comments) {
    const who = c.authorId === manager.id ? 'Marina Costa' : 'Visitante'
    const title = c.taskId === project?.id ? project.title : inventory?.title
    history.push({ actorId: c.authorId, action: 'comment.created', summary: `${who} comentou em "${title}"`, detail: c.body, createdAt: c.createdAt })
  }

  const incidents = [
    { title: 'Queda de internet no escritório', date: day, startTime: '10:15', durationMinutes: 25, taskId: project?.id ?? null, authorId: visitor.id },
    { title: 'Reunião extra com a diretoria', date: addDays(day, -3), startTime: '14:30', durationMinutes: 40, taskId: null, authorId: manager.id },
    { title: 'Falta de energia no prédio', date: addDays(day, -12), startTime: '11:00', durationMinutes: 50, taskId: null, authorId: visitor.id },
  ].filter((i) => i.date < day || i.startTime <= now)
  await prisma.incident.createMany({ data: incidents })
  for (const i of incidents) {
    history.push({
      actorId: i.authorId,
      action: 'incident.created',
      summary: `${i.authorId === manager.id ? 'Marina Costa' : 'Visitante'} registrou um imprevisto: ${i.title}`,
      detail: `Duração: ${i.durationMinutes} min`,
      createdAt: at(i.date, i.startTime),
    })
  }

  await prisma.historyEvent.createMany({ data: history.filter((h) => h.createdAt.getTime() <= Date.now()) })
}
