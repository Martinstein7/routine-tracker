import type { FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../db.ts'
import type { User } from '../generated/prisma/client.ts'
import { HttpError } from './errors.ts'

export const SESSION_COOKIE = 'rt_session'
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
