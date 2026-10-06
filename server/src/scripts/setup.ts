// Primeira instalação: liga o banco, aplica as migrações e cria as categorias padrão.
import { migrate, withDatabase } from '../database.ts'

await withDatabase(async () => {
  migrate()
  await import('./seed.ts')
})
console.log('Banco pronto.')
