import { PrismaClient } from '@prisma/client'
import { LeadIntelligenceService } from '/root/shipin-cinematic-studio/backend/src/services/enterprise/lead-intelligence.service.ts'

async function main() {
  const prisma = new PrismaClient()
  const leadService = new LeadIntelligenceService()
  const TENANT_ID = '4ecfe9d8-6fc7-4909-bee4-af9a07ce05a9'

  const users = await prisma.enterpriseInteraction.findMany({
    where: { tenantId: TENANT_ID },
    select: { platform: true, platformUserId: true },
    distinct: ['platform', 'platformUserId']
  })

  console.log(`Found ${users.length} unique users to analyze`)

  let leadsCreated = 0
  for (const user of users) {
    const lead = await leadService.analyzeLead({
      tenantId: TENANT_ID,
      platform: user.platform,
      platformUserId: user.platformUserId,
      customerName: `用户_${user.platformUserId.slice(-6)}`,
      industry: '其他'
    })
    if (lead) leadsCreated++
  }

  console.log(`Leads created/updated: ${leadsCreated}`)

  const total = await prisma.enterpriseLeadIntelligence.count({ where: { tenantId: TENANT_ID } })
  const hot = await prisma.enterpriseLeadIntelligence.count({ where: { tenantId: TENANT_ID, temperature: { in: ['hot', 'customer'] } } })
  console.log(`Total leads: ${total}, Hot+Customer: ${hot}`)

  await prisma.$disconnect()
}

main().catch(console.error)
