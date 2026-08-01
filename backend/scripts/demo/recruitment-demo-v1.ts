/**
 * ============================================================
 *  Recruitment Workspace Demo Seed v1
 * ============================================================
 * 用途：
 *   商业演示 / Product Demo / Design Partner 场景数据
 *
 * 数据范围：
 *   1 个企业（示例科技有限公司）
 *   1 个岗位（AI产品经理）
 *   5 个候选人
 *   3 个 AI 员工（Alice / Bob / Carol）
 *   3 条招聘任务
 *   1 份招聘决策报告
 *
 * 执行方式（仅限手动）：
 *   npx tsx scripts/demo/recruitment-demo-v1.ts
 *
 * 禁止：
 *   生产环境自动执行 | CI 自动触发 | migration hook
 * ============================================================
 */

import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

// ─── 固定 ID（便于调试 / Demo 复现） ───
const DEMO_ORG_ID = 'd0000000-0000-4000-8000-000000000001'
const DEMO_AGENT_PROFILE_ALICE_ID = 'd0000000-0000-4000-8000-000000000010'
const DEMO_AGENT_PROFILE_BOB_ID   = 'd0000000-0000-4000-8000-000000000011'
const DEMO_AGENT_PROFILE_CAROL_ID = 'd0000000-0000-4000-8000-000000000012'
const DEMO_JOB_ID = 'd0000000-0000-4000-8000-000000000020'
const DEMO_CANDIDATE_IDS = [
  'd0000000-0000-4000-8000-000000000101',
  'd0000000-0000-4000-8000-000000000102',
  'd0000000-0000-4000-8000-000000000103',
  'd0000000-0000-4000-8000-000000000104',
  'd0000000-0000-4000-8000-000000000105',
]

interface CandidateData {
  id: string
  name: string
  title: string
  experience: string
  skills: string[]
  matchScore: number
}

