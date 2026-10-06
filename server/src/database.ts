import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { env } from './env.ts'

// PostgreSQL embutido: roda na própria máquina, só em localhost, com os dados em server/.pgdata
// (a demonstração usa server/.pgdata-demo).
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url))
const DATA_DIR = join(SERVER_DIR, env.pgDataDir)

async function isReachable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: env.databaseUrl, connectionTimeoutMillis: 1500 })
  try {
    await client.connect()
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => {})
  }
}

async function startEmbedded(): Promise<() => Promise<void>> {
  const url = new URL(env.databaseUrl)
  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    persistent: true,
    // Sem isso o Windows cria o banco em WIN1252 e recusa caracteres como "→".
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    onLog: () => {},
    onError: (e) => console.error(e),
  })

  if (!existsSync(join(DATA_DIR, 'PG_VERSION'))) {
    console.log('Criando o banco de dados pela primeira vez…')
    await server.initialise()
  }
  await server.start()

  const name = url.pathname.slice(1)
  const client = server.getPgClient('postgres')
  await client.connect()
  const found = await client.query('select 1 from pg_database where datname = $1', [name])
  await client.end()
  if (!found.rowCount) await server.createDatabase(name)

  return () => server.stop()
}

/** Garante que o banco está no ar. Se precisou ligar o embutido, devolve a função que o desliga. */
export async function ensureDatabase(): Promise<(() => Promise<void>) | null> {
  if (await isReachable()) return null
  if (!env.embeddedDb) throw new Error(`Não foi possível conectar ao banco em ${env.databaseUrl}`)
  return startEmbedded()
}

export function migrate() {
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { cwd: SERVER_DIR, stdio: 'inherit' })
}

/** Roda uma tarefa com o banco ligado e desliga no fim, se foi ele quem ligou. */
export async function withDatabase(task: () => Promise<void>) {
  const stop = await ensureDatabase()
  try {
    await task()
  } finally {
    await stop?.()
  }
}
