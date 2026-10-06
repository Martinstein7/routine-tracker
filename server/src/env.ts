import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

if (existsSync('.env')) process.loadEnvFile('.env')

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável ${name} não definida em server/.env`)
  return value
}

function lanAddress(): string | undefined {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
}

const port = Number(process.env.PORT ?? 3000)

export const env = {
  databaseUrl: required('DATABASE_URL'),
  embeddedDb: process.env.EMBEDDED_DB !== 'false',
  jwtSecret: required('JWT_SECRET'),
  port,
  host: process.env.HOST ?? '0.0.0.0',
  publicUrl: process.env.PUBLIC_URL || `http://${lanAddress() ?? 'localhost'}:${port}`,
}