async function main() {
  console.log('📦 开始写入 Recruitment Demo 数据...')

  // ─── 1. 组织 ───
  await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    update: {},
    create: {
      id: DEMO_ORG_ID,
      name: '示例科技有限公司',
      displayName: '示例科技',
      tenantId: DEMO_ORG_ID,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date(),
    },
  })
  console.log('  ✅ 企业: 示例科技有限公司')

  // ─── 2. AI 员工档案 ───
  const agents = [
    { id: DEMO_AGENT_PROFILE_ALICE_ID, name: '招聘顾问 Alice', agentType: 'recruiter', promptTag: 'recruiter_jd', description: '招聘经理 — JD生成、简历筛选、面试邀约' },
    { id: DEMO_AGENT_PROFILE_BOB_ID,   name: '面试专家 Bob',   agentType: 'interview',  promptTag: 'interview_question', description: '面试官 — 面试问题设计、评分标准、评估报告' },
    { id: DEMO_AGENT_PROFILE_CAROL_ID, name: '人才分析师 Carol', agentType: 'talent_analyst', promptTag: 'talent_analysis', description: '人才分析师 — 技能差距分析、候选人评分、推荐理由' },
  ]

  for (const agent of agents) {
    await prisma.enterpriseAgentProfile.upsert({
      where: { id: agent.id },
      update: {},
      create: {
        id: agent.id,
        organizationId: DEMO_ORG_ID,
        name: agent.name,
        agentType: agent.agentType,
        promptTag: agent.promptTag,
        description: agent.description,
        status: 'ACTIVE',
        config: { model: 'deepseek-chat', temperature: 0.7 },
        createdBy: 'demo-seed-v1',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date(),
      },
    })
  }
  console.log('  ✅ AI 员工: Alice / Bob / Carol')

  // ─── 3. 岗位（AI产品经理） ───
  await prisma.jobPosting.upsert({
    where: { id: DEMO_JOB_ID },
    update: {},
    create: {
      id: DEMO_JOB_ID,
      organizationId: DEMO_ORG_ID,
      title: 'AI产品经理',
      department: '产品部',
      description: '负责公司 AI 产品的需求分析、产品规划和迭代管理。\n\n岗位职责：\n1. 负责 AI 产品的市场调研与竞品分析\n2. 撰写产品需求文档（PRD），明确功能优先级\n3. 协同算法、工程团队推进产品落地\n4. 跟踪产品数据指标，持续优化用户体验\n\n任职要求：\n- 3年以上产品经理经验\n- 有 AI / 机器学习产品经验优先\n- 良好的数据分析能力\n- 优秀的沟通协调能力',
      location: '深圳 / 远程',
      salaryRange: '30K-50K',
      employmentType: '全职',
      status: 'ACTIVE',
      createdBy: 'demo-seed-v1',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date(),
    },
  })
  console.log('  ✅ 岗位: AI产品经理')

  // ─── 4. 候选人（5人） ───
  const candidates: CandidateData[] = [
    { id: DEMO_CANDIDATE_IDS[0], name: '张明', title: '高级产品经理', experience: '5年AI产品经验，主导过2款NLP产品', skills: ['产品规划', 'NLP', '数据分析', '敏捷管理'], matchScore: 92 },
    { id: DEMO_CANDIDATE_IDS[1], name: '李婷', title: 'AI产品负责人', experience: '4年CV产品经验，从0到1搭建识别产品', skills: ['计算机视觉', '产品策略', '用户研究', 'A/B测试'], matchScore: 88 },
    { id: DEMO_CANDIDATE_IDS[2], name: '王浩', title: '产品经理', experience: '6年互联网产品，2年AI对话系统', skills: ['对话系统', 'PRD', '数据分析', '项目管理'], matchScore: 78 },
    { id: DEMO_CANDIDATE_IDS[3], name: '陈思', title: 'AI产品专家', experience: '7年产品经验，推荐系统背景', skills: ['推荐系统', 'SQL', '用户增长', '商业化'], matchScore: 85 },
    { id: DEMO_CANDIDATE_IDS[4], name: '赵岩', title: '产品总监', experience: '8年产品经验，曾负责AI客服产品线', skills: ['产品战略', 'AI客服', '团队管理', '跨部门协作'], matchScore: 74 },
  ]

  for (const c of candidates) {
    await prisma.jobCandidate.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        jobPostingId: DEMO_JOB_ID,
        organizationId: DEMO_ORG_ID,
        name: c.name,
        title: c.title,
        experience: c.experience,
        skills: c.skills,
        status: 'NEW',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date(),
      },
    })
  }
  console.log('  ✅ 候选人: 张明 / 李婷 / 王浩 / 陈思 / 赵岩')

  // ─── 5. 候选人匹配评分 ───
  for (const c of candidates) {
    await prisma.candidateMatch.create({
      data: {
        id: uuidv4(),
        jobPostingId: DEMO_JOB_ID,
        candidateId: c.id,
        organizationId: DEMO_ORG_ID,
        matchScore: c.matchScore,
        matchDetails: {
          skillMatch: Math.round(c.matchScore * 0.9),
          experienceMatch: Math.round(c.matchScore * 0.85),
          cultureFit: Math.min(100, Math.round(c.matchScore * 1.05)),
        },
        source: 'AI_MATCH',
        createdBy: 'demo-seed-v1',
        createdAt: new Date('2026-07-02T00:00:00Z'),
        updatedAt: new Date(),
      },
    })
  }
  console.log('  ✅ 候选人匹配评分')

  // ─── 6. AI 测试任务（3条） ───
  const tasks = [
    {
      id: uuidv4(),
      agentId: DEMO_AGENT_PROFILE_ALICE_ID,
      agentName: '招聘顾问 Alice',
      taskType: 'JD_GENERATION',
      title: '生成AI产品经理JD',
      status: 'COMPLETED',
      createdAt: '2026-07-02T08:00:00Z',
    },
    {
      id: uuidv4(),
      agentId: DEMO_AGENT_PROFILE_CAROL_ID,
      agentName: '人才分析师 Carol',
      taskType: 'CANDIDATE_ANALYSIS',
      title: '分析5位候选人匹配度',
      status: 'COMPLETED',
      createdAt: '2026-07-02T09:00:00Z',
    },
    {
      id: uuidv4(),
      agentId: DEMO_AGENT_PROFILE_BOB_ID,
      agentName: '面试专家 Bob',
      taskType: 'INTERVIEW_DESIGN',
      title: '设计AI产品经理面试方案',
      status: 'COMPLETED',
      createdAt: '2026-07-02T10:00:00Z',
    },
  ]

  for (const task of tasks) {
    await prisma.enterpriseAgentTask.upsert({
      where: { id: task.id },
      update: {},
      create: {
        id: task.id,
        organizationId: DEMO_ORG_ID,
        agentProfileId: task.agentId,
        agentName: task.agentName,
        taskType: task.taskType,
        title: task.title,
        status: task.status,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(),
      },
    })
  }
  console.log('  ✅ 任务: JD生成 / 候选人分析 / 面试设计')

  // ─── 7. 招聘决策报告（1份） ───
  await prisma.recruitmentReport.create({
    data: {
      id: uuidv4(),
      organizationId: DEMO_ORG_ID,
      jobPostingId: DEMO_JOB_ID,
      title: 'AI产品经理 · 招聘决策报告（第1轮）',
      summary: `基于 AI 招聘团队的协同分析，推荐候选人 **张明**（匹配度92%）作为 AI 产品经理岗位首选人选。

推荐理由：
- 5年AI产品经验，2款NLP产品落地经验
- 技能匹配度最高（产品规划+NLP+数据分析）
- 面试评估：技术能力 ★★★★☆，沟通协作 ★★★★★

备选：李婷（匹配度88%），CV产品背景强，适合视觉方向进阶产品线。

行动计划：
1. 本周内安排张明技术面试
2. 同时推进李婷的初筛电话
3. 若两人均通过，可考虑扩招名额`,
      reportType: 'DECISION_REPORT',
      status: 'DRAFT',
      metadata: {
        totalCandidates: 5,
        topCandidate: '张明',
        topScore: 92,
        evaluatedBy: ['Alice', 'Carol', 'Bob'],
        totalTaskCost: 0.0085,
      },
      generatedBy: 'demo-seed-v1',
      createdAt: new Date('2026-07-02T12:00:00Z'),
      updatedAt: new Date(),
    },
  })
  console.log('  ✅ 招聘决策报告: AI产品经理第1轮')

  console.log('')
  console.log('🎉 Recruitment Demo Seed v1 写入完成')
  console.log('')
  console.log('数据摘要:')
  console.log('  企业: 示例科技有限公司')
  console.log('  岗位: AI产品经理')
  console.log('  候选人: 5人')
  console.log('  AI员工: Alice / Bob / Carol')
  console.log('  任务: 3条')
  console.log('  报告: 1份')
  console.log('')
  console.log('⚠️  注意: 这是 Demo 数据，仅供演示使用')
  console.log('   运行: npx tsx scripts/demo/recruitment-demo-v1.ts')
}

main()
  .catch((e) => {
    console.error('❌ Demo seed 失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
