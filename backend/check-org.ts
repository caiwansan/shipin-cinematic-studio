import { prisma } from './src/utils/index.js'

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, ownerId: true, plan: true },
  })
  console.log('All orgs:', JSON.stringify(orgs, null, 2))

  // Check all enterprise subscriptions
  const subs = await prisma.enterpriseSubscription.findMany({
    select: { id: true, organizationId: true, status: true },
  })
  console.log('All subs:', JSON.stringify(subs, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
