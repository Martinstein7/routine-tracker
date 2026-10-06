import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.ts'
import { authenticate, publicUser, SESSION_COOKIE, SESSION_DAYS } from '../lib/auth.ts'
import { badRequest, HttpError } from '../lib/errors.ts'
import { record } from '../lib/history.ts'
import { permissionsFor } from '../lib/permissions.ts'
import { broadcast } from '../lib/realtime.ts'

const loginBody = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe o e-mail.'),
  password: z.string().min(1, 'Informe a senha.'),
})

const acceptBody = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.email('E-mail inválido.').trim().toLowerCase(),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
})

// Limite simples contra tentativas repetidas: 10 erros a cada 15 minutos por IP.
const failures = new Map<string, { count: number; until: number }>()
const WINDOW_MS = 15 * 60 * 1000

function checkRate(ip: string) {
  const entry = failures.get(ip)
  if (entry && entry.until > Date.now() && entry.count >= 10) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente de novo.')
  }
}

function registerFailure(ip: string) {
  const entry = failures.get(ip)
  if (!entry || entry.until < Date.now()) failures.set(ip, { count: 1, until: Date.now() + WINDOW_MS })
  else entry.count++
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function authRoutes(app: FastifyInstance) {
  const setSession = (reply: import('fastify').FastifyReply, userId: string) => {
    const token = app.jwt.sign({ sub: userId }, { expiresIn: `${SESSION_DAYS}d` })
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    })
  }

  app.post('/api/auth/login', async (request, reply) => {
    checkRate(request.ip)
    const { email, password } = loginBody.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email } })
    const ok = user && user.active && (await bcrypt.compare(password, user.passwordHash))
    if (!ok) {
      registerFailure(request.ip)
      throw new HttpError(401, 'E-mail ou senha incorretos.')
    }
    failures.delete(request.ip)
    setSession(reply, user.id)
    return { user: publicUser(user) }
  })

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  })

  app.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
    return { user: publicUser(request.me), permissions: await permissionsFor(request.me) }
  })

  // Convites: a página de criação de conta só funciona com um link válido.
  async function findInvite(token: string) {
    const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(token) } })
    if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt < new Date()) return null
    return invite
  }

  app.get<{ Params: { token: string } }>('/api/invites/:token', async (request) => {
    const invite = await findInvite(request.params.token)
    if (!invite) throw new HttpError(404, 'Este link de convite é inválido, já foi usado ou expirou.')
    return { role: invite.role, name: invite.name, email: invite.email }
  })

  app.post<{ Params: { token: string } }>('/api/invites/:token/accept', async (request, reply) => {
    const invite = await findInvite(request.params.token)
    if (!invite) throw new HttpError(404, 'Este link de convite é inválido, já foi usado ou expirou.')
    const body = acceptBody.parse(request.body)
    if (invite.email && invite.email !== body.email) throw badRequest('Use o e-mail para o qual o convite foi criado.')
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw badRequest('Já existe uma conta com este e-mail.')

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: body.name,
          email: body.email,
          passwordHash: await bcrypt.hash(body.password, 12),
          role: invite.role,
        },
      })
      await tx.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } })
      return created
    })

    await record({ actorId: user.id, action: 'user.joined', summary: `${user.name} criou a conta pelo convite` })
    broadcast(['users'], user.id)
    setSession(reply, user.id)
    return { user: publicUser(user) }
  })
}
