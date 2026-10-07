// Copia todos os dados do banco local para outro PostgreSQL (ex.: o da nuvem):
//   npm run data:copy -w server -- "postgresql://usuario:senha@host:porta/banco"
// O destino recebe as tabelas (migrações) e os dados numa única transação: ou copia tudo, ou nada.
// Recusa se o destino já tiver usuários, para não duplicar nem misturar dados.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { withDatabase } from '../database.ts'
import { env } from '../env.ts'

const target = process.argv[2]
if (!target?.startsWith('postgres')) {
  console.error('Uso: npm run data:copy -w server -- "postgresql://usuario:senha@host:porta/banco"')
  process.exit(1)
}

// Ordem que respeita as ligações entre tabelas (quem é referenciado vem antes).
const TABLES = [
  'User',
  'Category',
  'ManagerPermission',
  'Setting',
  'Invite',
  'RecurringRule',
  'OnDemandActivity',
  'BlockedDay',
  'BlockRule',
  'Task',
  'Comment',
  'Incident',
  'HistoryEvent',
]

const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url))

await withDatabase(async () => {
  console.log('Preparando as tabelas no destino…')
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: SERVER_DIR,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: target },
  })

  const source = new pg.Client({ connectionString: env.databaseUrl })
  const dest = new pg.Client({ connectionString: target })
  await source.connect()
  await dest.connect()
  try {
    const existing = await dest.query('select count(*)::int as n from "User"')
    if (existing.rows[0].n > 0) throw new Error('O destino já tem usuários. Para não misturar dados, a cópia só roda num banco vazio.')

    await dest.query('begin')
    for (const table of TABLES) {
      const { rows, fields } = await source.query(`select * from "${table}"`)
      if (!rows.length) {
        console.log(`  ${table}: vazio`)
        continue
      }
      const columns = fields.map((f) => f.name)
      // Colunas JSON (ex.: tema) voltam como objeto do pg e precisam ir como texto.
      const jsonColumns = new Set(fields.filter((f) => f.dataTypeID === 3802 || f.dataTypeID === 114).map((f) => f.name))
      const list = columns.map((c) => `"${c}"`).join(', ')
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200)
        const values: unknown[] = []
        const tuples = batch.map((row) => {
          const params = columns.map((c) => {
            const v = row[c]
            values.push(jsonColumns.has(c) && v !== null ? JSON.stringify(v) : v)
            return `$${values.length}`
          })
          return `(${params.join(', ')})`
        })
        await dest.query(`insert into "${table}" (${list}) values ${tuples.join(', ')}`, values)
      }
      console.log(`  ${table}: ${rows.length}`)
    }
    await dest.query('commit')
    console.log('Dados copiados.')
  } catch (e) {
    await dest.query('rollback').catch(() => {})
    console.error(`Cópia cancelada, nada foi gravado no destino: ${e instanceof Error ? e.message : e}`)
    process.exitCode = 1
  } finally {
    await source.end()
    await dest.end()
  }
})
