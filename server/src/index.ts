import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import fastifyStatic from '@fastify/static'
import fastifyWebsocket from '@fastify/websocket'
import Fastify from 'fastify'
import { ZodError } from 'zod'
import { ensureDatabase, migrate } from './database.ts'
import { prisma } from './db.ts'
import { env } from './env.ts'
import { authenticate, SESSION_COOKIE } from './lib/auth.ts'
import { demoStatus, scheduleReset, seedDemo } from './lib/demo.ts'
import { HttpError } from './lib/errors.ts'
import { addClient } from './lib/realtime.ts'
import { adminRoutes } from './routes/admin.ts'
import { activityRoutes } from './routes/activity.ts'
import { authRoutes } from './routes/auth.ts'
import { blockedDayRoutes } from './routes/blockedDays.ts'
import { onDemandRoutes } from './routes/onDemand.ts'
import { reportRoutes } from './routes/reports.ts'
import { taskRoutes } from './routes/tasks.ts'

// Em desenvolvimento o banco roda à parte (npm run db). Em produção, o servidor liga tudo.
const isDev = process.argv.includes('--dev')
const stopDatabase = isDev ? null : await ensureDatabase()
if (!isDev) migrate()
if (env.demo) {
  console.log('Preparando os dados da demonstração…')
  await seedDemo()
}

const app = Fastify({ logger: { level: 'info' }, trustProxy: env.trustProxy })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close()
    await stopDatabase?.()
    process.exit(0)
  })
}

await app.register(fastifyCookie)
await app.register(fastifyJwt, { secret: env.jwtSecret, cookie: { cookieName: SESSION_COOKIE, signed: false } })
await app.register(fastifyWebsocket)

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({ message: error.issues[0]?.message ?? 'Dados inválidos.' })
  }
  if (error instanceof HttpError) {
    return reply.status(error.status).send({ message: error.message })
  }
  const status = (error as { statusCode?: number }).statusCode
  if (status && status >= 400 && status < 500) {
    return reply.status(status).send({ message: 'Requisição inválida.' })
  }
  request.log.error(error)
  return reply.status(500).send({ message: 'Erro inesperado no servidor. Tente de novo.' })
})

app.get('/api/health', async () => ({ ok: true }))
app.get('/api/demo', async () => demoStatus())

// Demonstração: qualquer alteração bem-sucedida agenda a volta ao padrão (10 minutos depois da primeira).
if (env.demo) {
  app.addHook('onResponse', async (request, reply) => {
    if (request.method !== 'GET' && request.url.startsWith('/api/') && reply.statusCode < 400) scheduleReset((msg) => app.log.info(msg))
  })
}

app.get('/api/ws', { websocket: true, preHandler: authenticate }, (socket) => addClient(socket))

await app.register(authRoutes)
await app.register(adminRoutes)
await app.register(taskRoutes)
await app.register(activityRoutes)
await app.register(onDemandRoutes)
await app.register(blockedDayRoutes)
await app.register(reportRoutes)

// Em produção, o mesmo servidor entrega o site já compilado (web/dist).
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url))
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist })
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) return reply.status(404).send({ message: 'Não encontrado.' })
    return reply.sendFile('index.html')
  })
}

await app.listen({ port: env.port, host: env.host })
app.log.info(`Acesso local: http://localhost:${env.port}`)
app.log.info(`Acesso na rede: ${env.publicUrl}`)
if (!env.demo && (await prisma.user.count()) === 0) {
  app.log.info(`Nenhum admin ainda. Crie o seu em: http://localhost:${env.port}/primeiro-acesso`)
}
