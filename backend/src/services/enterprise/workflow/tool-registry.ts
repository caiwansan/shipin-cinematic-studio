/**
 * Tool Registry — KM-AI-JOB-AGENT-07
 * AI 招聘经理可用工具注册表
 *
 * 架构：
 *   - 工具定义 = 名称 + 描述 + 参数Schema + 执行函数
 *   - 权限控制：通过 ToolPermissionService 过滤
 *   - 所有工具只读或生成建议，不直接修改业务数据（L1 范围）
 *
 * 权限分层：
 *   L1 建议行动（安全）— 无需权限
 *   L2 半自动执行（需确认）— HR点击确认后执行
 *   L3 自动执行（未来）— 第一版不做
 */

import type { PrismaClient } from '@prisma/client'

// ─── 工具定义 ───────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  category: 'read' | 'analyze' | 'report' | 'task' | 'notify'
  params: ToolParam[]
  requiredPermission: string
  execute: (ctx: ToolContext, params: any) => Promise<ToolResult>
}

export interface ToolParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  description: string
  required: boolean
  enum?: string[]
}

export interface ToolContext {
  prisma: PrismaClient
  tenantId: string
  userId: string
  agentId: string
  agentInstanceId: string
  memoryNamespace: string
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  sources: string[]
}

// ─── Tool Registry ──────────────────────────────────────

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()

  constructor(private prisma: PrismaClient) {
    this.registerCoreTools()
  }

  /**
   * 获取 Agent 可用的工具列表（经过权限过滤）
   */
  getAvailableTools(allowedToolNames: string[]): ToolDefinition[] {
    return allowedToolNames
      .map(name => this.tools.get(name))
      .filter((t): t is ToolDefinition => !!t)
  }

  /**
   * 获取单个工具
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  /**
   * 列出所有注册的工具
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  // ─── 核心工具注册 ─────────────────────────────────────

  private registerCoreTools() {
    // ── read_recruitment_data ──
    this.tools.set('read_recruitment_data', {
      name: 'read_recruitment_data',
      description: '读取企业招聘数据：岗位、候选人匹配、Pipeline、面试、待审核',
      category: 'read',
      params: [
        {
          name: 'dataType',
          type: 'string',
          description: '要读取的数据类型',
          required: true,
          enum: ['jobs', 'matches', 'pipeline', 'interviews', 'reviews', 'all'],
        },
        {
          name: 'limit',
          type: 'number',
          description: '返回记录数量上限',
          required: false,
        },
      ],
      requiredPermission: 'recruitment:read',
      execute: executeReadRecruitmentData,
    })

    // ── search_candidates ──
    this.tools.set('search_candidates', {
      name: 'search_candidates',
      description: '搜索候选人：按技能、经验、匹配度筛选',
      category: 'read',
      params: [
        {
          name: 'keyword',
          type: 'string',
          description: '搜索关键词（姓名/技能）',
          required: false,
        },
        {
          name: 'minScore',
          type: 'number',
          description: '最低匹配度（0-100）',
          required: false,
        },
        {
          name: 'status',
          type: 'string',
          description: '候选人状态过滤',
          required: false,
          enum: ['discovered', 'screening', 'interview', 'offer', 'hired', 'rejected'],
        },
      ],
      requiredPermission: 'candidate:read',
      execute: executeSearchCandidates,
    })

    // ── analyze_candidate ──
    this.tools.set('analyze_candidate', {
      name: 'analyze_candidate',
      description: '分析候选人：综合评估匹配度、优势、风险',
      category: 'analyze',
      params: [
        {
          name: 'candidateName',
          type: 'string',
          description: '候选人姓名',
          required: true,
        },
      ],
      requiredPermission: 'candidate:analyze',
      execute: executeAnalyzeCandidate,
    })

    // ── generate_report ──
    this.tools.set('generate_report', {
      name: 'generate_report',
      description: '生成招聘报告：摘要、风险、建议行动',
      category: 'report',
      params: [
        {
          name: 'reportType',
          type: 'string',
          description: '报告类型',
          required: true,
          enum: ['daily_summary', 'risk_alert', 'pipeline_analysis', 'candidate_recommendation'],
        },
      ],
      requiredPermission: 'report:generate',
      execute: executeGenerateReport,
    })

    // ── recommend_next_action ──
    this.tools.set('recommend_next_action', {
      name: 'recommend_next_action',
      description: '推荐下一步行动：基于当前招聘数据生成优先级任务',
      category: 'analyze',
      params: [
        {
          name: 'focusArea',
          type: 'string',
          description: '关注领域',
          required: false,
          enum: ['pipeline', 'interview', 'review', 'outreach', 'all'],
        },
      ],
      requiredPermission: 'action:recommend',
      execute: executeRecommendNextAction,
    })

    // ── create_hr_task ──
    this.tools.set('create_hr_task', {
      name: 'create_hr_task',
      description: '创建 HR 待办任务（L2 半自动，需 HR 确认后执行）',
      category: 'task',
      params: [
        {
          name: 'title',
          type: 'string',
          description: '任务标题',
          required: true,
        },
        {
          name: 'description',
          type: 'string',
          description: '任务描述',
          required: true,
        },
        {
          name: 'priority',
          type: 'string',
          description: '优先级',
          required: true,
          enum: ['low', 'medium', 'high', 'urgent'],
        },
        {
          name: 'relatedCandidate',
          type: 'string',
          description: '关联候选人姓名',
          required: false,
        },
      ],
      requiredPermission: 'task:create',
      execute: executeCreateHrTask,
    })

    // ── send_notification ──
    this.tools.set('send_notification', {
      name: 'send_notification',
      description: '发送通知给 HR（系统内通知，不外发到外部渠道）',
      category: 'notify',
      params: [
        {
          name: 'title',
          type: 'string',
          description: '通知标题',
          required: true,
        },
        {
          name: 'message',
          type: 'string',
          description: '通知内容',
          required: true,
        },
        {
          name: 'level',
          type: 'string',
          description: '通知级别',
          required: true,
          enum: ['info', 'warning', 'alert'],
        },
      ],
      requiredPermission: 'notification:send',
      execute: executeSendNotification,
    })
  }
}

// ─── 工具实现 ───────────────────────────────────────────

/**
 * read_recruitment_data — 读取招聘数据
 */
