/**
 * Sprint-08E — Carol Reality Data Bootstrap
 *
 * 目标：让新企业第一次进入招聘驾驶舱时，可以看到 Carol 已经开始工作。
 *
 * 数据链：
 *   Job → EnterpriseAgentInstance → EnterpriseAgentTask → CandidateMatch → AgentAuditTrail
 *
 * 运行方式：npx tsx src/seeds/carol-reality-bootstrap.ts
 *
 * 幂等：先检查是否已有数据，有则跳过
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── 常量 ───────────────────────────────────────────────

const ORG_ID = 'a1000000-0000-4000-8000-000000000001'
const WORKSPACE_ID = '39892c4d-5124-4491-a3ff-47334313b09d'
const JOB_ID = '08e301a5-a279-4b63-bec2-0c6c9f30cc3c'
// 使用 "人才分析师 Carol" 的 profile（role=talent_analyst）
const CAROL_PROFILE_ID = 'aa1bdca7-5f2c-4613-84c0-5c78bcb2b3f4'
// tenantId = userId（企业场景中的兼容逻辑）
const TENANT_ID = ORG_ID

// 今日零点
function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ─── Helper: 是否有 seed 数据 ───────────────────────────

async function hasSeedData(): Promise<boolean> {
  const count = await prisma.enterpriseAgentTask.count({
    where: { organizationId: ORG_ID },
  })
  return count > 0
}

// ─── Task 1: 创建/确保 EnterpriseAgentInstance ──────────

async function ensureCarolInstance(): Promise<string> {
  const existing = await prisma.enterpriseAgentInstance.findFirst({
    where: { employeeId: CAROL_PROFILE_ID },
  })
  if (existing) {
    console.log(`[Carol Seed] Instance already exists: ${existing.id}`)
    return existing.id
  }

  const instance = await prisma.enterpriseAgentInstance.create({
    data: {
      tenantId: TENANT_ID,
      organizationId: ORG_ID,
      employeeId: CAROL_PROFILE_ID,
      agentId: `agent_${TENANT_ID}_carol`,
      runtime: 'openclaw',
      namespace: `tenant_${TENANT_ID}_talent_analyst`,
      runtimeStatus: 'active',
      lifecycleState: 'ACTIVE',
      totalTasks: 0,
      totalErrors: 0,
      metadata: JSON.stringify({ source: 'sprint-08e-seed' }),
    },
  })
  console.log(`[Carol Seed] Created instance: ${instance.id}`)
  return instance.id
}

// ─── Task 2: 更新 Job 为 ACTIVE ──────────────────────────

async function ensureJobActive(): Promise<void> {
  const job = await prisma.jobPosting.findUnique({ where: { id: JOB_ID } })
  if (!job) {
    console.error(`[Carol Seed] Job ${JOB_ID} not found!`)
    return
  }
  if (job.status === 'active' || job.status === 'published') {
    console.log(`[Carol Seed] Job already ${job.status}`)
    return
  }

  await prisma.jobPosting.update({
    where: { id: JOB_ID },
    data: {
      status: 'active',
      description: '负责公司核心产品的前端架构设计与开发，参与技术选型，优化用户体验和性能。',
      requirements: '1. 5年以上前端开发经验\n2. 精通 React/Vue 等主流框架\n3. 熟悉 TypeScript\n4. 有大型项目架构经验\n5. 了解 Node.js 全栈开发',
      salary: '25K-40K',
      location: '上海',
      relatedSkills: ['React', 'Vue', 'TypeScript', 'Webpack', 'Node.js'],
      skillRequirements: ['React', 'TypeScript', '前端架构', '性能优化'],
      tags: ['高级', '前端', '全职'],
    },
  })
  console.log(`[Carol Seed] Job updated to ACTIVE`)
}

// ─── Task 3: 创建 3 个候选人和匹配 ─────────────────────

async function createCandidatesAndMatches(instanceId: string): Promise<void> {
  const existing = await prisma.candidateMatch.count({
    where: { workspaceId: WORKSPACE_ID, jobId: JOB_ID },
  })
  if (existing > 0) {
    console.log(`[Carol Seed] ${existing} matches already exist, skipping candidate creation`)
    return
  }

  // 创建 3 个 CandidateMatch（JobCandidate 已移除，candidateId 作为历史 ID 引用）
  const matchData = [
    {
      id: '00000000-0000-4000-b000-000000000001',
      candidateId: '00000000-0000-4000-a000-000000000001',
      matchScore: 92,
      status: 'shortlisted',
      matchBreakdown: JSON.stringify({
        skillMatch: 95,
        experienceMatch: 90,
        educationMatch: 100,
        locationMatch: 100,
        salaryMatch: 85,
        overall: 92,
        analysis: '该候选人在技术能力、项目经验与岗位高度匹配，具备架构设计能力，强烈推荐进入面试。',
      }),
      aiAnalysis: '【AI 人才分析报告】\n\n候选人：张明\n综合匹配度：92%（高匹配）\n\n技术栈评估：\n- React: 精通（5年实战经验，主导过3个大型项目）\n- TypeScript: 精通（企业内部类型系统设计经验）\n- 前端架构: 强项（微前端架构设计经验）\n\n优势：\n1. 8年经验，丰富的架构设计经验\n2. 有团队管理经验\n3. 技术视野开阔\n\n潜在风险：\n1. 薪资期望较高（35K-45K）\n2. 可能需要适应期\n\n推荐意见：强烈推荐进入面试轮次',
      jobId: JOB_ID,
      workspaceId: WORKSPACE_ID,
    },
    {
      id: '00000000-0000-4000-b000-000000000002',
      candidateId: '00000000-0000-4000-a000-000000000002',
      matchScore: 81,
      status: 'shortlisted',
      matchBreakdown: JSON.stringify({
        skillMatch: 85,
        experienceMatch: 80,
        educationMatch: 80,
        locationMatch: 100,
        salaryMatch: 90,
        overall: 81,
        analysis: '候选人基础扎实，5年经验匹配岗位要求，技术栈全面，值得进入面试环节。',
      }),
      aiAnalysis: '【AI 人才分析报告】\n\n候选人：李华\n综合匹配度：81%（高匹配）\n\n技术栈评估：\n- React: 熟练（4年使用经验）\n- TypeScript: 良好（项目中持续使用）\n- CI/CD: 有实践经验\n\n优势：\n1. 5年经验，刚好匹配高级工程师要求\n2. 薪资期望合理\n3. 学习能力强\n\n潜在风险：\n1. 缺乏大型项目架构经验\n2. 需要技术深度提升\n\n推荐意见：建议进入面试，适合作为团队骨干培养',
      jobId: JOB_ID,
      workspaceId: WORKSPACE_ID,
    },
    {
      id: '00000000-0000-4000-b000-000000000003',
      candidateId: '00000000-0000-4000-a000-000000000003',
      matchScore: 76,
      status: 'pending',
      matchBreakdown: JSON.stringify({
        skillMatch: 80,
        experienceMatch: 75,
        educationMatch: 100,
        locationMatch: 70,
        salaryMatch: 85,
        overall: 76,
        analysis: '候选人技能匹配度良好，微前端方向有亮点，但位于杭州需远程面试评估。',
      }),
      aiAnalysis: '【AI 人才分析报告】\n\n候选人：王磊\n综合匹配度：76%（中高匹配）\n\n技术栈评估：\n- Vue: 精通\n- React: 良好\n- 微前端: 有实际项目经验\n- 性能优化: 专长领域\n\n优势：\n1. 微前端实践经验稀缺\n2. 性能优化专长\n3. 工程化能力强\n\n潜在风险：\n1. 候选人目前在杭州\n2. 技术栈以 Vue 为主，React 经验较少\n\n推荐意见：可进入面试，重点考察 React 技术深度',
      jobId: JOB_ID,
      workspaceId: WORKSPACE_ID,
    },
  ]

  for (const m of matchData) {
    // 使用 upsert 确保幂等
    await prisma.candidateMatch.upsert({
      where: { id: m.id },
      create: m,
      update: {},
    })
  }
  console.log(`[Carol Seed] Created 3 CandidateMatches`)
}

// ─── Task 4: 创建 Carol 的 Agent Task 记录 ──────────────

async function createCarolTasks(instanceId: string): Promise<void> {
  const existing = await prisma.enterpriseAgentTask.count({
    where: { agentInstanceId: instanceId },
  })
  if (existing > 0) {
    console.log(`[Carol Seed] ${existing} tasks already exist, skipping`)
    return
  }

  const now = new Date()
  const taskData = [
    {
      taskType: 'job_analysis',
      inputSummary: '岗位：高级前端工程师。要求分析该岗位的技术栈、经验要求和团队定位。',
      outputSummary: '已完成岗位需求分析。该岗位需要React/Vue/TypeScript全栈能力，5年以上经验，重点在前端架构和性能优化方向。建议面试重点考察系统设计能力和工程化思维。',
      status: 'completed',
      tokenInput: 452,
      tokenOutput: 328,
      cost: 0.0004,
      durationMs: 4500,
      startedAt: new Date(now.getTime() - 3600000 * 2), // 2h ago
      completedAt: new Date(now.getTime() - 3600000 * 2 + 4500),
    },
    {
      taskType: 'candidate_screening',
      inputSummary: '高级前端工程师岗位收到25份简历，需要AI预筛选。',
      outputSummary: '已完成25份简历的AI初筛。其中高匹配（80+）3人，中等匹配（60-79）8人，低匹配（<60）14人。推荐3名高匹配候选人进入面试流程。',
      status: 'completed',
      tokenInput: 1850,
      tokenOutput: 960,
      cost: 0.0012,
      durationMs: 12000,
      startedAt: new Date(now.getTime() - 3600000 * 1.5), // 1.5h ago
      completedAt: new Date(now.getTime() - 3600000 * 1.5 + 12000),
    },
    {
      taskType: 'matching_report',
      inputSummary: '基于3名高匹配候选人的简历和技术评估，生成匹配评估报告。',
      outputSummary: '匹配评估已完成。三名候选人平均匹配度83%。详细分析了每位候选人的技术栈匹配度、经验匹配度和潜在风险，并给出面试建议。',
      status: 'completed',
      tokenInput: 2100,
      tokenOutput: 1450,
      cost: 0.0018,
      durationMs: 15000,
      startedAt: new Date(now.getTime() - 3600000 * 1), // 1h ago
      completedAt: new Date(now.getTime() - 3600000 * 1 + 15000),
    },
    {
      taskType: 'interview_recommendation',
      inputSummary: '汇总匹配评估结果，生成最终的面试推荐报告。',
      outputSummary: '招聘推荐报告已生成。推荐3名候选人（张明92%、李华81%、王磊76%）进入面试环节。建议优先安排张明面试，该候选人在技术能力和架构经验方面与岗位高度匹配。',
      status: 'completed',
      tokenInput: 980,
      tokenOutput: 760,
      cost: 0.0008,
      durationMs: 8500,
      startedAt: new Date(now.getTime() - 3600000 * 0.5), // 0.5h ago
      completedAt: new Date(now.getTime() - 3600000 * 0.5 + 8500),
    },
  ]

  for (const t of taskData) {
    await prisma.enterpriseAgentTask.create({
      data: {
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        agentInstanceId: instanceId,
        ...t,
      },
    })
  }
  console.log(`[Carol Seed] Created 4 EnterpriseAgentTasks`)

  // 更新实例的任务计数
  await prisma.enterpriseAgentInstance.update({
    where: { id: instanceId },
    data: { totalTasks: 4 },
  })
}

// ─── Task 5: 创建 Audit Trail 记录 ──────────────────────

async function createAuditTrail(): Promise<void> {
  const existing = await prisma.agentAuditTrail.count({
    where: { organizationId: ORG_ID },
  })
  if (existing > 0) {
    console.log(`[Carol Seed] ${existing} audit trails already exist, skipping`)
    return
  }

  const now = new Date()
  const auditData = [
    {
      action: 'task.created',
      resource: 'enterprise_agent_task',
      resourceId: null, // 先创建，后续可更新
      tokenUsage: 0,
      cost: 0,
      durationMs: 0,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', taskType: 'job_analysis' }),
      createdAt: new Date(now.getTime() - 3600000 * 2),
    },
    {
      action: 'task.executed',
      resource: 'enterprise_agent_task',
      resourceId: null,
      tokenUsage: 780,
      cost: 0.0004,
      durationMs: 4500,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', taskType: 'job_analysis', status: 'completed' }),
      createdAt: new Date(now.getTime() - 3600000 * 2 + 5000),
    },
    {
      action: 'task.created',
      resource: 'enterprise_agent_task',
      resourceId: null,
      tokenUsage: 0,
      cost: 0,
      durationMs: 0,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', taskType: 'candidate_screening' }),
      createdAt: new Date(now.getTime() - 3600000 * 1.5),
    },
    {
      action: 'task.executed',
      resource: 'enterprise_agent_task',
      resourceId: null,
      tokenUsage: 2810,
      cost: 0.0012,
      durationMs: 12000,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', taskType: 'candidate_screening', candidatesAnalyzed: 25 }),
      createdAt: new Date(now.getTime() - 3600000 * 1.5 + 13000),
    },
    {
      action: 'candidate.match.generated',
      resource: 'candidate_match',
      resourceId: '00000000-0000-4000-b000-000000000001',
      tokenUsage: 1200,
      cost: 0.0006,
      durationMs: 5000,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', matchScore: 92, candidateName: '张明' }),
      createdAt: new Date(now.getTime() - 3600000 * 1),
    },
    {
      action: 'candidate.match.generated',
      resource: 'candidate_match',
      resourceId: '00000000-0000-4000-b000-000000000002',
      tokenUsage: 1100,
      cost: 0.0005,
      durationMs: 4800,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', matchScore: 81, candidateName: '李华' }),
      createdAt: new Date(now.getTime() - 3600000 * 1 + 1000),
    },
    {
      action: 'candidate.match.generated',
      resource: 'candidate_match',
      resourceId: '00000000-0000-4000-b000-000000000003',
      tokenUsage: 1150,
      cost: 0.0005,
      durationMs: 4900,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', matchScore: 76, candidateName: '王磊' }),
      createdAt: new Date(now.getTime() - 3600000 * 1 + 2000),
    },
    {
      action: 'task.executed',
      resource: 'enterprise_agent_task',
      resourceId: null,
      tokenUsage: 3550,
      cost: 0.0018,
      durationMs: 15000,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', taskType: 'matching_report' }),
      createdAt: new Date(now.getTime() - 3600000 * 1 + 16000),
    },
    {
      action: 'report.generated',
      resource: 'recruitment_report',
      tokenUsage: 1740,
      cost: 0.0008,
      durationMs: 8500,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', reportType: 'interview_recommendation' }),
      createdAt: new Date(now.getTime() - 3600000 * 0.5 + 9000),
    },
    {
      action: 'task.executed',
      resource: 'enterprise_agent_task',
      resourceId: null,
      tokenUsage: 1740,
      cost: 0.0008,
      durationMs: 8500,
      approvalStatus: 'auto_executed',
      metadata: JSON.stringify({ source: 'carol_seed', taskType: 'interview_recommendation' }),
      createdAt: new Date(now.getTime() - 3600000 * 0.5 + 10000),
    },
  ]

  for (const a of auditData) {
    await prisma.agentAuditTrail.create({
      data: {
        tenantId: TENANT_ID,
        organizationId: ORG_ID,
        agentId: CAROL_PROFILE_ID,
        ...a,
      },
    })
  }
  console.log(`[Carol Seed] Created 10 AgentAuditTrail entries`)
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log('\n=== Sprint-08E: Carol Reality Data Bootstrap ===\n')

  // 幂等检查
  if (await hasSeedData()) {
    console.log('⚠️  Seed data already exists, skipping...')
    console.log('   To force re-seed, clear enterprise_agent_task for this org.\n')
    return
  }

  // Step 1: Ensure Agent Instance
  console.log('[1/5] Ensuring Carol Instance...')
  const instanceId = await ensureCarolInstance()

  // Step 2: Activate job
  console.log('[2/5] Activating job...')
  await ensureJobActive()

  // Step 3: Create candidates & matches
  console.log('[3/5] Creating candidates & matches...')
  await createCandidatesAndMatches(instanceId)

  // Step 4: Create Carol tasks
  console.log('[4/5] Creating Carol tasks...')
  await createCarolTasks(instanceId)

  // Step 5: Create audit trail
  console.log('[5/5] Creating audit trail...')
  await createAuditTrail()

  console.log('\n=== ✅ Carol Reality Data Bootstrap Complete ===\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
