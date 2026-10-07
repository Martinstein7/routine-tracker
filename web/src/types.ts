export type Role = 'ADMIN' | 'MANAGER'
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'BLOCKED' | 'DONE'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
export type Recurrence = 'DAILY' | 'WEEKDAYS' | 'WEEKLY'

export type PermissionKey =
  | 'admin'
  | 'tasks.createOwn'
  | 'tasks.delete'
  | 'tasks.changeCategory'
  | 'incidents.create'
  | 'tasks.recurring'

export type Me = { id: string; name: string; email: string; role: Role }
export type Permissions = Record<PermissionKey, boolean>

export type UserSummary = { id: string; name: string; role: Role }
export type User = UserSummary & { email: string; active: boolean }

export type Category = { id: string; name: string; color: string; sortOrder: number }

export type Task = {
  id: string
  title: string
  description: string
  date: string
  startTime: string
  endTime: string | null
  priority: Priority
  status: TaskStatus
  categoryId: string | null
  category: Category | null
  assigneeId: string
  assignee: UserSummary
  createdById: string
  createdBy: UserSummary
  ruleId: string | null
  onDemandId: string | null
  rule: { id: string; pattern: Recurrence; active: boolean } | null
  startedAt: string | null
  trackedSeconds: number
  completedAt: string | null
  createdAt: string
  _count: { comments: number }
}

export type OnDemandActivity = {
  id: string
  title: string
  description: string
  priority: Priority
  categoryId: string | null
  category: Category | null
  assigneeId: string
  todayCount: number
  lastTime: string | null
}

export type BlockRepeat = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY'
export type BlockRule = { id: string; reason: string; pattern: BlockRepeat; startDate: string; endDate: string | null }

export type BlockedDays = {
  weekends: boolean
  days: { date: string; reason: string; createdBy: string }[]
  rules: BlockRule[]
}

export type Comment = { id: string; taskId: string; body: string; createdAt: string; author: UserSummary }

export type Incident = {
  id: string
  title: string
  description: string
  date: string
  startTime: string
  durationMinutes: number
  taskId: string | null
  task: { id: string; title: string } | null
  author: UserSummary
  createdAt: string
}

export type HistoryEvent = {
  id: string
  action: string
  summary: string
  detail: string
  taskId: string | null
  createdAt: string
  editedAt: string | null
  actor: UserSummary | null
}

export type Report = {
  from: string
  to: string
  total: number
  done: number
  completionRate: number
  overdue: number
  trackedSeconds: number
  byStatus: Record<TaskStatus, number>
  byPriority: Record<Priority, number>
  byCategory: { id: string | null; name: string; color: string; total: number; done: number; trackedSeconds: number }[]
  byDay: { date: string; total: number; done: number }[]
  incidents: { count: number; minutes: number }
}

export type Invite = { id: string; role: Role; name: string | null; email: string | null; expiresAt: string; createdAt: string }
