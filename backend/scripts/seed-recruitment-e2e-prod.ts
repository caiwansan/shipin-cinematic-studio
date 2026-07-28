/**
 * RECRUITMENT-E2E-DATA-01 — 企业招聘生产级 E2E 种子数据
 *
 * 生成完整业务链:
 *   OrgMember → Organization → EnterpriseProfile → JobCompanyProfile
 *   → EnterpriseJobWorkspace → JobPosting → CandidateMatch → CareerProfile
 *   → RecruitmentConversation → InterviewSession → RecruitmentPipeline → Offer/Hire
 *
 * 执行原则:
 *   - 幂等 (upsert / skip-if-exists)
 *   - 不走 SQL，纯 Prisma ORM
 *   - 不修改 legacy 数据
 *   - enterpriseId ≠ userId ≠ tenantId ≠ organizationId
 *
 * 运行: npx tsx scripts/seed-recruitment-e2e-prod.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── 固定 seed ID（便于调试追查，不依赖于随机 UUID） ───
const ORG_ID = 'a1000000-0000-4000-8000-000000000001'
const ENTERPRISE_PROFILE_ID = 'a1000000-0000-4000-8000-000000000002'
const JOB_COMPANY_PROFILE_ID = 'a1000000-0000-4000-8000-000000000003'
const WORKSPACE_ID = 'a1000000-0000-4000-8000-000000000004'

async function main() {
  console.log('══════════════════════════════════════════════════')
  console.log('  RECRUITMENT E2E PROD SEED — TASK 01')
  console.log('══════════════════════════════════════════════════\n')

  // ─── 1. 查找 admin 用户 ───
  const admin = await prisma.user.findFirst({ where: { email: 'admin@scs.com' } })
  if (!admin) throw new Error('Admin user not found (admin@scs.com)')
  console.log(`✅ Admin user: ${admin.username} (${admin.id})`)

  // ─── 2. 创建/查找 Organization ───
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: {
      id: ORG_ID,
      name: '星际影业 AI 招聘部门',
      slug: 'ai-recruitment-dept',
      plan: 'enterprise',
    },
    update: {},
  })
  console.log(`✅ Organization: ${org.name} (${org.id})`)

  // 2a. OrgMember 绑定
  const orgMember = await prisma.orgMember.upsert({
    where: { organizationId_userId: { organizationId: ORG_ID, userId: admin.id } },
    create: { organizationId: ORG_ID, userId: admin.id, role: 'OWNER' },
    update: {},
  })
  console.log(`✅ OrgMember: admin → ${org.name} (role: ${orgMember.role})`)

  // ─── 3. EnterpriseProfile ───
  const ep = await prisma.enterpriseProfile.upsert({
    where: { id: ENTERPRISE_PROFILE_ID },
    create: {
      id: ENTERPRISE_PROFILE_ID,
      organizationId: ORG_ID,
      industry: 'AI/互联网',
      businessSummary: '星际影业 — 企业 AI 招聘解决方案',
      targetCustomer: '科技企业、互联网公司',
      brandVoice: '专业、创新、高效',
      website: 'https://ai-recruitment.example.com',
      onboardingStep: 6,
      onboardingDone: true,
    },
    update: {},
  })
  console.log(`✅ EnterpriseProfile: ${ep.businessSummary} (${ep.id})`)

  // ─── 4. JobCompanyProfile ───
  const jcp = await prisma.jobCompanyProfile.upsert({
    where: { id: JOB_COMPANY_PROFILE_ID },
    create: {
      id: JOB_COMPANY_PROFILE_ID,
      enterpriseId: ORG_ID,
      industry: 'AI/互联网',
      scale: '50-200',
    },
    update: {},
  })
  console.log(`✅ JobCompanyProfile: ${jcp.id} (enterpriseId: ${jcp.enterpriseId})`)

  // ─── 5. EnterpriseJobWorkspace ───
  const ws = await prisma.enterpriseJobWorkspace.upsert({
    where: { id: WORKSPACE_ID },
    create: {
      id: WORKSPACE_ID,
      enterpriseId: ENTERPRISE_PROFILE_ID,
      name: '星际影业招聘空间',
      description: 'AI 招聘模块 E2E 生产级测试工作区',
      plan: 'basic',
      status: 'active',
    },
    update: {},
  })
  console.log(`✅ EnterpriseJobWorkspace: ${ws.name} (${ws.id})`)

  // ─── 6. 查找其他候选用户（已有 CareerProfile 的） ───
  const otherUsers = await prisma.user.findMany({
    where: { id: { not: admin.id } },
    orderBy: { createdAt: 'asc' },
    take: 12,
  })
  console.log(`\n✅ Available candidate users: ${otherUsers.length}`)

  // ─── 7. JobPostings (3 个发布状态) ───
  const jobData = [
    {
      id: 'a1000000-0000-4000-8000-000000000010',
      title: 'AI 产品经理',
      enterpriseId: JOB_COMPANY_PROFILE_ID,
      salary: '35K-55K·16薪',
      location: '北京·海淀',
      description: `岗位职责：
1. 负责 AI 产品线（智能客服、推荐系统）的产品规划与迭代
2. 深入理解大模型技术，将 AI 能力转化为商业产品
3. 协同算法、工程团队推动产品落地
4. 跟踪 AI 行业趋势，制定产品路线图

任职要求：
1. 本科及以上学历，计算机、AI、产品设计等相关专业
2. 3 年以上互联网产品经验，1 年以上 AI 产品经验
3. 熟悉 LLM、RAG、Agent 等技术原理
4. 具备优秀的逻辑思维和数据分析能力`,
      requirements: '1. 本科及以上，计算机/AI/产品设计专业\n2. 3年+产品经验，1年+AI产品经验\n3. 熟悉LLM/RAG/Agent等技术\n4. 优秀的数据分析能力',
      status: 'published',
      careerPath: '产品助理 → AI产品经理 → 高级AI产品经理 → 产品总监',
      industry: 'AI/互联网',
      skillRequirements: ['AI产品设计', '需求分析', '数据分析', '大模型应用', '产品路线图规划'],
      relatedSkills: ['LLM', 'RAG', 'Agent', '产品策略', '用户研究'],
      tags: ['AI产品', '大模型', '北京'],
      qualityScore: 88,
    },
    {
      id: 'a1000000-0000-4000-8000-000000000011',
      title: '高级后端工程师（AI 方向）',
      enterpriseId: JOB_COMPANY_PROFILE_ID,
      salary: '40K-65K·16薪',
      location: '北京·朝阳',
      description: `岗位职责：
1. 设计并实现高并发 AI 服务架构
2. 开发 RAG 引擎、Agent 编排系统等核心组件
3. 优化服务性能，保障系统稳定性
4. 参与技术方案评审与代码审查

任职要求：
1. 本科及以上学历，计算机相关专业
2. 5 年以上后端开发经验
3. 精通 Go/Python/Node.js，熟悉分布式系统设计
4. 有 AI 系统或搜索引擎开发经验优先`,
      requirements: '1. 本科及以上，计算机相关专业\n2. 5年+后端开发经验\n3. 精通Go/Python/Node.js\n4. 熟悉分布式系统',
      status: 'published',
      careerPath: '后端工程师 → 高级后端工程师 → 架构师 → 技术总监',
      industry: 'AI/互联网',
      skillRequirements: ['系统架构设计', 'Go', 'Python', '分布式系统', '微服务', '高并发'],
      relatedSkills: ['Kubernetes', 'Docker', 'Redis', 'Kafka', 'gRPC', 'PostgreSQL'],
      tags: ['后端', 'AI系统', '高并发'],
      qualityScore: 92,
    },
    {
      id: 'a1000000-0000-4000-8000-000000000012',
      title: '增长运营负责人',
      enterpriseId: JOB_COMPANY_PROFILE_ID,
      salary: '30K-50K·15薪',
      location: '上海·浦东',
      description: `岗位职责：
1. 制定产品增长策略，负责用户获取、激活、留存全链路
2. 搭建数据驱动的增长实验体系
3. 管理增长团队，协调产品、市场、销售资源
4. 监控核心指标，持续优化转化率

任职要求：
1. 本科及以上学历，市场营销、数据分析、计算机等相关专业
2. 4 年以上增长/运营经验
3. 精通 A/B 测试、用户分群、漏斗分析
4. 有 SaaS 或 AI 产品增长经验优先`,
      requirements: '1. 本科及以上\n2. 4年+增长/运营经验\n3. 精通A/B测试和漏斗分析\n4. 有SaaS增长经验优先',
      status: 'published',
      careerPath: '运营专员 → 增长经理 → 增长负责人 → CGO',
      industry: 'AI/互联网',
      skillRequirements: ['增长策略', '数据分析', 'A/B测试', '用户运营', '渠道投放'],
      relatedSkills: ['Google Analytics', 'SQL', '用户分群', '内容营销', 'SEO/SEM'],
      tags: ['增长', '运营', '上海'],
      qualityScore: 85,
    },
  ]

  const createdJobs: any[] = []
  for (const jd of jobData) {
    const job = await prisma.jobPosting.upsert({
      where: { id: jd.id },
      create: jd,
      update: jd,
    })
    createdJobs.push(job)
    console.log(`✅ JobPosting: ${job.title} (${job.status})`)
  }

  // ─── 8. CareerProfiles (10+) ───
  const candidateProfiles = [
    {
      fullName: '张明远',
      headline: '资深 AI 产品专家，10年互联网经验',
      bio: '前字节跳动 AI 产品负责人，主导过豆包、扣子等产品。擅长从 0 到 1 构建 AI 产品。',
      email: 'zhangmy@example.com',
      city: '北京',
      careerDirection: 'AI产品经理',
      industry: 'AI/互联网',
      yearsExperience: 10,
      currentLevel: 'senior',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
      education: '清华大学 计算机科学与技术 硕士',
      experience: '字节跳动 AI产品负责人 2020-2026\n腾讯 高级产品经理 2016-2020',
      skills: ['AI产品设计', '需求分析', '数据分析', '大模型应用', '产品路线图', '用户研究'],
    },
    {
      fullName: '李思涵',
      headline: '全栈工程师，精通 Go/React/AI 系统架构',
      bio: '前阿里云 AI 平台后端负责人，主导过通义千问 API 网关设计。开源贡献者。',
      email: 'lisih@example.com',
      city: '北京',
      careerDirection: '后端架构',
      industry: 'AI/互联网',
      yearsExperience: 8,
      currentLevel: 'senior',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
      education: '北京大学 计算机科学与技术 本科',
      experience: '阿里云 AI平台后端负责人 2019-2026\n美团 后端工程师 2016-2019',
      skills: ['Go', 'Python', '分布式系统', 'Kubernetes', '微服务', 'AI系统架构'],
    },
    {
      fullName: '王晓彤',
      headline: '增长黑客，擅长数据驱动增长模型',
      bio: '前陌陌增长负责人，5年用户增长经验。擅长 A/B 测试、用户分群和增长飞轮设计。',
      email: 'wangxt@example.com',
      city: '上海',
      careerDirection: '增长运营',
      industry: '互联网',
      yearsExperience: 5,
      currentLevel: 'mid',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
      education: '复旦大学 市场营销 硕士',
      experience: '陌陌 增长负责人 2021-2026\n小红书 用户运营 2019-2021',
      skills: ['增长策略', '数据分析', 'A/B测试', '用户运营', 'SQL', '内容营销'],
    },
    {
      fullName: '陈昊天',
      headline: 'NLP 算法专家，C端 AI 产品经验丰富',
      bio: '专注 NLP 与对话系统，主导过千万 DAU AI 产品的算法设计。发表 5 篇顶会论文。',
      email: 'chenht@example.com',
      city: '北京',
      careerDirection: 'AI算法工程师',
      industry: 'AI/互联网',
      yearsExperience: 6,
      currentLevel: 'senior',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
      education: '中国科学院大学 人工智能 博士',
      experience: '百度 NLP算法工程师 2020-2026\n微软亚洲研究院 研究员 2018-2020',
      skills: ['NLP', '大模型', '对话系统', 'Python', 'PyTorch', '推荐系统'],
    },
    {
      fullName: '赵雨晴',
      headline: 'B端产品专家，3年 SaaS 产品经验',
      bio: '深耕 B 端 SaaS 产品，主导过 3 款企服产品从 0 到 1。对 AI+ 企服有深刻理解。',
      email: 'zhaoyq@example.com',
      city: '杭州',
      careerDirection: 'AI产品经理',
      industry: '企业服务',
      yearsExperience: 4,
      currentLevel: 'mid',
      jobSeekingStatus: 'open',
      openToOpportunity: true,
      visibility: 'public',
      education: '浙江大学 产品设计 本科',
      experience: '钉钉 产品经理 2022-2026\n有赞 产品助理 2020-2022',
      skills: ['B端产品', 'SaaS产品', '需求分析', '项目管理', '用户研究', '数据分析'],
    },
    {
      fullName: '刘一鸣',
      headline: '资深后端开发，微服务与云原生专家',
      bio: '7 年后端经验，精通 Go/Java 微服务架构。主导过日活千万级电商系统的重构。',
      email: 'liuym@example.com',
      city: '北京',
      careerDirection: '后端开发',
      industry: '互联网',
      yearsExperience: 7,
      currentLevel: 'senior',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
      education: '北京邮电大学 计算机技术 硕士',
      experience: '京东 高级后端工程师 2019-2026\n快手 后端工程师 2017-2019',
      skills: ['Go', 'Java', '微服务', 'Docker', 'Kubernetes', '高并发', '分布式'],
    },
    {
      fullName: '林小婉',
      headline: '增长运营经理，擅长社群与内容驱动增长',
      bio: '4 年运营经验，擅长社群运营和内容营销。曾打造多个万人级用户社群。',
      email: 'linxw@example.com',
      city: '上海',
      careerDirection: '增长运营',
      industry: '互联网',
      yearsExperience: 4,
      currentLevel: 'mid',
      jobSeekingStatus: 'open',
      openToOpportunity: true,
      visibility: 'public',
      education: '上海交通大学 传播学 本科',
      experience: 'B站 用户运营经理 2022-2026\n知乎 社群运营 2020-2022',
      skills: ['社群运营', '内容营销', '数据分析', '活动策划', 'KOL管理', '品牌传播'],
    },
    {
      fullName: '孙浩宇',
      headline: 'AI 算法工程师，专注推荐系统与搜索',
      bio: '3 年推荐系统算法经验。主导过短视频推荐算法的优化，CTR 提升 15%。',
      email: 'sunhy@example.com',
      city: '深圳',
      careerDirection: 'AI算法工程师',
      industry: 'AI/互联网',
      yearsExperience: 3,
      currentLevel: 'mid',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
      education: '华中科技大学 人工智能 硕士',
      experience: '腾讯 算法工程师 2023-2026\n字节跳动 算法实习生 2022-2023',
      skills: ['推荐系统', 'Python', 'TensorFlow', '数据分析', '召回排序', 'A/B测试'],
    },
    {
      fullName: '周逸凡',
      headline: '全栈产品经理，AI+ 教育领域深耕者',
      bio: '5 年产品经验，专注 AI+教育赛道。主导过在线教育平台 AI 助教产品。',
      email: 'zhouyf@example.com',
      city: '北京',
      careerDirection: 'AI产品经理',
      industry: '教育科技',
      yearsExperience: 5,
      currentLevel: 'mid',
      jobSeekingStatus: 'open',
      openToOpportunity: true,
      visibility: 'public',
      education: '北京师范大学 教育技术 硕士',
      experience: '好未来 AI产品经理 2021-2026\n得到 产品经理 2019-2021',
      skills: ['AI产品', '教育产品', '需求分析', '用户调研', '原型设计', '数据分析'],
    },
    {
      fullName: '何天瑞',
      headline: '后端开发工程师，微服务与 AI 系统方向',
      bio: '5 年后端经验，精通 Python/Node.js。曾参与构建千亿级数据处理管道。',
      email: 'hetr@example.com',
      city: '北京',
      careerDirection: '后端开发',
      industry: 'AI/互联网',
      yearsExperience: 5,
      currentLevel: 'mid',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
      education: '西安电子科技大学 软件工程 本科',
      experience: '百度 后端开发 2021-2026\n旷视科技 后端开发 2019-2021',
      skills: ['Python', 'Node.js', 'Kafka', 'Redis', '微服务', '数据处理', 'AI系统'],
    },
  ]

  // count existing CareerProfiles
  const existingCpCount = await prisma.careerProfile.count()
  console.log(`\nExisting CareerProfiles: ${existingCpCount}`)

  // We need to create CareerProfiles WITHOUT userId (because we need unique users).
  // The CareerProfile model requires a unique userId.
  // We can either:
  //   A) Create fake users for each profile
  //   B) Work with existing users and update their profiles
  
  // Let's create fake candidate users and their CareerProfiles
  const createdProfiles: any[] = []
  
  for (const [i, cp] of candidateProfiles.entries()) {
    // Create a fake user for this candidate
    const candidateEmail = cp.email
    let candidateUser = await prisma.user.findUnique({ where: { email: candidateEmail } })
    
    if (!candidateUser) {
      candidateUser = await prisma.user.create({
        data: {
          email: candidateEmail,
          username: cp.fullName,
          passwordHash: 'seed-candidate-no-login',
          memberTier: 'free',
        },
      })
    }
    
    // Check if CareerProfile already exists for this user
    const existingProfile = await prisma.careerProfile.findUnique({
      where: { userId: candidateUser.id },
    })
    
    if (existingProfile) {
      createdProfiles.push(existingProfile)
      console.log(`  ⏭️  CareerProfile exists: ${cp.fullName}`)
      continue
    }
    
    // Create work experiences and education
    const profile = await prisma.careerProfile.create({
      data: {
        candidateId: candidateUser.id,
        userId: candidateUser.id,
        fullName: cp.fullName,
        headline: cp.headline,
        bio: cp.bio,
        email: cp.email,
        city: cp.city,
        careerDirection: cp.careerDirection,
        industry: cp.industry,
        yearsExperience: cp.yearsExperience,
        currentLevel: cp.currentLevel,
        jobSeekingStatus: cp.jobSeekingStatus,
        openToOpportunity: cp.openToOpportunity,
        visibility: cp.visibility,
        completionScore: 85,
        lastActiveAt: new Date(),
      },
    })
    
    // Create education record
    await prisma.education.create({
      data: {
        profileId: profile.id,
        school: cp.education.split(' ').slice(0, -1).join(' '),
        degree: cp.education.includes('博士') ? '博士' : cp.education.includes('硕士') ? '硕士' : '本科',
        major: cp.education.split(' ').pop() || cp.careerDirection,
        startDate: new Date('2014-09-01'),
        endDate: new Date('2018-07-01'),
        description: cp.education,
      },
    })
    
    // Create skill records — Skill requires skillId referencing Skill table
    // Skip inline creation; skills will be linked via CareerProfile context
    // Skills are captured in workExperience.skillsUsed for matching purposes
    
    // Create work experiences
    const expLines = cp.experience.split('\n')
    for (let ei = 0; ei < expLines.length; ei++) {
      const line = expLines[ei].trim()
      if (!line) continue
      const parts = line.split(' ')
      const company = parts[0] || '某公司'
      const title = parts[1] || '工程师'
      const years = parts[2] || '2020-2024'
      const yearRange = years.split('-')
      const startYear = parseInt(yearRange[0]) || 2020
      const endYear = parseInt(yearRange[1]) || 2024
      
      await prisma.workExperience.create({
        data: {
          profileId: profile.id,
          company,
          title,
          startDate: new Date(`${startYear}-01-01`),
          endDate: new Date(`${endYear}-12-31`),
          isCurrent: ei === 0,
          description: `在${company}担任${title}`,
          skillsUsed: cp.skills.slice(0, 3),
          source: 'user',
          verified: false,
        },
      })
    }
    
    createdProfiles.push(profile)
    console.log(`  ✅ Created CareerProfile: ${cp.fullName} (${cp.careerDirection})`)
  }
  
  console.log(`\nTotal CareerProfiles: ${createdProfiles.length}`)

  // ─── 9. CandidateMatches (20+) ───
  const matchBreakdown = { skill: 40, experience: 30, education: 15, career: 15 }
  
  // Define scoring: for each (profileIndex, jobIndex) → [score, reason]
  const matchAssignments: [number, number, number, string][] = [
    // job[0] = AI产品经理 — match with product managers and AI engineers
    [0, 0, 92, 'AI产品经验丰富，技能高度匹配，大模型产品理解深入'],
    [4, 0, 85, 'B端产品经验匹配，AI理解需要加强'],
    [8, 0, 88, 'AI+教育产品经验相关，跨领域可迁移'],
    [3, 0, 70, '算法背景转向产品，技术理解力强但产品管理经验不足'],
    // job[1] = 高级后端工程师 — match with backend engineers
    [1, 1, 95, 'Go/Python精通，AI系统架构经验丰富，高度推荐'],
    [5, 1, 88, '微服务与云原生专家，架构匹配度高'],
    [9, 1, 82, 'Python/Node.js经验匹配，数据处理能力强'],
    [6, 1, 75, 'Java为主，Go经验有限，但架构理解较好'],
    [2, 1, 45, '运营背景，技术栈不匹配'],
    [7, 1, 35, '算法方向，后端开发经验不足'],
    // job[2] = 增长运营负责人 — match with growth/ops
    [2, 2, 90, '增长黑客经验丰富，A/B测试和数据驱动实践丰富'],
    [6, 2, 82, '社群和内容增长能力强，与岗位高度匹配'],
    [0, 2, 55, '产品背景，增长经验有限但产品思维可迁移'],
    [4, 2, 50, 'B端产品背景，增长理解较弱'],
    // cross matches (more variety)
    [3, 2, 60, '算法背景，增长数据分析有帮助但运营经验不足'],
    [5, 2, 65, '技术背景，可以对增长提供技术支撑'],
    [8, 2, 70, 'AI教育产品背景，增长思维有一定基础'],
    [9, 2, 55, '后端背景，增长专业度不足'],
    [1, 2, 40, '后端架构师，增长运营不匹配'],
    [7, 2, 75, '推荐系统背景，数据增长方向可迁移'],
    [0, 1, 50, '产品转技术方向，技能差距较大'],
    [3, 1, 65, 'NLP算法背景，可从事AI后端但缺少工程经验'],
  ]

  // Clean existing matches that belong to our workspace to avoid stale data
  const existingMatches = await prisma.candidateMatch.findMany({
    where: { workspaceId: WORKSPACE_ID },
  })
  if (existingMatches.length > 0) {
    // Delete matches that reference profiles we're about to create
    // Actually just delete all matches in our workspace for clean state
    await prisma.candidateMatch.deleteMany({ where: { workspaceId: WORKSPACE_ID } })
    console.log(`\n🗑️  Cleared ${existingMatches.length} existing matches for workspace`)
  }

  const createdMatches: any[] = []
  for (const [profileIdx, jobIdx, score, reason] of matchAssignments) {
    const profile = createdProfiles[profileIdx]
    const job = createdJobs[jobIdx]
    
    if (!profile || !job) {
      console.log(`  ⚠️  Skip match: profile[${profileIdx}] or job[${jobIdx}] not found`)
      continue
    }
    
    const match = await prisma.candidateMatch.create({
      data: {
        workspaceId: WORKSPACE_ID,
        jobId: job.id,
        candidateId: profile.id,
        matchScore: score,
        matchBreakdown: matchBreakdown as any,
        status: score >= 80 ? 'strong_match' : score >= 60 ? 'potential' : 'weak',
        aiAnalysis: reason,
      },
    })
    createdMatches.push(match)
  }
  console.log(`\n✅ CandidateMatches: ${createdMatches.length}`)

  // ─── 10. RecruitmentConversations (5+) ───
  const existingConversations = await prisma.recruitmentConversation.count({
    where: { workspaceId: WORKSPACE_ID },
  })
  if (existingConversations > 0) {
    await prisma.conversationMessage.deleteMany({
      where: { conversation: { workspaceId: WORKSPACE_ID } },
    })
    await prisma.recruitmentConversation.deleteMany({
      where: { workspaceId: WORKSPACE_ID },
    })
    console.log(`🗑️  Cleared ${existingConversations} existing conversations`)
  }

  const conversationData = [
    {
      matchIdx: 0,
      status: 'CHATTING',
      stage: 'chatting',
      matchScore: 92,
      reviewPriority: 1,
    },
    {
      matchIdx: 2,
      status: 'REVIEWED',
      stage: 'reviewed',
      matchScore: 85,
      reviewPriority: 2,
      reviewSubmittedAt: new Date(Date.now() - 86400000 * 2),
      reviewDecision: 'approve',
      reviewNote: '候选人与岗位匹配度高，推荐进入面试',
    },
    {
      matchIdx: 4,
      status: 'INVITED',
      stage: 'invited',
      matchScore: 88,
      reviewPriority: 3,
    },
    {
      matchIdx: 5,
      status: 'CLOSED',
      stage: 'closed',
      matchScore: 82,
      reviewDecision: 'reject',
      reviewNote: '技能方向微有偏差，暂不匹配',
      closedAt: new Date(Date.now() - 86400000),
    },
    {
      matchIdx: 8,
      status: 'DISCOVERED',
      stage: 'discovered',
      matchScore: 75,
      reviewPriority: 0,
    },
    {
      matchIdx: 10,
      status: 'CHATTING',
      stage: 'chatting',
      matchScore: 90,
      reviewPriority: 1,
    },
  ]

    // Get or create EnterpriseAgentInstance for recruiter
  // DB lacks organization_id column (migration pending) — use raw SQL
  const crypto = require('crypto')
  const existingAgents: any[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM enterprise_agent_instance WHERE tenant_id = $1 AND namespace LIKE $2 LIMIT 1`,
    ORG_ID,
    '%recruiter%'
  )
  let recruiterAgentId: string
  if (existingAgents.length > 0) {
    recruiterAgentId = existingAgents[0].id
  } else {
    const ts = Date.now().toString(36)
    const newId = crypto.randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO enterprise_agent_instance (id, tenant_id, employee_id, agent_id, namespace, runtime_status, lifecycle_state, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', 'ACTIVE', $6, NOW(), NOW())`,
      newId, ORG_ID, `recruiter-${ts}`, `agent_recruiter_${ts}`,
      `tenant_${ORG_ID.slice(0,8)}_recruiter`,
      JSON.stringify({ role: 'recruiter', source: 'seed-e2e' })
    )
    recruiterAgentId = newId
  }

  const createdConversations: any[] = []
  for (const cd of conversationData) {
    const match = createdMatches[cd.matchIdx]
    if (!match) {
      console.log(`  ⚠️  Skip conversation: match[${cd.matchIdx}] not found`)
      continue
    }
    
    // Find the profile and job for this match
    const convMatch = await prisma.candidateMatch.findUnique({
      where: { id: match.id },
    })
    if (!convMatch) continue
    
    const conv = await prisma.recruitmentConversation.create({
      data: {
        workspaceId: WORKSPACE_ID,
        enterpriseId: ENTERPRISE_PROFILE_ID,
        jobPostingId: convMatch.jobId,
        candidateId: convMatch.candidateId,
        recruiterAgentId: recruiterAgentId,
        status: cd.status,
        stage: cd.stage,
        matchScore: cd.matchScore,
        reviewPriority: cd.reviewPriority,
        invitedAt: cd.status === 'INVITED' || cd.status === 'CHATTING' ? new Date(Date.now() - 86400000 * 3) : undefined,
        chattingStartedAt: cd.status === 'CHATTING' ? new Date(Date.now() - 86400000 * 2) : undefined,
        reviewSubmittedAt: cd.reviewSubmittedAt,
        reviewDecision: cd.reviewDecision,
        reviewNote: cd.reviewNote,
        closedAt: cd.closedAt,
      },
    })
    
    // Add a few messages for chatting conversations
    if (cd.status === 'CHATTING') {
      await prisma.conversationMessage.createMany({
        data: [
          {
            conversationId: conv.id,
            content: `您好！我是星际影业的 AI 招聘官。看到您对我们发布的 AI 产品经理岗位很感兴趣，想和您聊聊更多细节。`,
            role: 'assistant',
            createdAt: new Date(Date.now() - 86400000 * 2),
          },
          {
            conversationId: conv.id,
            content: `感谢联系！我想了解一下这个岗位的具体工作内容和团队情况。`,
            role: 'user',
            createdAt: new Date(Date.now() - 86400000 * 2 + 3600000),
          },
          {
            conversationId: conv.id,
            content: `好的，我来详细介绍一下。我们 AI 产品团队目前负责智能客服、推荐系统两条核心产品线...`,
            role: 'assistant',
            createdAt: new Date(Date.now() - 86400000 * 1),
          },
        ],
      })
    }
    
    createdConversations.push(conv)
    console.log(`  ✅ RecruitmentConversation: ${cd.status} (match[${cd.matchIdx}])`)
  }
  console.log(`\n✅ RecruitmentConversations: ${createdConversations.length}`)

  // ─── 11. InterviewSessions (5+, 覆盖 scheduled | completed | evaluation) ───
  const existingSessions = await prisma.interviewSession.count({
    where: { workspaceId: WORKSPACE_ID },
  })
  if (existingSessions > 0) {
    await prisma.interviewQuestion.deleteMany({
      where: { session: { workspaceId: WORKSPACE_ID } },
    })
    await prisma.interviewEvaluation.deleteMany({
      where: { session: { workspaceId: WORKSPACE_ID } },
    })
    await prisma.interviewDecision.deleteMany({
      where: { session: { workspaceId: WORKSPACE_ID } },
    })
    await prisma.interviewNote.deleteMany({
      where: { session: { workspaceId: WORKSPACE_ID } },
    })
    await prisma.interviewSession.deleteMany({
      where: { workspaceId: WORKSPACE_ID },
    })
    console.log(`🗑️  Cleared ${existingSessions} existing sessions`)
  }

  // Re-fetch matches with their relations
  const topMatches = await prisma.candidateMatch.findMany({
    where: {
      workspaceId: WORKSPACE_ID,
      matchScore: { gte: 70 },
    },
    orderBy: { matchScore: 'desc' },
    take: 5,
    include: {
      job: { select: { id: true, title: true } },
    },
  })

  // Also get matching profiles for names
  const candidateProfilesMap = new Map(createdProfiles.map(p => [p.id, p]))

  const sessionStatuses = ['scheduled', 'completed', 'evaluation', 'scheduled', 'scheduled']
  for (let i = 0; i < Math.min(topMatches.length, 5); i++) {
    const match = topMatches[i]
    const profile = candidateProfilesMap.get(match.candidateId)
    if (!profile) continue
    
    const status = sessionStatuses[i]
    const candidateName = profile.fullName
    
    const session = await prisma.interviewSession.create({
      data: {
        workspaceId: WORKSPACE_ID,
        jobId: match.jobId,
        candidateName,
        title: status === 'scheduled'
          ? `初面 - ${candidateName} 应聘 ${match.job.title}`
          : status === 'completed'
            ? `技术面 - ${candidateName} 应聘 ${match.job.title}`
            : `终面 - ${candidateName} 应聘 ${match.job.title}`,
        status,
        startedAt: status === 'scheduled'
          ? new Date(Date.now() + 86400000 * (i + 1))
          : status === 'completed'
            ? new Date(Date.now() - 86400000 * 3)
            : new Date(Date.now() - 86400000 * 5),
        completedAt: status !== 'scheduled'
          ? new Date(Date.now() - 86400000 * (status === 'completed' ? 2 : 4))
          : undefined,
      },
    })

    // Add questions for completed/evaluation sessions
    if (status !== 'scheduled') {
      await prisma.interviewQuestion.createMany({
        data: [
          {
            sessionId: session.id,
            category: '技术能力',
            question: '请描述一次你主导的复杂系统架构设计经历。',
            expectedAnswer: '期望看到系统设计思路、技术选型理由、面对挑战的解决方案',
            answer: '曾在公司主导了微服务架构拆分，将单体应用拆分为 12 个微服务，引入消息队列解耦，服务可用性从 99.9% 提升至 99.99%。',
            score: 88,
          },
          {
            sessionId: session.id,
            category: '项目经验',
            question: '你是如何推动跨团队协作的？',
            expectedAnswer: '期望看到沟通协调能力、项目推进方法',
            answer: '建立周同步机制，使用 OKR 对齐目标，遇到冲突时用数据说话。在一次关键项目中协调了 5 个团队按时交付。',
            score: 85,
          },
          {
            sessionId: session.id,
            category: 'AI 能力',
            question: '你对大模型在行业中的应用有什么看法？',
            expectedAnswer: '了解大模型技术趋势，有实际应用经验',
            answer: '大模型正在重塑行业，我在上一家公司落地了 RAG 客服系统，将问题解决率提升 40%。同时关注 Agent 和多模态方向。',
            score: null, // no score yet
          },
        ],
      })
    }

    // Add evaluation for completed/evaluation sessions
    if (status === 'completed' || status === 'evaluation') {
      await prisma.interviewEvaluation.create({
        data: {
          sessionId: session.id,
          overallScore: 85,
          technicalScore: 88,
          communicationScore: 82,
          cultureScore: 90,
          strengths: ['技术功底扎实', '团队协作能力强', '学习能力突出'],
          risks: ['管理经验较少', '对业务理解需加强'],
          recommendation: '推荐录用',
          summary: '候选人技术能力优秀，沟通表达清晰，对 AI 行业有深入理解。虽然管理经验稍显不足，但有很强的成长潜力。',
          nextSteps: ['安排与 VP 终面', '进行背景调查', '准备 Offer'],
        },
      })
    }

    // Add notes
    if (status !== 'scheduled') {
      await prisma.interviewNote.create({
        data: {
          sessionId: session.id,
          content: status === 'completed'
            ? '技术面表现优秀，建议进入下一轮面试'
            : '终面评估整体积极，团队匹配度高',
        },
      })
    }

    console.log(`  ✅ InterviewSession: ${candidateName} → ${match.job.title} (${status})`)
  }
  console.log(`\n✅ InterviewSessions: ${Math.min(topMatches.length, 5)}`)

  // ─── 12. RecruitmentPipeline (完整阶段: APPLIED → SCREENING → INTERVIEW → OFFER → HIRED) ───
  const existingPipelines = await prisma.recruitmentPipeline.count({
    where: { workspaceId: WORKSPACE_ID },
  })
  if (existingPipelines > 0) {
    await prisma.candidateNote.deleteMany({
      where: { pipeline: { workspaceId: WORKSPACE_ID } },
    })
    await prisma.pipelineEvent.deleteMany({
      where: { pipeline: { workspaceId: WORKSPACE_ID } },
    })
    await prisma.recruitmentPipeline.deleteMany({
      where: { workspaceId: WORKSPACE_ID },
    })
    console.log(`🗑️  Cleared ${existingPipelines} existing pipelines`)
  }

  const pipelineData: { matchIdx: number; stage: string; score: number; tags: string[] }[] = [
    { matchIdx: 0, stage: 'APPLIED', score: 92, tags: ['AI产品', '高匹配'] },
    { matchIdx: 1, stage: 'SCREENING', score: 95, tags: ['后端', '架构师', 'A1'] },
    { matchIdx: 2, stage: 'INTERVIEW', score: 90, tags: ['增长', '面试中'] },
    { matchIdx: 4, stage: 'OFFER', score: 88, tags: ['后端', 'Offer审批中'] },
    { matchIdx: 11, stage: 'INTERVIEW', score: 82, tags: ['后端', '技术面'] },
    { matchIdx: 12, stage: 'HIRED', score: 85, tags: ['增长', '已入职'] },
    { matchIdx: 3, stage: 'SCREENING', score: 70, tags: ['AI', '待定'] },
    { matchIdx: 13, stage: 'APPLIED', score: 60, tags: ['算法', '初筛'] },
  ]

  // Create pipelines and relate them to matches where possible
  for (const pd of pipelineData) {
    const match = createdMatches[pd.matchIdx]
    if (!match) {
      console.log(`  ⚠️  Skip pipeline: match[${pd.matchIdx}] not found`)
      continue
    }
    
    const matchFull = await prisma.candidateMatch.findUnique({
      where: { id: match.id },
    })
    if (!matchFull) continue
    
    const profile = candidateProfilesMap.get(matchFull.candidateId)
    const candidateName = profile?.fullName || '候选人'
    
    // Find associated job
    const job = createdJobs.find(j => j.id === matchFull.jobId)
    
    // Check if pipeline already exists for this stage combination
    const pipeline = await prisma.recruitmentPipeline.create({
      data: {
        workspaceId: WORKSPACE_ID,
        jobId: matchFull.jobId,
        candidateName,
        stage: pd.stage,
        screeningScore: pd.score,
        interviewCount: pd.stage === 'INTERVIEW' || pd.stage === 'OFFER' ? 2 : pd.stage === 'HIRED' ? 3 : 0,
        lastActivityAt: new Date(),
        autoCreated: false,
        offerStatus: pd.stage === 'OFFER' ? 'pending' : pd.stage === 'HIRED' ? 'accepted' : null,
        tags: pd.tags,
      },
    })
    
    // Create pipeline events
    const eventTypes: string[] = []
    if (pd.stage === 'SCREENING') eventTypes.push('screening_started')
    else if (pd.stage === 'INTERVIEW') { eventTypes.push('screening_passed', 'interview_scheduled') }
    else if (pd.stage === 'OFFER') { eventTypes.push('screening_passed', 'interview_completed', 'offer_initiated') }
    else if (pd.stage === 'HIRED') { eventTypes.push('screening_passed', 'interview_completed', 'offer_accepted', 'hired') }
    else if (pd.stage === 'APPLIED') eventTypes.push('applied')
    
    for (const eventType of eventTypes) {
      await prisma.pipelineEvent.create({
        data: {
          pipelineId: pipeline.id,
          type: eventType,
          actor: 'ai_agent',
          metadata: { autoCreated: false, source: 'seed-e2e' },
        },
      })
    }
    
    // Add notes
    if (pd.stage === 'OFFER' || pd.stage === 'HIRED') {
      await prisma.candidateNote.create({
        data: {
          pipelineId: pipeline.id,
          content: `候选人 ${candidateName} ${pd.stage === 'OFFER' ? '已进入 Offer 审批流程' : '已确认入职，欢迎加入团队！'}`,
        },
      })
    }
    
    console.log(`  ✅ Pipeline: ${candidateName} → ${job?.title || '未知'} @ ${pd.stage}`)
  }
  
  const finalPipelineCount = await prisma.recruitmentPipeline.count({
    where: { workspaceId: WORKSPACE_ID },
  })
  console.log(`\n✅ RecruitmentPipelines: ${finalPipelineCount}`)

  // ─── 13. Final Summary ───
  console.log('\n══════════════════════════════════════════════════')
  console.log('  RECRUITMENT E2E SEED — FINAL SUMMARY')
  console.log('══════════════════════════════════════════════════')

  const summary = {
    Organization: await prisma.organization.count({ where: { id: ORG_ID } }),
    OrgMember: await prisma.orgMember.count({ where: { organizationId: ORG_ID } }),
    EnterpriseProfile: await prisma.enterpriseProfile.count({ where: { id: ENTERPRISE_PROFILE_ID } }),
    JobCompanyProfile: await prisma.jobCompanyProfile.count({ where: { id: JOB_COMPANY_PROFILE_ID } }),
    EnterpriseJobWorkspace: await prisma.enterpriseJobWorkspace.count({ where: { id: WORKSPACE_ID } }),
    JobPosting: await prisma.jobPosting.count({ where: { enterpriseId: JOB_COMPANY_PROFILE_ID } }),
    CareerProfile: await prisma.careerProfile.count(),
    CandidateMatch: await prisma.candidateMatch.count({ where: { workspaceId: WORKSPACE_ID } }),
    RecruitmentConversation: await prisma.recruitmentConversation.count({ where: { workspaceId: WORKSPACE_ID } }),
    InterviewSession: await prisma.interviewSession.count({ where: { workspaceId: WORKSPACE_ID } }),
    RecruitmentPipeline: await prisma.recruitmentPipeline.count({ where: { workspaceId: WORKSPACE_ID } }),
  }

  for (const [key, value] of Object.entries(summary)) {
    const status = value > 0 ? '✅' : '❌'
    console.log(`  ${status} ${key}: ${value}`)
  }
  console.log('\n  Identity Chain: OrgMember → Organization → EnterpriseProfile → JobCompanyProfile → Workspace')
  console.log('  Business Chain: JobPosting → CandidateMatch → CareerProfile → Conversation → Interview → Pipeline')
  console.log('═══ ALL SEED DATA CREATED ═══\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
