/**
 * Career Tool Registry — KM-AI-JOB-AGENT-08
 * AI 职业助理可用工具注册表
 *
 * 架构：
 *   - 复用企业端 ToolContext/ToolResult 接口
 *   - 所有工具只读或生成建议，不直接修改业务数据（L1 范围）
 *   - 面向个人用户：简历分析、岗位搜索、职业规划、面试准备、薪资分析
 *
 * 权限分层：
 *   L1 建议行动（安全）— 无需权限
 *   L2 半自动执行（需确认）— 用户点击确认后执行
 *   L3 自动执行（未来）— 第一版不做
 */

import type { PrismaClient } from '@prisma/client'

// ─── 工具定义（复用企业端接口）──────────────────────────

export interface CareerToolDefinition {
  name: string
  description: string
  category: 'read' | 'analyze' | 'search' | 'plan' | 'report'
  params: CareerToolParam[]
  requiredPermission: string
  execute: (ctx: CareerToolContext, params: any) => Promise<CareerToolResult>
}

export interface CareerToolParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required: boolean
  enum?: string[]
}

export interface CareerToolContext {
  prisma: PrismaClient
  tenantId: string      // 个人用户 userId 作为 tenantId
  userId: string        // 个人用户 ID
  agentId: string       // AgentDef ID
  agentInstanceId: string
  memoryNamespace: string
}

export interface CareerToolResult {
  success: boolean
  data?: any
  error?: string
  sources: string[]
}

// ─── Career Tool Registry ───────────────────────────────

export class CareerToolRegistry {
  private tools: Map<string, CareerToolDefinition> = new Map()

  constructor(private prisma: PrismaClient) {
    this.registerCareerTools()
  }

  getAvailableTools(allowedToolNames: string[]): CareerToolDefinition[] {
    return allowedToolNames
      .map(name => this.tools.get(name))
      .filter((t): t is CareerToolDefinition => !!t)
  }

  getTool(name: string): CareerToolDefinition | undefined {
    return this.tools.get(name)
  }

  listTools(): CareerToolDefinition[] {
    return Array.from(this.tools.values())
  }

  // ─── 求职工具注册 ─────────────────────────────────────

  private registerCareerTools() {
    // ── resume_analyze ──
    this.tools.set('resume_analyze', {
      name: 'resume_analyze',
      description: '分析用户简历：技能、经验、教育背景、优劣势',
      category: 'analyze',
      params: [
        {
          name: 'resumeId',
          type: 'string',
          description: '简历ID（可选，不传则分析最新简历）',
          required: false,
        },
      ],
      requiredPermission: 'resume:analyze',
      execute: executeResumeAnalyze,
    })

    // ── job_search ──
    this.tools.set('job_search', {
      name: 'job_search',
      description: '搜索岗位市场：按关键词、地点、薪资范围搜索',
      category: 'search',
      params: [
        {
          name: 'keyword',
          type: 'string',
          description: '搜索关键词（岗位名/技能）',
          required: false,
        },
        {
          name: 'location',
          type: 'string',
          description: '工作地点',
          required: false,
        },
        {
          name: 'minSalary',
          type: 'number',
          description: '最低薪资要求（K/月）',
          required: false,
        },
        {
          name: 'limit',
          type: 'number',
          description: '返回数量上限',
          required: false,
        },
      ],
      requiredPermission: 'job:search',
      execute: executeJobSearch,
    })

    // ── job_match ──
    this.tools.set('job_match', {
      name: 'job_match',
      description: '匹配用户简历与岗位：计算匹配度、分析差距',
      category: 'analyze',
      params: [
        {
          name: 'jobId',
          type: 'string',
          description: '岗位ID',
          required: true,
        },
      ],
      requiredPermission: 'job:match',
      execute: executeJobMatch,
    })

    // ── career_plan ──
    this.tools.set('career_plan', {
      name: 'career_plan',
      description: '生成职业规划：基于当前状态和目标生成行动计划',
      category: 'plan',
      params: [
        {
          name: 'goal',
          type: 'string',
          description: '职业目标',
          required: true,
          enum: ['换工作', '转行业', '提升技能', '准备面试', '薪资谈判'],
        },
        {
          name: 'timeFrame',
          type: 'string',
          description: '时间框架',
          required: false,
          enum: ['1个月', '3个月', '6个月', '1年'],
        },
      ],
      requiredPermission: 'career:plan',
      execute: executeCareerPlan,
    })

    // ── interview_prepare ──
    this.tools.set('interview_prepare', {
      name: 'interview_prepare',
      description: '面试准备：基于岗位生成面试问题和建议',
      category: 'plan',
      params: [
        {
          name: 'jobId',
          type: 'string',
          description: '目标岗位ID',
          required: true,
        },
        {
          name: 'interviewType',
          type: 'string',
          description: '面试类型',
          required: false,
          enum: ['初面', '技术面', '行为面', '终面'],
        },
      ],
      requiredPermission: 'interview:prepare',
      execute: executeInterviewPrepare,
    })

    // ── salary_analysis ──
    this.tools.set('salary_analysis', {
      name: 'salary_analysis',
      description: '薪资分析：分析岗位薪资水平、行业对比',
      category: 'analyze',
      params: [
        {
          name: 'jobTitle',
          type: 'string',
          description: '岗位名称',
          required: true,
        },
        {
          name: 'location',
          type: 'string',
          description: '工作地点',
          required: false,
        },
        {
          name: 'experience',
          type: 'string',
          description: '工作年限',
          required: false,
        },
      ],
      requiredPermission: 'salary:analyze',
      execute: executeSalaryAnalysis,
    })
  }
}

