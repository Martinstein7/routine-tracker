import { prisma } from '../db.ts'
import type { User } from '../generated/prisma/client.ts'
import { forbidden } from './errors.ts'

// Funções marcadas como ⚪ na tabela: a gestora só pode usar se o admin liberar.
export const OPTIONAL_PERMISSIONS = {
  'tasks.createOwn': 'Criar tarefas próprias',
  'tasks.delete': 'Excluir tarefas',
  'tasks.changeCategory': 'Alterar categoria',
  'incidents.create': 'Registrar imprevistos',
  'tasks.recurring': 'Criar tarefas recorrentes',
} as const

export type OptionalPermission = keyof typeof OPTIONAL_PERMISSIONS
export type Permission = OptionalPermission | 'admin'

export function isOptionalPermission(key: string): key is OptionalPermission {
  return key in OPTIONAL_PERMISSIONS
}

export async function managerPermissions(): Promise<Record<OptionalPermission, boolean>> {
  const rows = await prisma.managerPermission.findMany()
  const enabled = new Set(rows.filter((r) => r.enabled).map((r) => r.key))
  const out = {} as Record<OptionalPermission, boolean>
  for (const key of Object.keys(OPTIONAL_PERMISSIONS) as OptionalPermission[]) out[key] = enabled.has(key)
  return out
}

export async function permissionsFor(user: Pick<User, 'role'>): Promise<Record<Permission, boolean>> {
  if (user.role === 'ADMIN') {
    const all = { admin: true } as Record<Permission, boolean>
    for (const key of Object.keys(OPTIONAL_PERMISSIONS) as OptionalPermission[]) all[key] = true
    return all
  }
  return { admin: false, ...(await managerPermissions()) }
}

export async function can(user: Pick<User, 'role'>, permission: Permission): Promise<boolean> {
  if (user.role === 'ADMIN') return true
  if (permission === 'admin') return false
  const row = await prisma.managerPermission.findUnique({ where: { key: permission } })
  return row?.enabled ?? false
}

export async function assertCan(user: Pick<User, 'role'>, permission: Permission): Promise<void> {
  if (!(await can(user, permission))) throw forbidden()
}
