import { parseArgs } from 'node:util'
import bcrypt from 'bcryptjs'
import { withDatabase } from '../database.ts'
import { prisma } from '../db.ts'

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    email: { type: 'string' },
    password: { type: 'string' },
  },
})

if (!values.name || !values.email || !values.password) {
  console.error('Uso: npm run admin:create -w server -- --name "Seu nome" --email voce@email.com --password "senha"')
  process.exit(1)
}
if (values.password.length < 8) {
  console.error('A senha precisa ter pelo menos 8 caracteres.')
  process.exit(1)
}

const { name, password } = values
const email = values.email.trim().toLowerCase()

await withDatabase(async () => {
  if (await prisma.user.findUnique({ where: { email } })) {
    console.error(`Já existe um usuário com o e-mail ${email}.`)
    process.exitCode = 1
    return
  }
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'ADMIN',
    },
  })
  console.log(`Admin criado: ${user.name} <${user.email}>`)
  await prisma.$disconnect()
})