// ─── 工具实现 ───────────────────────────────────────────

/**
 * resume_analyze — 分析用户简历
 */
async function executeResumeAnalyze(
  ctx: CareerToolContext,
  params: { resumeId?: string },
): Promise<CareerToolResult> {
  const p = ctx.prisma as any

  try {
    // 获取用户简历
    const resumeWhere: any = { userId: ctx.userId }
    if (params.resumeId) resumeWhere.id = params.resumeId

    const resume = await p.resume.findFirst({
      where: resumeWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
      },
    })

    if (!resume) {
      return { success: false, error: '未找到简历，请先上传简历', sources: [] }
    }

    const profile = resume.profile as any
    const analysis = {
      resumeId: resume.id,
      name: profile?.name || profile?.fullName || '未知',
      skills: profile?.skills || [],
      experience: profile?.experience || profile?.workYears || null,
      education: profile?.education || null,
      workExperiences: profile?.workExperiences || [],
      summary: profile?.summary || profile?.bio || null,
      strengths: [] as string[],
      gaps: [] as string[],
      suggestions: [] as string[],
    }

    // 自动分析优劣势
    if (analysis.skills.length >= 3) analysis.strengths.push(`掌握 ${analysis.skills.length} 项技能`)
    if (analysis.experience && Number(analysis.experience) >= 3) analysis.strengths.push(`${analysis.experience} 年工作经验`)
    if (analysis.education) analysis.strengths.push(`教育背景: ${analysis.education}`)
    if (analysis.skills.length < 3) analysis.gaps.push('技能标签较少，建议补充更多技能')
    if (!analysis.summary) analysis.gaps.push('缺少个人简介，建议添加')
    if (!analysis.experience) analysis.suggestions.push('建议补充工作年限信息')
    if (analysis.skills.length > 0) analysis.suggestions.push(`可考虑搜索 ${analysis.skills.slice(0, 2).join('/')} 相关岗位`)

    return {
      success: true,
      data: analysis,
      sources: ['Resume', 'ResumeProfile'],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * job_search — 搜索岗位市场
 */
async function executeJobSearch(
  ctx: CareerToolContext,
  params: { keyword?: string; location?: string; minSalary?: number; limit?: number },
): Promise<CareerToolResult> {
  const p = ctx.prisma as any
  const { keyword, location, minSalary, limit = 20 } = params

  try {
    const where: any = {
      status: { in: ['published', 'active'] },
    }

    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ]
    }

    if (location) {
      where.location = { contains: location }
    }

    if (minSalary) {
      where.salary = { contains: String(minSalary) }
    }

    const jobs = await p.jobPosting.findMany({
      where,
      select: {
        id: true,
        title: true,
        salary: true,
        location: true,
        description: true,
        createdAt: true,
        enterprise: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return {
      success: true,
      data: {
        jobs: jobs.map((j: any) => ({
          id: j.id,
          title: j.title,
          salary: j.salary,
          location: j.location,
          company: j.enterprise?.name || '未知',
          description: j.description?.slice(0, 200) || '',
          postedAt: j.createdAt,
        })),
        total: jobs.length,
      },
      sources: [`JobPosting:${jobs.length}`],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * job_match — 匹配用户简历与岗位
 */
async function executeJobMatch(
  ctx: CareerToolContext,
  params: { jobId: string },
): Promise<CareerToolResult> {
  const p = ctx.prisma as any

  try {
    // 获取岗位
    const job = await p.jobPosting.findUnique({
      where: { id: params.jobId },
      select: {
        id: true,
        title: true,
        salary: true,
        location: true,
        description: true,
        enterprise: { select: { name: true } },
      },
    })

    if (!job) {
      return { success: false, error: '未找到该岗位', sources: [] }
    }

    // 获取用户简历
    const resume = await p.resume.findFirst({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      include: { profile: true },
    })

    const profile = resume?.profile as any
    const userSkills = profile?.skills || []

    // 简单匹配度计算
    const jobDesc = `${job.title} ${job.description || ''}`.toLowerCase()
    const matchedSkills = userSkills.filter((s: string) =>
      jobDesc.includes(s.toLowerCase())
    )
    const matchScore = userSkills.length > 0
      ? Math.round((matchedSkills.length / userSkills.length) * 100)
      : 50

    const match = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.enterprise?.name || '未知',
      salary: job.salary,
      location: job.location,
      matchScore: Math.min(matchScore, 95),
      matchedSkills,
      missingSkills: userSkills.length > 0
        ? userSkills.filter((s: string) => !jobDesc.includes(s.toLowerCase()))
        : [],
      hasResume: !!resume,
      userSkills,
      recommendation: matchScore >= 70
        ? '高度匹配，建议投递'
        : matchScore >= 50
          ? '中度匹配，可以尝试'
          : '匹配度较低，建议提升相关技能后投递',
    }

    return {
      success: true,
      data: match,
      sources: ['JobPosting', 'Resume', 'ResumeProfile'],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * career_plan — 生成职业规划
 */
async function executeCareerPlan(
  ctx: CareerToolContext,
  params: { goal: string; timeFrame?: string },
): Promise<CareerToolResult> {
  const p = ctx.prisma as any

  try {
    // 读取用户简历数据
    const resume = await p.resume.findFirst({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      include: { profile: true },
    })

    const profile = resume?.profile as any
    const userSkills = profile?.skills || []
    const experience = profile?.experience || profile?.workYears || null

    // 读取用户已投递/匹配记录
    const matches = await p.candidateMatch.findMany({
      where: { userId: ctx.userId },
      select: { matchScore: true, status: true, job: { select: { title: true } } },
      orderBy: { matchScore: 'desc' },
      take: 10,
    })

    const plan = {
      goal: params.goal,
      timeFrame: params.timeFrame || '3个月',
      currentStatus: {
        skills: userSkills,
        experience,
        resumeExists: !!resume,
        totalMatches: matches.length,
        topMatchScore: matches[0]?.matchScore || 0,
      },
      steps: [] as Array<{ step: number; action: string; detail: string; priority: string }>,
      milestones: [] as Array<{ milestone: string; timeframe: string }>,
    }

    // 基于目标生成步骤
    switch (params.goal) {
      case '换工作':
        plan.steps = [
          { step: 1, action: '完善简历', detail: '补充技能标签和工作经验', priority: 'high' },
          { step: 2, action: '搜索目标岗位', detail: '搜索匹配度高的岗位', priority: 'high' },
          { step: 3, action: '投递简历', detail: '优先投递匹配度70%+的岗位', priority: 'medium' },
          { step: 4, action: '准备面试', detail: '针对目标岗位准备常见问题和项目经验', priority: 'medium' },
        ]
        plan.milestones = [
          { milestone: '完成简历更新', timeframe: '第1周' },
          { milestone: '投递10+目标岗位', timeframe: '第2-4周' },
          { milestone: '获得3+面试机会', timeframe: '第5-8周' },
          { milestone: '拿到Offer', timeframe: '第9-12周' },
        ]
        break
      case '转行业':
        plan.steps = [
          { step: 1, action: '分析目标行业', detail: '了解目标行业的核心技能和趋势', priority: 'high' },
          { step: 2, action: '技能差距分析', detail: '对比当前技能与目标行业要求', priority: 'high' },
          { step: 3, action: '学习新技能', detail: '通过项目或课程补充关键技能', priority: 'medium' },
          { step: 4, action: '积累相关经验', detail: '通过副业或项目积累目标行业经验', priority: 'medium' },
        ]
        plan.milestones = [
          { milestone: '完成行业研究', timeframe: '第1-2周' },
          { milestone: '确定技能差距', timeframe: '第3-4周' },
          { milestone: '完成关键技能学习', timeframe: '第2-3个月' },
          { milestone: '获得目标行业面试机会', timeframe: '第4-6个月' },
        ]
        break
      case '提升技能':
        plan.steps = [
          { step: 1, action: '识别核心技能', detail: '基于目标岗位识别最需要的技能', priority: 'high' },
          { step: 2, action: '制定学习计划', detail: '按优先级排列学习路线', priority: 'high' },
          { step: 3, action: '实践项目', detail: '通过实际项目巩固技能', priority: 'medium' },
          { step: 4, action: '更新简历', detail: '将新技能添加到简历', priority: 'low' },
        ]
        plan.milestones = [
          { milestone: '完成技能评估', timeframe: '第1周' },
          { milestone: '完成核心技能学习', timeframe: '第1-2个月' },
          { milestone: '完成实践项目', timeframe: '第2-3个月' },
        ]
        break
      case '准备面试':
        plan.steps = [
          { step: 1, action: '分析目标公司', detail: '了解公司文化、业务、岗位要求', priority: 'high' },
          { step: 2, action: '准备常见问题', detail: '准备自我介绍、项目经验、职业规划等', priority: 'high' },
          { step: 3, action: '模拟面试', detail: '练习技术问题和行为问题', priority: 'medium' },
          { step: 4, action: '准备提问', detail: '准备向面试官提问的问题', priority: 'low' },
        ]
        plan.milestones = [
          { milestone: '完成公司和岗位研究', timeframe: '第1-2天' },
          { milestone: '准备所有常见问题的回答', timeframe: '第3-5天' },
          { milestone: '完成3次模拟面试', timeframe: '第6-7天' },
        ]
        break
      case '薪资谈判':
        plan.steps = [
          { step: 1, action: '市场调研', detail: '了解目标岗位的市场薪资范围', priority: 'high' },
          { step: 2, action: '评估自身价值', detail: '基于技能和经验确定期望薪资', priority: 'high' },
          { step: 3, action: '准备谈判策略', detail: '准备谈判话术和底线', priority: 'medium' },
          { step: 4, action: '选择时机', detail: '在合适的时机提出薪资要求', priority: 'medium' },
        ]
        plan.milestones = [
          { milestone: '完成薪资调研', timeframe: '第1周' },
          { milestone: '确定期望薪资范围', timeframe: '第2周' },
          { milestone: '成功完成薪资谈判', timeframe: '收到Offer后' },
        ]
        break
    }

    return {
      success: true,
      data: plan,
      sources: ['Resume', 'ResumeProfile', 'CandidateMatch'],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * interview_prepare — 面试准备
 */
async function executeInterviewPrepare(
  ctx: CareerToolContext,
  params: { jobId: string; interviewType?: string },
): Promise<CareerToolResult> {
  const p = ctx.prisma as any

  try {
    const job = await p.jobPosting.findUnique({
      where: { id: params.jobId },
      select: {
        id: true,
        title: true,
        description: true,
        salary: true,
        enterprise: { select: { name: true } },
      },
    })

    if (!job) {
      return { success: false, error: '未找到该岗位', sources: [] }
    }

    const type = params.interviewType || '初面'

    // 获取用户简历
    const resume = await p.resume.findFirst({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      include: { profile: true },
    })
    const profile = resume?.profile as any

    const preparation = {
      jobId: job.id,
      jobTitle: job.title,
      company: job.enterprise?.name || '未知',
      interviewType: type,
      questions: [] as Array<{ question: string; tip: string; category: string }>,
      tips: [] as string[],
    }

    // 基于面试类型生成问题
    if (type === '初面') {
      preparation.questions = [
        { question: '请做一个简短的自我介绍', tip: '控制在2分钟内，突出与岗位相关的经验', category: '自我介绍' },
        { question: '为什么想要加入我们公司？', tip: '展示你对公司的了解和热情', category: '动机' },
        { question: '你的职业规划是什么？', tip: '展示目标感和成长意愿', category: '规划' },
        { question: '期望薪资是多少？', tip: '提前调研市场薪资，给出合理范围', category: '薪资' },
      ]
    } else if (type === '技术面') {
      preparation.questions = [
        { question: '请描述一个你最有挑战性的项目', tip: '用STAR法则：情境-任务-行动-结果', category: '项目经验' },
        { question: '你如何解决技术难题？', tip: '展示分析问题和解决问题的能力', category: '技术能力' },
        { question: '你最近学习了什么新技术？', tip: '展示学习能力和对技术的热情', category: '学习能力' },
      ]
    } else if (type === '行为面') {
      preparation.questions = [
        { question: '描述一次你与团队发生冲突的经历', tip: '重点展示沟通和解决冲突的能力', category: '团队合作' },
        { question: '你如何应对工作压力？', tip: '展示抗压能力和时间管理技巧', category: '抗压' },
        { question: '描述一次你失败的经历', tip: '重点是从中学到了什么', category: '成长' },
      ]
    } else {
      preparation.questions = [
        { question: '你还有什么问题想问我们？', tip: '准备3-5个有深度的问题', category: '提问' },
        { question: '你对我们公司有什么了解？', tip: '展示你的调研和兴趣', category: '公司了解' },
      ]
    }

    // 通用建议
    preparation.tips = [
      '提前15分钟到达面试地点/登录面试平台',
      '准备好简历和项目作品集的打印件/电子版',
      '穿着得体，保持良好的精神面貌',
      '面试结束后发送感谢邮件',
    ]

    if (profile?.skills?.length > 0) {
      preparation.tips.push(`重点准备以下技能相关的问题: ${profile.skills.slice(0, 3).join(', ')}`)
    }

    return {
      success: true,
      data: preparation,
      sources: ['JobPosting', 'Resume', 'ResumeProfile'],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * salary_analysis — 薪资分析
 */
async function executeSalaryAnalysis(
  ctx: CareerToolContext,
  params: { jobTitle: string; location?: string; experience?: string },
): Promise<CareerToolResult> {
  const p = ctx.prisma as any

  try {
    // 搜索匹配的岗位
    const where: any = {
      title: { contains: params.jobTitle },
      status: { in: ['published', 'active'] },
    }
    if (params.location) {
      where.location = { contains: params.location }
    }

    const jobs = await p.jobPosting.findMany({
      where,
      select: { id: true, title: true, salary: true, location: true },
      take: 50,
    })

    // 解析薪资范围
    const salaries: number[] = []
    for (const job of jobs) {
      if (job.salary) {
        // 匹配 "15-25K", "15K-25K", "15000-25000" 等格式
        const match = job.salary.match(/(\d+)/g)
        if (match) {
          for (const m of match) {
            const num = parseInt(m)
            if (num >= 1000) salaries.push(num / 1000) // 转为K
            else if (num >= 1) salaries.push(num)
          }
        }
      }
    }

    salaries.sort((a, b) => a - b)

    const analysis = {
      jobTitle: params.jobTitle,
      location: params.location || '不限',
      experience: params.experience || '不限',
      sampleSize: jobs.length,
      salaryRange: salaries.length > 0
        ? { min: salaries[0], max: salaries[salaries.length - 1], median: salaries[Math.floor(salaries.length / 2)] }
        : null,
      marketInsights: [] as string[],
      recommendations: [] as string[],
    }

    if (salaries.length > 0) {
      analysis.marketInsights.push(`${params.jobTitle} 岗位薪资范围: ${salaries[0]}K-${salaries[salaries.length - 1]}K`)
      analysis.marketInsights.push(`中位数: ${salaries[Math.floor(salaries.length / 2)]}K`)
      analysis.marketInsights.push(`基于 ${jobs.length} 个岗位样本`)
      analysis.recommendations.push(`期望薪资建议: ${salaries[Math.floor(salaries.length * 0.6)]}K-${salaries[Math.floor(salaries.length * 0.8)]}K`)
    } else {
      analysis.marketInsights.push('暂无足够薪资数据')
      analysis.recommendations.push('建议通过更多渠道了解该岗位的市场薪资')
    }

    if (params.experience) {
      const expNum = parseInt(params.experience)
      if (expNum >= 5) {
        analysis.recommendations.push(`${params.experience} 年经验属于资深水平，可争取薪资范围上限`)
      } else if (expNum >= 3) {
        analysis.recommendations.push(`${params.experience} 年经验属于中级水平，薪资处于中位`)
      } else {
        analysis.recommendations.push(`${params.experience} 年经验属于初级水平，重点展示学习能力`)
      }
    }

    return {
      success: true,
      data: analysis,
      sources: [`JobPosting:${jobs.length}`],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}