async function executeReadRecruitmentData(
  ctx: ToolContext,
  params: { dataType: string; limit?: number },
): Promise<ToolResult> {
  const p = ctx.prisma as any
  const { dataType, limit = 50 } = params
  const result: Record<string, any> = {}
  const sources: string[] = []

  try {
    // 获取 enterpriseId（tenantId 直接作为 enterpriseId）
    const enterpriseId = ctx.tenantId
    const workspaces = await p.enterpriseJobWorkspace.findMany({
      where: { enterpriseId },
      select: { id: true },
    })
    const workspaceIds = workspaces.map((w: any) => w.id)

    if (dataType === 'jobs' || dataType === 'all') {
      const jobs = await p.jobPosting.findMany({
        where: workspaceIds.length > 0 ? { enterpriseId } : { enterpriseId: ctx.tenantId },
        select: { id: true, title: true, status: true, salary: true, location: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      result.jobs = jobs
      if (jobs.length > 0) sources.push(`JobPosting:${jobs.length}`)
    }

    if (dataType === 'matches' || dataType === 'all') {
      const matches = await p.candidateMatch.findMany({
        where: workspaceIds.length > 0 ? { workspaceId: { in: workspaceIds } } : {},
        select: {
          id: true, matchScore: true, status: true,
          job: { select: { title: true } },
          candidate: { select: { profileJson: true, user: { select: { username: true } } } },
        },
        orderBy: { matchScore: 'desc' },
        take: limit,
      })
      result.matches = matches.map((m: any) => ({
        id: m.id,
        jobTitle: m.job?.title || '未知',
        candidateName: m.candidate?.profileJson?.name || m.candidate?.profileJson?.fullName || m.candidate?.user?.username || '未知',
        score: m.matchScore || 0,
        status: m.status,
      }))
      if (matches.length > 0) sources.push(`CandidateMatch:${matches.length}`)
    }

    if (dataType === 'pipeline' || dataType === 'all') {
      const pipelines = await p.recruitmentPipeline.findMany({
        where: workspaceIds.length > 0 ? { workspaceId: { in: workspaceIds } } : {},
        select: {
          id: true, candidateName: true, stage: true, lastActivityAt: true,
          job: { select: { title: true } },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: limit,
      })
      result.pipelines = pipelines
      if (pipelines.length > 0) sources.push(`RecruitmentPipeline:${pipelines.length}`)
    }

    if (dataType === 'interviews' || dataType === 'all') {
      const interviews = await p.interviewSession.findMany({
        where: workspaceIds.length > 0 ? { workspaceId: { in: workspaceIds } } : {},
        select: { id: true, status: true, startedAt: true, completedAt: true },
        take: limit,
      })
      result.interviews = interviews
      if (interviews.length > 0) sources.push(`InterviewSession:${interviews.length}`)
    }

    if (dataType === 'reviews' || dataType === 'all') {
      const reviews = await p.humanReviewItem.findMany({
        where: workspaceIds.length > 0
          ? { workspaceId: { in: workspaceIds }, status: 'pending' }
          : { status: 'pending' },
        select: { id: true, candidateName: true, jobTitle: true, priority: true, aiRecommendation: true },
        orderBy: { priority: 'desc' },
        take: limit,
      })
      result.reviews = reviews
      if (reviews.length > 0) sources.push(`HumanReviewItem:${reviews.length}`)
    }

    return { success: true, data: result, sources }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * search_candidates — 搜索候选人
 */
async function executeSearchCandidates(
  ctx: ToolContext,
  params: { keyword?: string; minScore?: number; status?: string },
): Promise<ToolResult> {
  const p = ctx.prisma as any
  const { keyword, minScore, status } = params

  try {
    const workspaces = await p.enterpriseJobWorkspace.findMany({
      where: { enterpriseId: ctx.tenantId },
      select: { id: true },
    })
    const workspaceIds = workspaces.map((w: any) => w.id)

    const where: any = {}
    if (workspaceIds.length > 0) where.workspaceId = { in: workspaceIds }
    if (minScore !== undefined) where.matchScore = { gte: minScore }
    if (status) where.status = status

    const matches = await p.candidateMatch.findMany({
      where,
      select: {
        id: true, matchScore: true, status: true,
        job: { select: { title: true } },
        candidate: { select: { profileJson: true, user: { select: { username: true, email: true } } } },
      },
      orderBy: { matchScore: 'desc' },
      take: 50,
    })

    const results = matches
      .map((m: any) => ({
        id: m.id,
        jobTitle: m.job?.title || '未知',
        candidateName: m.candidate?.profileJson?.name || m.candidate?.profileJson?.fullName || m.candidate?.user?.username || m.candidate?.user?.email || '未知',
        score: m.matchScore || 0,
        status: m.status,
      }))
      .filter((r: any) => {
        if (!keyword) return true
        return r.candidateName.includes(keyword) || r.jobTitle.includes(keyword)
      })

    return {
      success: true,
      data: { candidates: results, total: results.length },
      sources: [`CandidateMatch:${results.length}`],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * analyze_candidate — 分析候选人
 */
async function executeAnalyzeCandidate(
  ctx: ToolContext,
  params: { candidateName: string },
): Promise<ToolResult> {
  const p = ctx.prisma as any
  const { candidateName } = params

  try {
    const workspaces = await p.enterpriseJobWorkspace.findMany({
      where: { enterpriseId: ctx.tenantId },
      select: { id: true },
    })
    const workspaceIds = workspaces.map((w: any) => w.id)

    // 查找候选人匹配
    const matches = await p.candidateMatch.findMany({
      where: workspaceIds.length > 0 ? { workspaceId: { in: workspaceIds } } : {},
      select: {
        id: true, matchScore: true, status: true,
        job: { select: { title: true, salary: true } },
        candidate: { select: { profileJson: true, user: { select: { username: true } } } },
      },
      orderBy: { matchScore: 'desc' },
      take: 50,
    })

    const candidate = matches.find((m: any) => {
      const name = m.candidate?.profileJson?.name || m.candidate?.profileJson?.fullName || m.candidate?.user?.username || ''
      return name.includes(candidateName) || candidateName.includes(name)
    })

    if (!candidate) {
      return { success: false, error: `未找到候选人: ${candidateName}`, sources: [] }
    }

    // 查找 Pipeline 状态
    const name = candidate.candidate?.profileJson?.name || candidate.candidate?.profileJson?.fullName || candidate.candidate?.user?.username || candidateName
    const pipeline = await p.recruitmentPipeline.findFirst({
      where: workspaceIds.length > 0
        ? { workspaceId: { in: workspaceIds }, candidateName: name }
        : { candidateName: name },
      select: { stage: true, lastActivityAt: true },
    })

    // 查找面试记录
    const interviews = await p.interviewSession.findMany({
      where: workspaceIds.length > 0 ? { workspaceId: { in: workspaceIds } } : {},
      select: { id: true, status: true },
      take: 10,
    })

    const profile = candidate.candidate?.profileJson as any
    const analysis = {
      candidateName: name,
      jobTitle: candidate.job?.title || '未知岗位',
      salary: candidate.job?.salary,
      matchScore: candidate.matchScore || 0,
      matchStatus: candidate.status,
      pipelineStage: pipeline?.stage || '未进入Pipeline',
      lastActivity: pipeline?.lastActivityAt?.toISOString() || null,
      skills: profile?.skills || [],
      experience: profile?.experience || profile?.workYears || null,
      education: profile?.education || null,
      overallRating: (candidate.matchScore || 0) >= 75 ? 'recommend' : (candidate.matchScore || 0) >= 60 ? 'consider' : 'pass',
      strengths: [
        ...(candidate.matchScore >= 70 ? ['高匹配度'] : []),
        ...(profile?.skills?.length > 0 ? [`技能: ${profile.skills.slice(0, 3).join(', ')}`] : []),
      ],
      risks: [
        ...(!pipeline ? ['未进入Pipeline'] : []),
        ...(candidate.matchScore < 60 ? ['匹配度偏低'] : []),
      ],
    }

    return {
      success: true,
      data: analysis,
      sources: ['CandidateMatch', 'RecruitmentPipeline', 'InterviewSession'],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * generate_report — 生成招聘报告
 */
async function executeGenerateReport(
  ctx: ToolContext,
  params: { reportType: string },
): Promise<ToolResult> {
  // 读取全量数据
  const readResult = await executeReadRecruitmentData(ctx, { dataType: 'all', limit: 100 })
  if (!readResult.success) {
    return readResult
  }

  const data = readResult.data
  const report: any = {
    reportType: params.reportType,
    generatedAt: new Date().toISOString(),
    tenantId: ctx.tenantId,
  }

  switch (params.reportType) {
    case 'daily_summary': {
      report.summary = {
        totalJobs: data.jobs?.length || 0,
        activeJobs: data.jobs?.filter((j: any) => j.status === 'published' || j.status === 'active').length || 0,
        totalMatches: data.matches?.length || 0,
        highMatches: data.matches?.filter((m: any) => m.score >= 70).length || 0,
        pipelineTotal: data.pipelines?.length || 0,
        pendingReviews: data.reviews?.length || 0,
        totalInterviews: data.interviews?.length || 0,
      }
      // Pipeline 分布
      report.pipelineDistribution = {}
      for (const pl of data.pipelines || []) {
        report.pipelineDistribution[pl.stage] = (report.pipelineDistribution[pl.stage] || 0) + 1
      }
      break
    }
    case 'risk_alert': {
      const risks: Array<{ level: string; content: string; sources: string[] }> = []
      // 超期未推进
      const stalePipelines = (data.pipelines || []).filter((p: any) => {
        if (!p.lastActivityAt) return false
        const days = (Date.now() - new Date(p.lastActivityAt).getTime()) / 86400000
        return days > 7 && !['hired', 'rejected'].includes(p.stage)
      })
      if (stalePipelines.length > 0) {
        risks.push({
          level: 'medium',
          content: `${stalePipelines.length} 名候选人超过7天未推进`,
          sources: ['RecruitmentPipeline'],
        })
      }
      // 有岗位无候选人
      if ((data.jobs?.length || 0) > 0 && (data.pipelines?.length || 0) === 0) {
        risks.push({
          level: 'low',
          content: '有岗位但无Pipeline候选人，建议启动人才搜索',
          sources: ['JobPosting', 'RecruitmentPipeline'],
        })
      }
      // 待审核积压
      if ((data.reviews?.length || 0) > 5) {
        risks.push({
          level: 'high',
          content: `${data.reviews.length} 项待审核积压`,
          sources: ['HumanReviewItem'],
        })
      }
      report.risks = risks
      break
    }
    case 'pipeline_analysis': {
      const stageFlow: Record<string, number> = {}
      for (const pl of data.pipelines || []) {
        stageFlow[pl.stage] = (stageFlow[pl.stage] || 0) + 1
      }
      report.stageFlow = stageFlow
      report.bottleneck = Object.entries(stageFlow).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'unknown'
      report.recommendation = report.bottleneck === 'discovered'
        ? '大量候选人处于发现阶段，建议加速筛选'
        : report.bottleneck === 'interview'
          ? '面试阶段候选人较多，建议增加面试资源'
          : 'Pipeline 流转正常'
      break
    }
    case 'candidate_recommendation': {
      const topCandidates = (data.matches || [])
        .filter((m: any) => m.score >= 65)
        .slice(0, 5)
        .map((m: any) => ({
          name: m.candidateName,
          jobTitle: m.jobTitle,
          score: m.score,
          status: m.status,
        }))
      report.topCandidates = topCandidates
      report.recommendation = topCandidates.length > 0
        ? `推荐优先联系 ${topCandidates[0].name}（匹配度 ${topCandidates[0].score}%）`
        : '暂无高匹配候选人'
      break
    }
  }

  return {
    success: true,
    data: report,
    sources: readResult.sources,
  }
}

/**
 * recommend_next_action — 推荐下一步行动
 */
async function executeRecommendNextAction(
  ctx: ToolContext,
  params: { focusArea?: string },
): Promise<ToolResult> {
  const readResult = await executeReadRecruitmentData(ctx, { dataType: 'all', limit: 100 })
  if (!readResult.success) return readResult

  const data = readResult.data
  const actions: Array<{ action: string; target: string; priority: string; reason: string; sources: string[] }> = []

  // 待审核优先
  if (data.reviews?.length > 0) {
    actions.push({
      action: 'review_pending',
      target: `${data.reviews.length} 项待审核`,
      priority: 'high',
      reason: `有 ${data.reviews.length} 项候选人等待HR审核`,
      sources: ['HumanReviewItem'],
    })
  }

  // 高匹配候选人联系
  const highMatches = (data.matches || []).filter((m: any) => m.score >= 70 && m.status === 'discovered')
  if (highMatches.length > 0) {
    actions.push({
      action: 'contact_candidate',
      target: highMatches.map((m: any) => m.candidateName).join('、'),
      priority: 'high',
      reason: `${highMatches.length} 名高匹配候选人待联系`,
      sources: ['CandidateMatch'],
    })
  }

  // 面试准备
  const scheduledInterviews = (data.interviews || []).filter((i: any) => i.status === 'scheduled')
  if (scheduledInterviews.length > 0) {
    actions.push({
      action: 'prepare_interview',
      target: `${scheduledInterviews.length} 场面试`,
      priority: 'medium',
      reason: '有面试待进行',
      sources: ['InterviewSession'],
    })
  }

  // Pipeline 推进
  const stalePipelines = (data.pipelines || []).filter((p: any) => {
    if (!p.lastActivityAt) return false
    const days = (Date.now() - new Date(p.lastActivityAt).getTime()) / 86400000
    return days > 5 && !['hired', 'rejected'].includes(p.stage)
  })
  if (stalePipelines.length > 0) {
    actions.push({
      action: 'advance_pipeline',
      target: `${stalePipelines.length} 名候选人`,
      priority: 'medium',
      reason: '候选人长时间未推进',
      sources: ['RecruitmentPipeline'],
    })
  }

  // 按 focusArea 过滤
  const focusArea = params.focusArea || 'all'
  const filtered = focusArea === 'all'
    ? actions
    : actions.filter(a => {
        if (focusArea === 'pipeline') return a.action === 'advance_pipeline'
        if (focusArea === 'interview') return a.action === 'prepare_interview'
        if (focusArea === 'review') return a.action === 'review_pending'
        if (focusArea === 'outreach') return a.action === 'contact_candidate'
        return true
      })

  // 按优先级排序
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  filtered.sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9))

  return {
    success: true,
    data: {
      actions: filtered,
      total: filtered.length,
      focusArea,
    },
    sources: readResult.sources,
  }
}

/**
 * create_hr_task — 创建 HR 待办任务
 */
async function executeCreateHrTask(
  ctx: ToolContext,
  params: { title: string; description: string; priority: string; relatedCandidate?: string },
): Promise<ToolResult> {
  const p = ctx.prisma as any

  try {
    // 写入 AgentMemory 作为 HR 待办（L2 半自动：创建任务但不自动执行）
    const task = await p.agentMemory.create({
      data: {
        agentId: 'agent_camera',
        memoryType: 'hr_task',
        content: JSON.stringify({
          title: params.title,
          description: params.description,
          priority: params.priority,
          relatedCandidate: params.relatedCandidate || null,
          status: 'pending', // pending → confirmed → done
          createdBy: 'ai_workflow',
          createdAt: new Date().toISOString(),
          tenantId: ctx.tenantId,
          memoryNamespace: ctx.memoryNamespace,
        }),
        embeddingVector: null,
      },
    })

    return {
      success: true,
      data: {
        taskId: task.id,
        title: params.title,
        priority: params.priority,
        status: 'pending',
        message: 'HR 待办已创建，等待 HR 确认后执行',
      },
      sources: ['AgentMemory:hr_task'],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}

/**
 * send_notification — 发送系统内通知
 */
async function executeSendNotification(
  ctx: ToolContext,
  params: { title: string; message: string; level: string },
): Promise<ToolResult> {
  const p = ctx.prisma as any

  try {
    // 写入 AgentMemory 作为通知记录
    const notification = await p.agentMemory.create({
      data: {
        agentId: 'agent_camera',
        memoryType: 'notification',
        content: JSON.stringify({
          title: params.title,
          message: params.message,
          level: params.level,
          createdAt: new Date().toISOString(),
          tenantId: ctx.tenantId,
          memoryNamespace: ctx.memoryNamespace,
          read: false,
        }),
        embeddingVector: null,
      },
    })

    return {
      success: true,
      data: {
        notificationId: notification.id,
        title: params.title,
        level: params.level,
        message: '通知已记录到系统',
      },
      sources: ['AgentMemory:notification'],
    }
  } catch (err: any) {
    return { success: false, error: err.message, sources: [] }
  }
}
