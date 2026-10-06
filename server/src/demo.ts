// Demonstração para apresentar o projeto: `npm run demo`.
// Roda ao lado do sistema real, sem tocar nele: outra porta, outro banco embutido e outra pasta de dados.
// As variáveis definidas aqui valem mais que as do server/.env (o .env não sobrescreve o que já existe).
import { randomBytes } from 'node:crypto'

process.env.DEMO = 'true'
process.env.PORT = process.env.DEMO_PORT ?? '3001'
process.env.DATABASE_URL = 'postgresql://routine:routine@localhost:5434/routine_demo'
process.env.EMBEDDED_DB = 'true'
process.env.PG_DATA_DIR = '.pgdata-demo'
process.env.JWT_SECRET = randomBytes(32).toString('hex')
process.env.PUBLIC_URL = ''

await import('./index.ts')
