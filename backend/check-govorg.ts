import { prisma } from './src/utils/index.js'

async function main() {
  const govOrg = await prisma.govOrganization.findUnique({ where: { id: 'd4568766-935c-4304-b454-fd4ba01dcca9' } })
  console.log('GovOrg d4568766 found:', govOrg ? 'YES' : 'NO')
  if (govOrg) console.log('Name:', govOrg.name, 'TenantId:', govOrg.tenantId)
  
  const govOrgs = await prisma.govOrganization.findMany({ select: { id: true, name: true, tenantId: true } })
  console.log('All govOrgs:', JSON.stringify(govOrgs, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
