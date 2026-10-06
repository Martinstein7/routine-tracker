import { prisma } from '../db.ts'

const categories = [
  { name: 'Suporte', color: '#3b82f6' },
  { name: 'Manutenção', color: '#14b8a6' },
  { name: 'Projetos', color: '#8b5cf6' },
  { name: 'Reuniões', color: '#f59e0b' },
  { name: 'Administrativo', color: '#64748b' },
  { name: 'Pausa', color: '#a3a3a3' },
  { name: 'Outros', color: '#ec4899' },
]

for (const [i, c] of categories.entries()) {
  await prisma.category.upsert({
    where: { name: c.name },
    update: {},
    create: { ...c, sortOrder: i },
  })
}

console.log(`Categorias prontas: ${categories.map((c) => c.name).join(', ')}`)
await prisma.$disconnect()
