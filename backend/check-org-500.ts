import { prisma } from './src/utils/index.js'

async function main() {
  const org = await prisma.organization.findUnique({ where: { id: 'd4568766-935c-4304-b454-fd4ba01dcca9' } })
  console.log('Org d4568766 found:', org ? 'YES' : 'NO')
  if (org) console.log('Owner:', org.ownerId)
  
  const orgs = await prisma.organization.findMany({ select: { id: true, ownerId: true } })
  console.log('All orgs:', JSON.stringify(orgs, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
