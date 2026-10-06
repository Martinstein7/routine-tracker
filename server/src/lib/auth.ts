import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db.ts'
import { env } from '../env.ts'
import type { User } from '../generated/prisma/client.ts'
import { HttpError } from './errors.ts'

// localhost:3000 e localhost:3001 compartilham cookies: a demonstração usa outro nome para nunca tocar na sessão real.
export const SESSION_COOKIE = env.demo ? 'rt_demo_session' : 'rt_session'
export const SESSION_DAYS = 30

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    user: { sub: string }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    me: User
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  // Na demonstração não há login: todo visitante entra como o admin fictício.
  if (env.demo) {
    const visitor = await prisma.user.findFirst({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' } })
    if (!visitor) throw new HttpError(503, 'A demonstração está sendo preparada. Tente de novo em instantes.')
    request.me = visitor
    return
  }
  try {
    await request.jwtVerify()
  } catch {
    throw new HttpError(401, 'Sua sessão expirou. Entre novamente.')
  }
  const user = await prisma.user.findUnique({ where: { id: request.user.sub } })
  if (!user || !user.active) throw new HttpError(401, 'Sua sessão expirou. Entre novamente.')
  request.me = user
}

export function publicUser(u: Pick<User, 'id' | 'name' | 'email' | 'role'>) {
  return { id: u.id, name: u.name, email: u.email, role: u.role }
}
