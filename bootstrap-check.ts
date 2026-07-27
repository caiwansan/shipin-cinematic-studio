import { prisma } from './src/utils/index.js'

async function main() {
  const userId = '8aed92ac-fd0e-401f-b668-b7ae6c14f1e6'
  
  // Step 1: Find user
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  console.log('1. User:', user)
  
  // Step 2: Find govUser by email
  if (user?.email) {
    const govUser = await prisma.govUser.findFirst({ where: { email: user.email }, select: { id: true, email: true, tenantId: true } })
    console.log('2. GovUser:', govUser)
    
    // Step 3: Find govOrganization by tenantId
    if (govUser?.tenantId) {
      const org = await prisma.govOrganization.findFirst({ where: { tenantId: govUser.tenantId }, select: { id: true, name: true } })
      console.log('3. GovOrganization:', org)
    }
  }
  
  // Also check if there's a govUser with tenantId f28823ce (the org's tenant)
  const govUser2 = await prisma.govUser.findFirst({ where: { tenantId: 'f28823ce-3d6c-4aef-ac1a-4e235037d528' } })
  console.log('4. GovUser for org tenant:', govUser2)
}

main().catch(console.error).finally(() => prisma.$disconnect())
