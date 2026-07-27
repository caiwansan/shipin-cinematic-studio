/**
 * Reality Gate: Dashboard DB Logic Test
 * 验证 Dashboard API 的数据库查询逻辑（避开崩溃的 hdz 路由）
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ENTERPRISE_ID = '5ba4891a-511f-4620-8862-7dc83f37ea75'

async function main() {
  console.log('=== Dashboard DB Logic Test ===\n')

  // 1. 企业空间
  const workspace = await prisma.enterpriseJobWorkspace.findUnique({
    where: { enterpriseId: ENTERPRISE_ID },
    include: { enterprise: { select: { companyName: true } } },
  })
  console.log(`[1] Workspace: ${workspace ? 'EXISTS' : 'NULL'}`)
  if (workspace) {
    console.log(`    Name: ${workspace.enterprise?.companyName || workspace.name}`)
    console.log(`    Plan: ${workspace.plan}`)
  }

  // 2. AI 员工
  const workforce = workspace
    ? await prisma.enterpriseAgentWorkforce.findMany({ where: { workspaceId: workspace.id } })
    : []
  console.log(`\n[2] Workforce: ${workforce.length} agents`)
  for (const w of workforce) {
    console.log(`    ${w.agentType}: ${w.status} (${w.displayName})`)
  }

  // 3. 招聘 Pipeline
  const pipelines = workspace
    ? await prisma.recruitmentPipeline.findMany({ where: { workspaceId: workspace.id } })
    : []
  console.log(`\n[3] Pipelines: ${pipelines.length} records`)
  const stages = ['discovered', 'screening', 'interview', 'offer', 'hired', 'rejected']
  for (const s of stages) {
    const count = pipelines.filter(p => p.stage === s).length
    if (count > 0) console.log(`    ${s}: ${count}`)
  }

  // 4. 面试
  const interviews = workspace
    ? await prisma.interviewSession.findMany({ where: { workspaceId: workspace.id } })
    : []
  console.log(`\n[4] Interviews: ${interviews.length}`)

  // 5. 简历
  const resumes = workspace
    ? await prisma.resume.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      })
    : []
  console.log(`\n[5] Recent Resumes: ${resumes.length}`)

  // 6. Onboarding 状态
  const onboarding = workspace
    ? await prisma.enterpriseOnboardingState.findUnique({ where: { workspaceId: workspace.id } })
    : null
  console.log(`\n[6] Onboarding: ${onboarding ? `step ${onboarding.currentStep}` : 'NULL'}`)

  // 7. 招聘需求
  const needs = workspace
    ? await prisma.enterpriseRecruitmentNeeds.findUnique({ where: { workspaceId: workspace.id } })
    : null
  console.log(`\n[7] Needs: ${needs ? `${needs.targetPositions?.length || 0} positions` : 'NULL'}`)

  console.log('\n=== Test Complete ===')
}

main().catch(console.error).finally(() => prisma.$disconnect())
