/**
 * Debug: 逐个测试 Tool Registry 中的工具
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const TENANT_ID = '5ba4891a-511f-4620-8862-7dc83f37ea75'

async function main() {
  console.log('=== Debug Tool Chain ===\n')

  // 1. 检查 enterpriseJobWorkspace 表
  console.log('--- enterpriseJobWorkspace ---')
  const workspaces = await (prisma as any).enterpriseJobWorkspace.findMany({
    where: { tenantId: TENANT_ID },
    select: { id: true, enterpriseId: true },
  })
  console.log(`By tenantId: ${workspaces.length} records`)
  if (workspaces.length > 0) {
    console.log(`  First: id=${workspaces[0].id}, enterpriseId=${workspaces[0].enterpriseId}`)
  }

  // 也试试 enterpriseId = tenantId
  const ws2 = await (prisma as any).enterpriseJobWorkspace.findMany({
    where: { enterpriseId: TENANT_ID },
    select: { id: true, enterpriseId: true },
  })
  console.log(`By enterpriseId=tenantId: ${ws2.length} records`)

  // 2. 检查 enterpriseProfile
  console.log('\n--- enterpriseProfile ---')
  const profile = await (prisma as any).enterpriseProfile.findFirst({
    where: { organizationId: TENANT_ID },
    select: { id: true, organizationId: true },
  })
  console.log(`Profile: ${profile?.id || 'NOT FOUND'}`)
  if (profile) {
    const ws3 = await (prisma as any).enterpriseJobWorkspace.findMany({
      where: { enterpriseId: profile.id },
      select: { id: true, enterpriseId: true },
    })
    console.log(`Workspaces by profile.id: ${ws3.length}`)
  }

  // 3. 检查 JobPosting
  console.log('\n--- JobPosting ---')
  const jobsByEnterprise = await (prisma as any).jobPosting.findMany({
    where: { enterpriseId: TENANT_ID },
    select: { id: true, title: true },
    take: 3,
  })
  console.log(`Jobs by enterpriseId=tenantId: ${jobsByEnterprise.length}`)
  for (const j of jobsByEnterprise) console.log(`  - ${j.title}`)

  // 4. 检查 CandidateMatch
  console.log('\n--- CandidateMatch ---')
  const matches = await (prisma as any).candidateMany.findMany({ take: 1 }).catch(() => [])
  console.log(`CandidateMany: ${matches.length}`)
  
  const matchTable = await (prisma as any).candidateMatch.findMany({
    take: 3,
    select: { id: true, matchScore: true, workspaceId: true },
  })
  console.log(`CandidateMatch: ${matchTable.length}`)
  for (const m of matchTable) console.log(`  - score=${m.matchScore}, ws=${m.workspaceId}`)

  // 5. 检查 RecruitmentPipeline
  console.log('\n--- RecruitmentPipeline ---')
  const pipelines = await (prisma as any).recruitmentPipeline.findMany({
    take: 3,
    select: { id: true, candidateName: true, stage: true, workspaceId: true },
  })
  console.log(`RecruitmentPipeline: ${pipelines.length}`)
  for (const p of pipelines) console.log(`  - ${p.candidateName} (${p.stage}), ws=${p.workspaceId}`)

  // 6. 测试 read_recruitment_data 工具的错误捕获
  console.log('\n--- Test read tool error capture ---')
  try {
    const { ToolRegistry } = await import('../src/services/enterprise/workflow/tool-registry')
    const registry = new ToolRegistry(prisma as any)
    const readTool = registry.getTool('read_recruitment_data')
    if (readTool) {
      const ctx = {
        prisma: prisma as any,
        tenantId: TENANT_ID,
        userId: '6d503a67-ba62-4f12-a5c0-54352a1bbdf0',
        agentId: '97961352-0cd2-4817-b9cc-930cedcfeec9',
        agentInstanceId: '1fd7b20d-407e-46e9-8ccb-3f7a9ef4e2d9',
        memoryNamespace: `tenant/${TENANT_ID}/agent/1fd7b20d-407e-46e9-8ccb-3f7a9ef4e2d9`,
      }
      const result = await readTool.execute(ctx, { dataType: 'all', limit: 50 })
      console.log(`Result: success=${result.success}, error=${result.error}`)
      console.log(`Sources: ${result.sources.join(', ')}`)
      if (result.data) {
        console.log(`Data keys: ${Object.keys(result.data).join(', ')}`)
        for (const [k, v] of Object.entries(result.data)) {
          console.log(`  ${k}: ${Array.isArray(v) ? v.length : typeof v}`)
        }
      }
    }
  } catch (err: any) {
    console.error(`Direct call error: ${err.message}`)
    console.error(err.stack)
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Debug Error:', err.message)
  process.exit(1)
})
