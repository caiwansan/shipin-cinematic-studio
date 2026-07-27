import { prisma } from './src/utils/index.js'

async function main() {
  const email = 'admin'
  
  // Check User table
  const users = await prisma.user.findMany({
    where: { OR: [{ email: { contains: 'admin' } }, { username: 'admin' }] },
    select: { id: true, email: true, username: true },
  })
  console.log('User table:', users)
  
  // Check govUser table
  const govUser = await prisma.govUser.findFirst({
    where: { tenantId: 'f28823ce-3d6c-4aef-ac1a-4e235037d528' },
    select: { id: true, email: true, tenantId: true, roles: true },
  })
  console.log('GovUser for org f28823ce:', govUser)
  
  // Check all govUsers for admin
  const govUsers = await prisma.govUser.findMany({
    where: { OR: [{ email: { contains: 'admin' } }] },
    select: { id: true, email: true, tenantId: true },
    take: 5,
  })
  console.log('GovUsers with admin:', govUsers)
  
  // govOrg
  const org = await prisma.govOrganization.findUnique({
    where: { id: 'd4568766-935c-4304-b454-fd4ba01dcca9' },
    select: { id: true, name: true, tenantId: true },
  })
  console.log('GovOrg:', org)
}

main().catch(console.error).finally(() => prisma.$disconnect())
