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
// Endereço público: o definido no .env; senão o que a hospedagem informa (Render, Railway); senão o IP na rede.
const publicUrl =
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`) ||
  `http://${lanAddress() ?? 'localhost'}:${port}`

export const env = {
  databaseUrl: required('DATABASE_URL'),
  embeddedDb: process.env.EMBEDDED_DB !== 'false',
  jwtSecret: required('JWT_SECRET'),
  port,
  host: process.env.HOST ?? '0.0.0.0',
  // Demonstração: entra sem login, com dados fictícios num banco à parte (ver src/demo.ts).
  demo: process.env.DEMO === 'true',
  pgDataDir: process.env.PG_DATA_DIR ?? '.pgdata',
  publicUrl,
  // Na nuvem o site fica atrás do proxy da hospedagem: confiar nele para saber o IP real de quem acessa.
  trustProxy: process.env.TRUST_PROXY === 'true',
  // Com endereço https, o cookie de login só trafega por conexão segura.
  secureCookies: publicUrl.startsWith('https://'),
}
