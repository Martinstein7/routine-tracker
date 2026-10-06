import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.ts'
import { env } from '../env.ts'
import { authenticate } from '../lib/auth.ts'
import { badRequest, notFound } from '../lib/errors.ts'
import { record } from '../lib/history.ts'
import { assertCan, isOptionalPermission, managerPermissions, OPTIONAL_PERMISSIONS } from '../lib/permissions.ts'
import { broadcast } from '../lib/realtime.ts'
import { hashToken } from './auth.ts'

const INVITE_DAYS = 7

const inviteBody = z.object({
  role: z.enum(['ADMIN', 'MANAGER']),
  name: z.string().trim().max(80).optional().transform((v) => v || null),
  email: z
    .union([z.literal(''), z.email('E-mail inválido.')])
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : null)),
})

const userPatch = z.object({ active: z.boolean() })

const permissionsBody = z.record(z.string(), z.boolean())

const categoryBody = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.'),
})

export async function adminRoutes(app: FastifyInstance) {
  // Listas usadas pelas duas pessoas (nomes nos seletores e nas tarefas).
  app.get('/api/users', { preHandler: authenticate }, async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } })
    return users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }))
  })

  app.get('/api/categories', { preHandler: authenticate }, async () => {
    return prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  })

  app.get('/api/config', { preHandler: authenticate }, async () => ({ publicUrl: env.publicUrl }))

  // Daqui para baixo, só o admin.
  app.register(async (admin) => {
    admin.addHook('preHandler', authenticate)
    admin.addHook('preHandler', async (request) => assertCan(request.me, 'admin'))

    admin.get('/api/admin/invites', async () => {
      const invites = await prisma.invite.findMany({
        where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      })
      return invites.map(({ tokenHash: _, ...i }) => i)
    })

    admin.post('/api/admin/invites', async (request) => {
      const body = inviteBody.parse(request.body)
      if (body.email && (await prisma.user.findUnique({ where: { email: body.email } }))) {
        throw badRequest('Já existe uma conta com este e-mail.')
      }
      const token = randomBytes(32).toString('base64url')
      const invite = await prisma.invite.create({
        data: {
          tokenHash: hashToken(token),
          role: body.role,
          name: body.name,
          email: body.email,
          createdById: request.me.id,
          expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
        },
      })
      const roleName = body.role === 'ADMIN' ? 'admin' : 'gestora'
      await record({
        actorId: request.me.id,
        action: 'invite.created',
        summary: `${request.me.name} gerou um convite de ${roleName}${body.name ? ` para ${body.name}` : ''}`,
      })
      return { id: invite.id, link: `${env.publicUrl}/convite/${token}`, expiresAt: invite.expiresAt }
    })

    admin.delete<{ Params: { id: string } }>('/api/admin/invites/:id', async (request) => {
      await prisma.invite.update({ where: { id: request.params.id }, data: { revokedAt: new Date() } })
      return { ok: true }
    })

    admin.patch<{ Params: { id: string } }>('/api/admin/users/:id', async (request) => {
      const { active } = userPatch.parse(request.body)
      if (request.params.id === request.me.id) throw badRequest('Você não pode desativar a própria conta.')
      const user = await prisma.user.update({ where: { id: request.params.id }, data: { active } })
      await record({
        actorId: request.me.id,
        action: active ? 'user.activated' : 'user.deactivated',
        summary: `${request.me.name} ${active ? 'reativou' : 'desativou'} o acesso de ${user.name}`,
      })
      broadcast(['users'], request.me.id)
      return { ok: true }
    })

    admin.get('/api/admin/permissions', async () => {
      const values = await managerPermissions()
      return Object.entries(OPTIONAL_PERMISSIONS).map(([key, label]) => ({
        key,
        label,
        enabled: values[key as keyof typeof values],
      }))
    })

    admin.put('/api/admin/permissions', async (request) => {
      const body = permissionsBody.parse(request.body)
      const before = await managerPermissions()
      const changes: string[] = []
      for (const [key, enabled] of Object.entries(body)) {
        if (!isOptionalPermission(key)) continue
        await prisma.managerPermission.upsert({ where: { key }, update: { enabled }, create: { key, enabled } })
        if (before[key] !== enabled) changes.push(`${OPTIONAL_PERMISSIONS[key]}: ${enabled ? 'liberado' : 'bloqueado'}`)
      }
      if (changes.length) {
        await record({
          actorId: request.me.id,
          action: 'permissions.updated',
          summary: `${request.me.name} alterou as permissões da gestora`,
          detail: changes.join('\n'),
        })
      }
      broadcast(['permissions'], request.me.id)
      return { ok: true }
    })

    admin.post('/api/admin/categories', async (request) => {
      const body = categoryBody.parse(request.body)
      if (await prisma.category.findUnique({ where: { name: body.name } })) throw badRequest('Já existe uma categoria com este nome.')
      const last = await prisma.category.aggregate({ _max: { sortOrder: true } })
      const category = await prisma.category.create({ data: { ...body, sortOrder: (last._max.sortOrder ?? 0) + 1 } })
      broadcast(['categories'], request.me.id)
      return category
    })

    admin.patch<{ Params: { id: string } }>('/api/admin/categories/:id', async (request) => {
      const body = categoryBody.parse(request.body)
      const clash = await prisma.category.findUnique({ where: { name: body.name } })
      if (clash && clash.id !== request.params.id) throw badRequest('Já existe uma categoria com este nome.')
      const category = await prisma.category.update({ where: { id: request.params.id }, data: body })
      broadcast(['categories', 'tasks'], request.me.id)
      return category
    })

    admin.delete<{ Params: { id: string } }>('/api/admin/categories/:id', async (request) => {
      const category = await prisma.category.findUnique({ where: { id: request.params.id } })
      if (!category) throw notFound()
      await prisma.category.delete({ where: { id: category.id } })
      broadcast(['categories', 'tasks'], request.me.id)
      return { ok: true }
    })

    // Backup em JSON com tudo, menos senhas e tokens.
    admin.get('/api/admin/export', async (_request, reply) => {
      const [users, categories, tasks, rules, comments, incidents, history, permissions] = await Promise.all([
        prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } }),
        prisma.category.findMany(),
        prisma.task.findMany(),
        prisma.recurringRule.findMany(),
        prisma.comment.findMany(),
        prisma.incident.findMany(),
        prisma.historyEvent.findMany(),
        prisma.managerPermission.findMany(),
      ])
      const stamp = new Date().toISOString().slice(0, 10)
      reply.header('Content-Disposition', `attachment; filename="routine-tracker-backup-${stamp}.json"`)
      return { exportedAt: new Date().toISOString(), users, categories, tasks, rules, comments, incidents, history, permissions }
    })
  })
}
