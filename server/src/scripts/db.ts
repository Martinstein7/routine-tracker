// Mantém o PostgreSQL embutido ligado durante o desenvolvimento (Ctrl+C desliga).
import { ensureDatabase } from '../database.ts'

const stop = await ensureDatabase()
if (!stop) {
  console.log('O banco já está no ar.')
  process.exit(0)
}

console.log('Banco no ar. Ctrl+C para desligar.')
const shutdown = async () => {
  await stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
setInterval(() => {}, 1 << 30)
