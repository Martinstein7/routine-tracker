import Fastify from 'fastify'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

const app = Fastify({ logger: { level: 'info' } })

app.get('/api/health', async () => ({ ok: true }))

await app.listen({ port: PORT, host: HOST })
