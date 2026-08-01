/**
 * ============================================================
 *  Recruitment AI Employee Reality Test — Archived
 * ============================================================
 * 用途：
 *   Recruitment Workspace Reality Test / Demo Scenario
 *
 * 状态：
 *   Archived
 *
 * 禁止：
 *   生产环境自动执行
 *
 * 用途：
 *   - 本地开发
 *   - QA 验证
 *   - Design Partner Demo
 *   - E2E 测试
 * ============================================================
 *
 * 原说明：
 *   Phase 1: Recruitment AI Employee Reality Test seed data
 *   创建: EnterpriseLlmConfig + JobPosting + 5个候选人 + Pipeline + Needs
 *   运行: npx tsx scripts/archive/recruitment/seed-recruitment-scenario.ts
 */

import { PrismaClient } from '@prisma/client'
import { encryptKey } from '../src/services/crypto.service.js'
const prisma = new PrismaClient()

async function main() {
  const userId = '4e2f6062-956f-4d9e-96c2-2d266ec8efa8'
  const orgId = 'c77e758f-ee20-4326-aef2-51d0fac65f79'
  const workspaceId = orgId

  console.log('🌱 Starting recruitment scenario seed...')

  // ======================================================================
  // 1. EnterpriseLlmConfig — Required for Hermes Runtime
  // ======================================================================
  const existingLlm = await prisma.enterpriseLlmConfig.findFirst({
    where: { tenantId: userId, status: 'active' },
  })
  if (!existingLlm) {
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: { provider: 'deepseek' },
      orderBy: { updatedAt: 'desc' },
    })
    const apiKey = apiKeyRecord?.keyValue || process.env.DEEPSEEK_API_KEY || ''
    if (apiKey) {
      const encrypted = encryptKey(apiKey)
      await prisma.enterpriseLlmConfig.create({
        data: {
          tenantId: userId,
          provider: 'deepseek',
          modelName: 'deepseek-chat',
          encryptedApiKey: encrypted,
          baseUrl: null,
          credentialOwner: 'enterprise',
          maxTokensPerDay: 1000000,
          maxRequestsPerMinute: 60,
          capabilities: JSON.stringify(['chat', 'reasoning']),
          enabled: true,
          status: 'active',
        },
      })
      console.log('✅ EnterpriseLlmConfig created (deepseek)')
    } else {
      console.warn('⚠️ No DeepSeek API key found — runtime execution will fail')
    }
  } else {
    console.log('✅ EnterpriseLlmConfig already exists')
  }

  // ======================================================================
  // 2. JobPosting — AI产品经理
  // ======================================================================
  let job = await prisma.jobPosting.findFirst({
    where: { enterpriseId: orgId, title: 'AI产品经理' },
  })
  if (!job) {
    job = await prisma.jobPosting.create({
      data: {
        enterpriseId: orgId,
        title: 'AI产品经理',
        salary: '30K-50K',
        location: '北京',
        description: `我们正在寻找一位富有远见的AI产品经理，加入我们快速增长的AI SaaS团队。

【关于团队】
我们是一家专注于AI技术的SaaS公司，产品覆盖AI内容创作、AI招聘、AI运营等领域。团队技术氛围浓厚，拥有自研LLM推理平台和丰富的AI应用落地经验。

【你将负责】
1. 负责AI产品的需求分析、产品规划与路线图制定
2. 深入理解AI技术能力（LLM、多模态、RAG等），转化为产品方案
3. 与工程、设计、算法团队紧密协作，推动产品从0到1落地
4. 跟踪行业趋势和竞品动态，持续优化产品竞争力
5. 制定产品数据指标体系，通过数据驱动产品决策`,
        requirements: `【硬性要求】
- 3年以上产品经理工作经验
- 熟悉AI应用产品（LLM/NLP/对话系统等）
- 有SaaS产品经验，理解B端客户需求
- 具备用户研究能力，能独立完成用户访谈和可用性测试`,
        qualityScore: 85,
        status: 'active',
        industry: 'AI/SaaS',
        skillRequirements: ['AI产品设计', '需求分析', '用户研究', 'SaaS产品', '数据分析', '跨团队协作'],
        relatedSkills: ['LLM', 'AI Agent', '产品规划', '原型设计', 'A/B测试', '竞品分析'],
        tags: ['AI', '产品经理', 'SaaS', '北京', '高级'],
      },
    })
    console.log(`✅ JobPosting created: ${job.id} (AI产品经理)`)
  } else {
    console.log(`✅ JobPosting already exists: ${job.id}`)
  }

  const jobId = job.id

  // ======================================================================
  // 3. Candidate Profiles & RecruitmentPipeline
  // ======================================================================
  const candidates = [
    {
      name: '张明',
      skills: ['AI产品设计', '需求分析', '用户研究', 'SaaS产品', '数据分析', 'LLM应用'],
      experience: '5年AI产品经验，曾任某AI初创公司产品负责人，主导过AI对话平台产品从0到1。擅长将AI技术转化为用户价值，有丰富的B端产品经验。',
      experienceYears: 5,
      education: '硕士',
      city: '北京',
      careerGoal: '成为一名能够推动AI技术商业化的高级产品总监',
      strengths: ['AI产品经验丰富', '有从0到1经验', '技术理解力强'],
      weaknesses: ['管理经验有限'],
      projects: '主导AI对话平台产品，服务200+企业客户；设计AI内容生成工具，月活10万+',
      matchScore: 92,
      matchReason: '5年AI产品经验，有从0到1经验，技能完美匹配，北京本地',
    },
    {
      name: '李华',
      skills: ['产品规划', '用户研究', 'SaaS产品', '数据分析', '竞品分析'],
      experience: '4年SaaS产品经验，在B端SaaS公司负责产品模块，有AI辅助功能的产品化经验。熟悉企业级产品的需求管理和迭代流程。',
      experienceYears: 4,
      education: '本科',
      city: '北京',
      careerGoal: '在AI领域深耕，成为AI产品专家',
      strengths: ['SaaS经验丰富', '用户研究能力强', '数据分析扎实'],
      weaknesses: ['AI产品经验偏少', '无团队管理经验'],
      projects: '主导SaaS平台多个核心模块，管理50+需求迭代；设计AI辅助功能提升用户效率30%',
      matchScore: 78,
      matchReason: 'SaaS经验匹配较好，但AI产品经验不足',
    },
    {
      name: '王芳',
      skills: ['AI产品设计', '需求分析', '用户研究', '数据分析', 'LLM', 'RAG', 'A/B测试'],
      experience: '6年产品经验（2年AI+4年传统），曾在互联网大厂负责AI搜索产品。深入理解LLM和RAG技术，有大规模用户产品的经验。',
      experienceYears: 6,
      education: '硕士',
      city: '上海',
      careerGoal: '成为AI产品方向的专家，推动AI技术普惠化',
      strengths: ['大厂背景', '技术深度好', '大规模产品经验'],
      weaknesses: ['不在北京', 'B端经验较少'],
      projects: '负责AI搜索产品，日活500万+；设计RAG问答系统，准确率提升40%',
      matchScore: 85,
      matchReason: 'AI技术理解深入，大厂经验，但B端经验不足且不在北京',
    },
    {
      name: '赵强',
      skills: ['AI产品设计', '产品规划', 'SaaS产品', '跨团队协作', '原型设计'],
      experience: '3.5年产品经验，其中2年在AI SaaS公司独立负责Agent产品线。熟悉AI Agent从设计到上线的完整流程。',
      experienceYears: 3,
      education: '本科',
      city: '北京',
      careerGoal: '在AI Agent方向成为行业专家',
      strengths: ['AI Agent产品经验', '执行力强', '沟通能力好'],
      weaknesses: ['经验年限刚过门槛', '非技术背景', '无大厂经验'],
      projects: '独立负责AI Agent产品线，从0到1上线3个Agent产品；推动Agent能力接入10+客户',
      matchScore: 72,
      matchReason: 'AI Agent经验相关，但整体经验偏少且非技术背景',
    },
    {
      name: '陈雪',
      skills: ['AI产品设计', '需求分析', '用户研究', 'SaaS产品', '数据分析', 'LLM', '产品增长'],
      experience: '5年产品经验，在AI SaaS创业公司担任产品总监。擅长数据驱动的产品增长，有完整的AI产品生命周期管理经验。',
      experienceYears: 5,
      education: '硕士（海外）',
      city: '北京',
      careerGoal: '用AI技术重新定义产品体验',
      strengths: ['全面的产品管理能力', '增长经验', '海外背景', '管理经验'],
      weaknesses: ['薪资期望高'],
      projects: '管理AI SaaS产品线，覆盖10万+用户；建立数据驱动的产品增长体系，ARR增长300%',
      matchScore: 88,
      matchReason: '全面的AI SaaS产品经验，有管理能力和海外背景',
    },
  ]

  for (const c of candidates) {
    const existingProfile = await prisma.resumeProfile.findFirst({
      where: { name: c.name },
    })
    if (existingProfile) {
      console.log(`⏭️ Resume profile already exists: ${c.name}`)
      continue
    }

    const resume = await prisma.resume.create({
      data: {
        workspaceId,
        candidateName: c.name,
        fileName: `${c.name}_简历.pdf`,
        fileUrl: '',
        fileType: 'pdf',
        fileSize: 0,
        status: 'parsed',
        parserType: 'manual',
      },
    })

    await prisma.resumeProfile.create({
      data: {
        resumeId: resume.id,
        name: c.name,
        email: `${c.name}@example.com`.toLowerCase(),
        phone: `1380000${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        education: c.education,
        skills: c.skills,
        experience: c.experience,
        experienceYears: c.experienceYears,
        city: c.city,
        careerGoal: c.careerGoal,
        qualityScore: 90,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
        suggestions: [],
      },
    })

    await prisma.recruitmentPipeline.create({
      data: {
        workspaceId,
        jobId: jobId,
        candidateName: c.name,
        stage: 'new',
        screeningScore: c.matchScore,
        lastActivityAt: new Date(),
      },
    })

    console.log(`✅ Candidate created: ${c.name} (match: ${c.matchScore})`)
  }

  // ======================================================================
  // 4. EnterpriseRecruitmentNeeds
  // ======================================================================
  const existingNeed = await prisma.enterpriseRecruitmentNeeds.findUnique({
    where: { workspaceId },
  })
  if (!existingNeed) {
    await prisma.enterpriseRecruitmentNeeds.create({
      data: {
        workspaceId,
        enterpriseId: orgId,
        targetPositions: ['AI产品经理'],
        monthlyHireTarget: 2,
        urgentPosition: 'AI产品经理',
        budgetRange: '30K-50K',
        teamSize: '10-20人',
        hireChannels: ['招聘平台', '猎头', '内推'],
        hiringExperience: 'AI SaaS行业招聘',
      },
    })
    console.log('✅ EnterpriseRecruitmentNeeds created')
  } else {
    console.log('⏭️ EnterpriseRecruitmentNeeds already exists')
  }

  console.log('\n🎉 Seed data creation complete!')
  console.log(`Job: AI产品经理 (${jobId})`)
  console.log('Candidates: 5')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e)
  prisma.$disconnect()
  process.exit(1)
})
