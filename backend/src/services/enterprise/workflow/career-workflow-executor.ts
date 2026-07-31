/**
 * Career Workflow Executor — KM-AI-JOB-AGENT-08
 * AI 职业助理 Hermes Workflow 执行引擎
 *
 * 核心循环（与企业端相同）：
 *   1. 读取求职数据（通过 Career Tool Registry）
 *   2. 调用 LLM 决策（通过 AgentExecutor → Gateway → BYOK）
 *   3. 执行工具调用（读/分析/搜索/规划）
 *   4. 记录 Memory（隔离命名空间）
 *   5. 输出结构化结果
 *
 * 架构约束：
 *   - 不直接查数据库（通过 Tool Registry）
 *   - 不直接调 LLM（通过 AgentExecutor → Gateway）
 *   - L1 辅助执行：不自动修改业务数据
 *   - Memory 隔离：tenant/{userId}/agent/career-assistant
 *   - 所有输出附带数据来源标记
 *
 * 与企业端的区别：
 *   - 面向个人用户（非企业 HR）
 *   - userId 作为 tenantId
 *   - 工具集不同（求职工具 vs 招聘工具）
 */

import type { PrismaClient } from '@prisma/client'
import { CareerToolRegistry, type CareerToolContext, type CareerToolResult } from './career-tool-registry'
import { AgentExecutorImpl } from '../../../agent-runtime/brain/agent-executor'
import { MemoryNamespaceService } from '../memory-namespace.service'

// ─── 类型定义 ───────────────────────────────────────────

export type CareerWorkflowType =
  | 'job_change'                // 换工作：简历分析→岗位搜索→匹配→行动计划
  | 'skill_gap'                 // 技能差距分析
  | 'interview_prep'            // 面试准备
  | 'salary_negotiation'        // 薪资谈判
  | 'career_profile_analysis'   // 职业优势分析（不搜索岗位，只基于用户画像做洞察）

export interface CareerWorkflowRequest {
  workflowType: CareerWorkflowType
  userId: string
  tenantId: string        // 个人用户 userId 作为 tenantId
  agentId: string
  agentInstanceId: string
  params?: Record<string, any>
}

export interface CareerWorkflowStep {
  stepNumber: number
  action: string
  tool?: string
  result: 'success' | 'failed' | 'skipped'
  summary: string
  sources: string[]
}

export interface CareerWorkflowResult {
  workflowType: CareerWorkflowType
  status: 'completed' | 'partial' | 'failed'
  generatedAt: string
  agentId: string
  agentName: string
  userId: string
  tenantId: string
  hermesAgentId: string
  memoryNamespace: string
  steps: CareerWorkflowStep[]
  output: CareerWorkflowOutput
  metadata: {
    model: string
    tokensUsed: number
    durationMs: number
    provider: string
    toolsUsed: string[]
  }
}

export interface CareerWorkflowOutput {
  summary: string
  findings: Array<{
    type: 'info' | 'opportunity' | 'warning'
    content: string
    sources: string[]
  }>
  actions: Array<{
    action: string
    target: string
    priority: string
    reason: string
    sources: string[]
  }>
  plan: Array<{
    step: number
    action: string
    detail: string
    timeframe: string
  }>
}

// ─── Career Workflow Executor ────────────────────────────

export class CareerWorkflowExecutor {
  private toolRegistry: CareerToolRegistry
  private memoryService: MemoryNamespaceService

  constructor(
    private prisma: PrismaClient,
    private executor: AgentExecutorImpl,
  ) {
    this.toolRegistry = new CareerToolRegistry(prisma)
    this.memoryService = new MemoryNamespaceService()
  }

  /**
   * 执行 Career Workflow
   */
  async execute(req: CareerWorkflowRequest): Promise<CareerWorkflowResult> {
    const startTime = Date.now()
    const steps: CareerWorkflowStep[] = []
    const toolsUsed: string[] = []
    let totalTokens = 0

    // 1. 获取 Memory Namespace
    const nsResult = await this.memoryService.getNamespace(req.agentInstanceId)
    const memoryNamespace = nsResult?.namespace || `tenant/${req.userId}/agent/${req.agentInstanceId}`

    // 2. 获取 Hermes Agent ID
    const binding = await (this.prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId: req.agentInstanceId },
      select: { hermesAgentId: true },
    })
    const hermesAgentId = binding?.hermesAgentId || `hermes_${req.userId.slice(0, 8)}_${req.agentInstanceId.slice(0, 8)}`

    // 3. 构建 Tool Context
    const toolCtx: CareerToolContext = {
      prisma: this.prisma,
      tenantId: req.tenantId,
      userId: req.userId,
      agentId: req.agentId,
      agentInstanceId: req.agentInstanceId,
      memoryNamespace,
    }

    // 4. 获取可用工具（从 Binding 的 toolAllowList）
    const bindingFull = await (this.prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId: req.agentInstanceId },
      select: { toolAllowList: true },
    })
    const allowedTools = bindingFull?.toolAllowList
      ? JSON.parse(bindingFull.toolAllowList || '[]')
      : this.toolRegistry.listTools().map(t => t.name)

    const availableTools = this.toolRegistry.getAvailableTools(allowedTools)

    // 5. 执行 Workflow 步骤
    let workflowOutput: CareerWorkflowOutput

    try {
      switch (req.workflowType) {
        case 'job_change':
          workflowOutput = await this.runJobChange(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'skill_gap':
          workflowOutput = await this.runSkillGap(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'interview_prep':
          workflowOutput = await this.runInterviewPrep(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'salary_negotiation':
          workflowOutput = await this.runSalaryNegotiation(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'career_profile_analysis':
          workflowOutput = await this.runCareerProfileAnalysis(toolCtx, req, steps, toolsUsed)
          break
        default:
          throw new Error(`Unknown career workflow type: ${req.workflowType}`)
      }
    } catch (err: any) {
      return this.buildErrorResult(req, hermesAgentId, memoryNamespace, steps, toolsUsed, totalTokens, startTime, err.message)
    }

    // 6. 记录 Workflow 执行到 Memory
    await this.recordWorkflowMemory(toolCtx, req.workflowType, workflowOutput, steps)

    return {
      workflowType: req.workflowType,
      status: 'completed',
      generatedAt: new Date().toISOString(),
      agentId: req.agentId,
      agentName: 'AI 职业助理',
      userId: req.userId,
      tenantId: req.tenantId,
      hermesAgentId,
      memoryNamespace,
      steps,
      output: workflowOutput,
      metadata: {
        model: 'deepseek-v4-flash',
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
        toolsUsed,
      },
    }
  }

  // ─── Workflow 实现 ─────────────────────────────────────

  /**
   * job_change — 换工作 Workflow
   * 步骤：简历分析 → 岗位搜索 → 岗位匹配 → 职业规划 → LLM 综合建议
   */
  private async runJobChange(
    ctx: CareerToolContext,
    req: CareerWorkflowRequest,
    tools: any[],
    steps: CareerWorkflowStep[],
    toolsUsed: string[],
  ): Promise<CareerWorkflowOutput> {
    // Step 1: 分析简历
    const resumeTool = this.toolRegistry.getTool('resume_analyze')
    const resumeResult = resumeTool
      ? await resumeTool.execute(ctx, {})
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '分析简历',
      tool: 'resume_analyze',
      result: resumeResult.success ? 'success' : 'failed',
      summary: resumeResult.success
        ? `简历分析完成: ${resumeResult.data?.name || '用户'}，${resumeResult.data?.skills?.length || 0} 项技能`
        : resumeResult.error || '分析失败',
      sources: resumeResult.sources,
    })
    if (resumeResult.success) toolsUsed.push('resume_analyze')

    // Step 2: 搜索岗位（基于用户技能关键词）
    const keyword = req.params?.keyword || resumeResult.data?.skills?.slice(0, 2)?.join(' ') || ''
    const searchTool = this.toolRegistry.getTool('job_search')
    const searchResult = searchTool
      ? await searchTool.execute(ctx, { keyword, limit: 10 })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 2,
      action: '搜索岗位',
      tool: 'job_search',
      result: searchResult.success ? 'success' : 'failed',
      summary: searchResult.success ? `发现 ${searchResult.data?.total || 0} 个岗位` : searchResult.error || '搜索失败',
      sources: searchResult.sources,
    })
    if (searchResult.success) toolsUsed.push('job_search')

    // Step 3: 匹配 Top 岗位
    const topJobs = (searchResult.data?.jobs || []).slice(0, 3)
    const matchResults: any[] = []
    for (const job of topJobs) {
      const matchTool = this.toolRegistry.getTool('job_match')
      if (matchTool) {
        const result = await matchTool.execute(ctx, { jobId: job.id })
        if (result.success) {
          matchResults.push(result.data)
        }
      }
    }
    steps.push({
      stepNumber: 3,
      action: '岗位匹配',
      tool: 'job_match',
      result: matchResults.length > 0 ? 'success' : 'failed',
      summary: `匹配 ${matchResults.length} 个岗位，最高匹配度 ${matchResults[0]?.matchScore || 0}%`,
      sources: ['JobPosting', 'Resume'],
    })
    if (matchResults.length > 0) toolsUsed.push('job_match')

    // Step 4: 生成职业规划
    const planTool = this.toolRegistry.getTool('career_plan')
    const planResult = planTool
      ? await planTool.execute(ctx, { goal: '换工作', timeFrame: req.params?.timeFrame || '3个月' })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 4,
      action: '生成行动计划',
      tool: 'career_plan',
      result: planResult.success ? 'success' : 'failed',
      summary: planResult.success ? `${planResult.data?.steps?.length || 0} 个步骤` : planResult.error || '生成失败',
      sources: planResult.sources,
    })
    if (planResult.success) toolsUsed.push('career_plan')

    // Step 5: LLM 综合建议（走 Gateway → BYOK）
    const prompt = this.buildJobChangePrompt(resumeResult.data, searchResult.data, matchResults, planResult.data)
    const llmAgentId = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'career:job_change'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 5,
      action: 'LLM 综合建议',
      result: 'success',
      summary: `LLM 建议完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    // 组装输出
    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: this.buildCareerFindings(resumeResult, matchResults),
      actions: (planResult.data?.steps || []).map((s: any) => ({
        action: s.action,
        target: s.detail,
        priority: s.priority,
        reason: s.detail,
        sources: ['CareerPlan'],
      })),
      plan: (planResult.data?.steps || []).map((s: any) => ({
        step: s.step,
        action: s.action,
        detail: s.detail,
        timeframe: (planResult.data?.milestones || [])[s.step - 1]?.timeframe || '',
      })),
    }
  }

  /**
   * skill_gap — 技能差距分析
   * 步骤：简历分析 → 目标岗位匹配 → 差距分析
   */
  private async runSkillGap(
    ctx: CareerToolContext,
    req: CareerWorkflowRequest,
    tools: any[],
    steps: CareerWorkflowStep[],
    toolsUsed: string[],
  ): Promise<CareerWorkflowOutput> {
    // Step 1: 简历分析
    const resumeTool = this.toolRegistry.getTool('resume_analyze')
    const resumeResult = resumeTool
      ? await resumeTool.execute(ctx, {})
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '分析简历',
      tool: 'resume_analyze',
      result: resumeResult.success ? 'success' : 'failed',
      summary: resumeResult.success ? '简历分析完成' : resumeResult.error || '分析失败',
      sources: resumeResult.sources,
    })
    if (resumeResult.success) toolsUsed.push('resume_analyze')

    // Step 2: 目标岗位匹配
    const targetJobId = req.params?.jobId
    let matchResult: any = null
    if (targetJobId) {
      const matchTool = this.toolRegistry.getTool('job_match')
      matchResult = matchTool
        ? await matchTool.execute(ctx, { jobId: targetJobId })
        : { success: false, data: null, sources: [], error: 'tool not found' }
      steps.push({
        stepNumber: 2,
        action: '岗位匹配',
        tool: 'job_match',
        result: matchResult.success ? 'success' : 'failed',
        summary: matchResult.success ? `匹配度 ${matchResult.data?.matchScore || 0}%` : matchResult.error || '匹配失败',
        sources: matchResult.sources,
      })
      if (matchResult.success) toolsUsed.push('job_match')
    }

    // Step 3: LLM 差距分析
    const prompt = this.buildSkillGapPrompt(resumeResult.data, matchResult?.data)
    const llmAgentId = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'career:skill_gap'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 3,
      action: 'LLM 差距分析',
      result: 'success',
      summary: `分析完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: matchResult?.success
        ? [
            { type: 'info', content: `当前技能: ${matchResult.data?.userSkills?.join(', ') || '未知'}`, sources: ['Resume'] },
            { type: 'warning', content: `缺失技能: ${matchResult.data?.missingSkills?.join(', ') || '未知'}`, sources: ['JobPosting'] },
            { type: matchResult.data?.matchScore >= 70 ? 'opportunity' : 'warning', content: `匹配度: ${matchResult.data?.matchScore}%`, sources: ['JobPosting', 'Resume'] },
          ]
        : [{ type: 'info', content: '简历分析完成，建议指定目标岗位进行差距分析', sources: ['Resume'] }],
      actions: matchResult?.data?.missingSkills?.map((s: string) => ({
        action: '学习技能',
        target: s,
        priority: 'medium',
        reason: `目标岗位需要 ${s} 技能`,
        sources: ['JobPosting'],
      })) || [],
      plan: [],
    }
  }

  /**
   * interview_prep — 面试准备
   * 步骤：简历分析 → 岗位匹配 → 面试准备 → LLM 建议
   */
  private async runInterviewPrep(
    ctx: CareerToolContext,
    req: CareerWorkflowRequest,
    tools: any[],
    steps: CareerWorkflowStep[],
    toolsUsed: string[],
  ): Promise<CareerWorkflowOutput> {
    const jobId = req.params?.jobId
    if (!jobId) {
      return {
        summary: '请指定目标岗位ID',
        findings: [],
        actions: [],
        plan: [],
      }
    }

    // Step 1: 面试准备
    const prepTool = this.toolRegistry.getTool('interview_prepare')
    const prepResult = prepTool
      ? await prepTool.execute(ctx, { jobId, interviewType: req.params?.interviewType })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '面试准备',
      tool: 'interview_prepare',
      result: prepResult.success ? 'success' : 'failed',
      summary: prepResult.success ? `${prepResult.data?.questions?.length || 0} 个面试问题` : prepResult.error || '准备失败',
      sources: prepResult.sources,
    })
    if (prepResult.success) toolsUsed.push('interview_prepare')

    // Step 2: LLM 面试建议
    const prompt = this.buildInterviewPrompt(prepResult.data)
    const llmAgentId = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'career:interview_prep'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 2,
      action: 'LLM 面试建议',
      result: 'success',
      summary: `建议完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: (prepResult.data?.questions || []).slice(0, 3).map((q: any) => ({
        type: 'info',
        content: `${q.category}: ${q.question}`,
        sources: ['InterviewPrep'],
      })),
      actions: (prepResult.data?.tips || []).map((t: string) => ({
        action: '面试建议',
        target: t,
        priority: 'medium',
        reason: t,
        sources: ['InterviewPrep'],
      })),
      plan: (prepResult.data?.questions || []).map((q: any, i: number) => ({
        step: i + 1,
        action: q.question,
        detail: q.tip,
        timeframe: '',
      })),
    }
  }

  /**
   * salary_negotiation — 薪资谈判
   * 步骤：简历分析 → 薪资分析 → LLM 建议
   */
  private async runSalaryNegotiation(
    ctx: CareerToolContext,
    req: CareerWorkflowRequest,
    tools: any[],
    steps: CareerWorkflowStep[],
    toolsUsed: string[],
  ): Promise<CareerWorkflowOutput> {
    // Step 1: 薪资分析
    const salaryTool = this.toolRegistry.getTool('salary_analysis')
    const salaryResult = salaryTool
      ? await salaryTool.execute(ctx, {
          jobTitle: req.params?.jobTitle || '',
          location: req.params?.location,
          experience: req.params?.experience,
        })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '薪资分析',
      tool: 'salary_analysis',
      result: salaryResult.success ? 'success' : 'failed',
      summary: salaryResult.success
        ? salaryResult.data?.salaryRange
          ? `薪资范围: ${salaryResult.data.salaryRange.min}K-${salaryResult.data.salaryRange.max}K`
          : '暂无薪资数据'
        : salaryResult.error || '分析失败',
      sources: salaryResult.sources,
    })
    if (salaryResult.success) toolsUsed.push('salary_analysis')

    // Step 2: LLM 谈判建议
    const prompt = this.buildSalaryPrompt(salaryResult.data, req.params)
    const llmAgentId = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'career:salary_negotiation'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 2,
      action: 'LLM 谈判建议',
      result: 'success',
      summary: `建议完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: (salaryResult.data?.marketInsights || []).map((i: string) => ({
        type: 'info',
        content: i,
        sources: ['JobPosting'],
      })),
      actions: (salaryResult.data?.recommendations || []).map((r: string) => ({
        action: '薪资建议',
        target: r,
        priority: 'medium',
        reason: r,
        sources: ['JobPosting'],
      })),
      plan: [],
    }
  }

  /**
   * career_profile_analysis — 职业优势分析
   * Sprint-09D-01 Task 04: 基于用户画像做洞察，不搜索岗位
   *
   * 步骤：读取 CareerProfile → LLM 分析优势 → 输出结构化建议
   *
   * 与企业端 job_change 的区别：
   *   - 不调用 resume_analyze（企业端 Resume 模型）
   *   - 不调用 job_search / job_match
   *   - 直接基于 CareerProfile 数据做语义分析
   *   - 第一次任务失败（无 LLM key）时返回结构化占位
   */
  private async runCareerProfileAnalysis(
    ctx: CareerToolContext,
    req: CareerWorkflowRequest,
    steps: CareerWorkflowStep[],
    toolsUsed: string[],
  ): Promise<CareerWorkflowOutput> {
    // Step 1: 读取用户 CareerProfile
    let profileData: any = null
    try {
      profileData = await (this.prisma as any).careerProfile.findFirst({
        where: { userId: req.userId },
        include: {
          workExperiences: { orderBy: { startDate: 'desc' }, take: 3 },
          skills: { select: { skillName: true, proficiencyLevel: true }, take: 15 },
          educations: { orderBy: { startDate: 'desc' }, take: 2 },
        },
      })
    } catch {
      // 表不存在或读取失败 — 降级
    }
    steps.push({
      stepNumber: 1,
      action: '读取职业画像',
      result: profileData ? 'success' : 'failed',
      summary: profileData
        ? `找到 ${profileData.fullName || '用户'} 的职业画像，${profileData.skills?.length || 0} 项技能`
        : '暂未找到职业画像数据，将基于已有信息分析',
      sources: profileData ? ['CareerProfile'] : [],
    })

    // Step 2: LLM 优势分析（走 Gateway → BYOK）
    const prompt = this.buildProfileAnalysisPrompt(profileData, req.params)
    const llmAgentId = await this.resolveAgentProfileId(req.agentId, req.tenantId)

    let llmOutput: string
    let llmSuccess = false
    try {
      const llmResult = await this.executor.execute(llmAgentId, prompt, {
        organizationId: req.tenantId,
        actorId: req.userId,
        permissionScope: ['agent:execute', 'career:profile_analysis'],
        userId: req.userId,
      })
      llmOutput = llmResult.output
      llmSuccess = true
      toolsUsed.push('career_profile_analysis')
    } catch (err: any) {
      llmOutput = profileData
        ? this.buildFallbackAnalysis(profileData)
        : this.buildAnonymousFallback()
    }
    steps.push({
      stepNumber: 2,
      action: 'AI 优势分析',
      result: llmSuccess ? 'success' : 'failed',
      summary: llmSuccess ? '分析完成' : '使用结构化模板生成建议',
      sources: [],
    })

    return {
      summary: this.parseProfileSummary(llmOutput),
      findings: this.extractFindings(llmOutput, profileData),
      actions: this.extractActions(llmOutput),
      plan: this.extractPlan(llmOutput),
    }
  }

  // ─── Agent Profile 解析 ────────────────────────────────

  /**
   * 解析 Agent Profile ID 用于 LLM 调用
   * 优先级与企业端相同
   */
  private async resolveAgentProfileId(agentId: string, tenantId?: string): Promise<string> {
    const p = this.prisma as any
    // Sprint-02 Fix: 禁止 fallback UUID，tenantId 必须显式传入
    if (!tenantId) {
      throw new Error('resolveAgentProfileId: tenantId is required')
    }
    const tid = tenantId

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(agentId)) {
      const exists = await p.enterpriseAgentProfile.findUnique({
        where: { id: agentId },
        select: { id: true },
      })
      if (exists) return exists.id
    }

    // 查找 career_advisor 类型（AI 职业助理也使用 career_advisor）
    const advisorProfile = await p.enterpriseAgentProfile.findFirst({
      where: { agentType: 'career_advisor', tenantId: tid },
      select: { id: true },
    })
    if (advisorProfile) return advisorProfile.id

    // Fallback: 返回租户下第一个 profile
    const anyProfile = await p.enterpriseAgentProfile.findFirst({
      where: { tenantId: tid },
      select: { id: true },
    })
    return anyProfile?.id || agentId
  }

  // ─── LLM Prompt 构建 ───────────────────────────────────

  private buildJobChangePrompt(resume: any, jobs: any, matches: any[], plan: any): string {
    return `你是 AI 职业助理，帮助用户换工作。

## 用户简历
- 姓名: ${resume?.name || '未知'}
- 技能: ${resume?.skills?.join(', ') || '未知'}
- 经验: ${resume?.experience || '未知'}
- 优势: ${resume?.strengths?.join(', ') || '暂无'}
- 待提升: ${resume?.gaps?.join(', ') || '暂无'}

## 搜索到的岗位
${(jobs?.jobs || []).slice(0, 5).map((j: any, i: number) => `${i + 1}. ${j.title} (${j.company}) - ${j.salary || '薪资面议'}`).join('\n') || '暂无'}

## 匹配结果
${matches.map((m: any, i: number) => `${i + 1}. ${m.jobTitle} (${m.company}) - 匹配度 ${m.matchScore}%`).join('\n') || '暂无'}

## 行动计划
${(plan?.steps || []).map((s: any) => `Step ${s.step}: ${s.action} - ${s.detail}`).join('\n') || '暂无'}

请生成一段综合建议（200字以内），包括：
1. 当前竞争力评估
2. 推荐优先投递的岗位
3. 下一步行动建议

直接输出文字，不要 JSON。`
  }

  private buildSkillGapPrompt(resume: any, match: any): string {
    return `你是 AI 职业助理，负责技能差距分析。

## 用户技能
${resume?.skills?.map((s: string) => `- ${s}`).join('\n') || '暂无数据'}

${match ? `## 目标岗位匹配
- 岗位: ${match.jobTitle} (${match.company})
- 匹配度: ${match.matchScore}%
- 已匹配技能: ${match.matchedSkills?.join(', ') || '无'}
- 缺失技能: ${match.missingSkills?.join(', ') || '无'}` : '未指定目标岗位，请基于用户技能给出提升建议。'}

请给出技能提升建议（200字以内），包括：
1. 关键缺失技能
2. 学习优先级
3. 推荐学习路径

直接输出文字，不要 JSON。`
  }

  private buildInterviewPrompt(prep: any): string {
    return `你是 AI 职业助理，帮助用户准备面试。

## 目标岗位
- ${prep?.jobTitle || '未知'} (${prep?.company || '未知'})
- 面试类型: ${prep?.interviewType || '初面'}

## 面试问题
${(prep?.questions || []).map((q: any, i: number) => `${i + 1}. [${q.category}] ${q.question}\n   提示: ${q.tip}`).join('\n') || '暂无'}

## 面试建议
${(prep?.tips || []).map((t: string) => `- ${t}`).join('\n') || '暂无'}

请给出面试准备建议（200字以内），包括：
1. 重点准备方向
2. 自我介绍要点
3. 注意事项

直接输出文字，不要 JSON。`
  }

  private buildSalaryPrompt(salary: any, params: any): string {
    return `你是 AI 职业助理，帮助用户进行薪资谈判。

## 目标岗位
- 岗位: ${params?.jobTitle || '未知'}
- 地点: ${params?.location || '未知'}
- 经验: ${params?.experience || '未知'}

## 市场数据
${salary?.salaryRange ? `- 薪资范围: ${salary.salaryRange.min}K-${salary.salaryRange.max}K
- 中位数: ${salary.salaryRange.median}K
- 样本数: ${salary.sampleSize}` : '暂无足够市场数据'}

## 市场洞察
${(salary?.marketInsights || []).map((i: string) => `- ${i}`).join('\n') || '暂无'}

## 建议
${(salary?.recommendations || []).map((r: string) => `- ${r}`).join('\n') || '暂无'}

请给出薪资谈判建议（200字以内），包括：
1. 合理期望薪资范围
2. 谈判策略
3. 注意事项

直接输出文字，不要 JSON。`
  }

  // ─── Career Profile Analysis 辅助方法 ────────────────

  /**
   * 构建 LLM prompt — 不做岗位搜索，只基于画像做洞察
   */
  private buildProfileAnalysisPrompt(profile: any, params?: Record<string, any>): string {
    const skills = profile?.skills?.map((s: any) => s.skillName).join(', ') || params?.skills?.join(', ') || ''
    const experiences = profile?.workExperiences?.map((w: any) =>
      `${w.title} @ ${w.company} (${w.startDate?.toISOString?.()?.slice(0, 7) || ''} - ${w.endDate?.toISOString?.()?.slice(0, 7) || '至今'})`
    ).join('\n') || params?.experience || ''
    const education = profile?.educations?.map((e: any) =>
      `${e.degree} - ${e.major} @ ${e.school}`
    ).join('\n') || ''

    return `你是镜心，用户的 AI 职业伙伴。

请根据以下用户信息进行职业优势分析。

## 用户信息
- 姓名: ${profile?.fullName || params?.fullName || '用户'}
- 职位方向: ${profile?.careerDirection || params?.careerGoal || params?.currentRole || ''}
- 所在城市: ${profile?.city || params?.city || ''}
- 经验年限: ${profile?.yearsExperience || params?.yearsExperience || ''} 年
- 当前级别: ${profile?.currentLevel || ''}
- 行业: ${profile?.industry || ''}
- 期望薪资: ${params?.expectedSalary || params?.salary || ''}

## 技能
${skills || '暂未记录'}

## 工作经历
${experiences || '暂未记录'}

## 教育背景
${education || '暂未记录'}

请生成一份职业优势分析，格式要求：

=== 核心优势 ===
列出 2-3 条最突出的个人优势，每行一条，以 "🎯" 开头

=== 适合方向 ===
列出 2-3 个适合的职业方向或岗位类型，每行一条

=== 下一步建议 ===
列出 2-3 条具体可执行的行动建议

直接输出文字，不要 JSON。`
  }

  /**
   * 降级分析 — 有 CareerProfile 但 LLM 不可用时
   */
  private buildFallbackAnalysis(profile: any): string {
    const skills = profile?.skills?.map((s: any) => s.skillName).join(', ') || ''
    return [
      '=== 核心优势 ===',
      `🎯 ${skills ? '核心技能: ' + skills : '具备基础职业素养'}`,
      profile?.yearsExperience ? `🎯 ${profile.yearsExperience} 年行业经验` : '',
      profile?.careerDirection ? `🎯 明确职业方向: ${profile.careerDirection}` : '',
      '',
      '=== 适合方向 ===',
      profile?.careerDirection ? `🎯 ${profile.careerDirection} 相关岗位` : '🎯 垂直领域岗位',
      profile?.industry ? `🎯 ${profile.industry} 行业机会` : '',
      '',
      '=== 下一步建议 ===',
      '🎯 完善简历，突出核心技能和项目经验',
      '🎯 持续关注目标行业的最新动态和招聘需求',
      '🎯 建立行业人脉，拓展职业机会',
    ].filter(Boolean).join('\n')
  }

  /**
   * 降级分析 — 无 CareerProfile 且 LLM 不可用时
   */
  private buildAnonymousFallback(): string {
    return [
      '=== 核心优势 ===',
      '🎯 你的职业背景和技能组合具有发展潜力',
      '🎯 建议完善个人资料以获取更精准的分析',
      '',
      '=== 适合方向 ===',
      '🎯 在个人资料中补充职业方向和目标',
      '🎯 系统将根据你的画像匹配适合的岗位',
      '',
      '=== 下一步建议 ===',
      '🎯 完成职业画像，让镜心更了解你',
      '🎯 补充技能和经验信息',
      '🎯 关注行业趋势，发现适合的机会',
    ].join('\n')
  }

  /**
   * 从 LLM 输出中提取摘要（第一段非标签行）
   */
  private parseProfileSummary(output: string): string {
    return output
      .replace(/===.*===/g, '')
      .replace(/🎯.*/g, '')
      .split('\n')
      .filter(l => l.trim())
      .slice(0, 3)
      .join(' ')
      .trim()
      .slice(0, 200)
  }

  /**
   * 从 LLM 输出中提取发现项
   */
  private extractFindings(output: string, profile: any): CareerWorkflowOutput['findings'] {
    const findings: CareerWorkflowOutput['findings'] = []

    // 解析 === 核心优势 === 后的内容
    const coreSection = output.match(/=== 核心优势 ===([\s\S]*?)(?:===|$)/)
    if (coreSection) {
      const lines = coreSection[1].split('\n').filter(l => l.trim() && l.includes('🎯'))
      lines.slice(0, 3).forEach(l => {
        findings.push({
          type: 'opportunity',
          content: l.replace(/🎯\s*/, '').trim(),
          sources: ['CareerProfile'],
        })
      })
    }

    // 解析 === 适合方向 === 后的内容
    const directionSection = output.match(/=== 适合方向 ===([\s\S]*?)(?:===|$)/)
    if (directionSection) {
      const lines = directionSection[1].split('\n').filter(l => l.trim() && l.includes('🎯'))
      lines.slice(0, 2).forEach(l => {
        findings.push({
          type: 'info',
          content: l.replace(/🎯\s*/, '').trim(),
          sources: ['CareerProfile'],
        })
      })
    }

    return findings
  }

  /**
   * 从 LLM 输出中提取行动建议
   */
  private extractActions(output: string): CareerWorkflowOutput['actions'] {
    const actions: CareerWorkflowOutput['actions'] = []

    const actionSection = output.match(/=== 下一步建议 ===([\s\S]*?)$/)
    if (actionSection) {
      const lines = actionSection[1].split('\n').filter(l => l.trim() && l.includes('🎯'))
      lines.slice(0, 3).forEach(l => {
        actions.push({
          action: '建议',
          target: l.replace(/🎯\s*/, '').trim(),
          priority: 'medium',
          reason: l.replace(/🎯\s*/, '').trim(),
          sources: ['CareerProfile'],
        })
      })
    }

    return actions
  }

  /**
   * 从 LLM 输出中提取执行计划
   */
  private extractPlan(output: string): CareerWorkflowOutput['plan'] {
    const plan: CareerWorkflowOutput['plan'] = []

    const actionSection = output.match(/=== 下一步建议 ===([\s\S]*?)$/)
    if (actionSection) {
      const lines = actionSection[1].split('\n').filter(l => l.trim() && l.includes('🎯'))
      lines.slice(0, 3).forEach((l, i) => {
        plan.push({
          step: i + 1,
          action: '执行',
          detail: l.replace(/🎯\s*/, '').trim(),
          timeframe: '1-2 周',
        })
      })
    }

    return plan
  }

  // ─── 原有辅助方法 ────────────────────────────────────────

  private parseLLMSummary(output: string): string {
    return output
      .replace(/```json\s*[\s\S]*?```/g, '')
      .replace(/```\s*[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*\}/g, '')
      .trim()
      .slice(0, 500)
  }

  private buildCareerFindings(resumeResult: CareerToolResult, matchResults: any[]): CareerWorkflowOutput['findings'] {
    const findings: CareerWorkflowOutput['findings'] = []
    if (resumeResult.success && resumeResult.data) {
      const data = resumeResult.data
      if (data.skills?.length > 0) {
        findings.push({
          type: 'info',
          content: `掌握 ${data.skills.length} 项技能: ${data.skills.slice(0, 5).join(', ')}`,
          sources: ['Resume'],
        })
      }
      if (data.strengths?.length > 0) {
        findings.push({
          type: 'opportunity',
          content: `核心优势: ${data.strengths.join(', ')}`,
          sources: ['Resume'],
        })
      }
      if (data.gaps?.length > 0) {
        findings.push({
          type: 'warning',
          content: `待提升: ${data.gaps.join(', ')}`,
          sources: ['Resume'],
        })
      }
    }
    if (matchResults.length > 0) {
      const topMatch = matchResults[0]
      findings.push({
        type: topMatch.matchScore >= 70 ? 'opportunity' : 'warning',
        content: `最高匹配岗位: ${topMatch.jobTitle} (${topMatch.company}) - ${topMatch.matchScore}%`,
        sources: ['JobPosting', 'Resume'],
      })
    }
    return findings
  }

  /**
   * 记录 Workflow 执行到 Memory
   */
  private async recordWorkflowMemory(
    ctx: CareerToolContext,
    workflowType: string,
    output: CareerWorkflowOutput,
    steps: CareerWorkflowStep[],
  ): Promise<void> {
    try {
      await (this.prisma as any).agentMemory.create({
        data: {
          agentId: 'agent_camera',
          memoryType: 'career_workflow_execution',
          content: JSON.stringify({
            workflowType,
            executedAt: new Date().toISOString(),
            summary: output.summary,
            steps: steps.map(s => ({ action: s.action, result: s.result })),
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            memoryNamespace: ctx.memoryNamespace,
          }),
          embeddingVector: null,
        },
      })
    } catch {
      // Memory 记录失败不阻断 Workflow
    }
  }

  /**
   * 构建错误结果
   */
  private buildErrorResult(
    req: CareerWorkflowRequest,
    hermesAgentId: string,
    memoryNamespace: string,
    steps: CareerWorkflowStep[],
    toolsUsed: string[],
    totalTokens: number,
    startTime: number,
    error: string,
  ): CareerWorkflowResult {
    return {
      workflowType: req.workflowType,
      status: 'failed',
      generatedAt: new Date().toISOString(),
      agentId: req.agentId,
      agentName: 'AI 职业助理',
      userId: req.userId,
      tenantId: req.tenantId,
      hermesAgentId,
      memoryNamespace,
      steps,
      output: {
        summary: `Workflow 执行失败: ${error}`,
        findings: [],
        actions: [],
        plan: [],
      },
      metadata: {
        model: 'deepseek-v4-flash',
        tokensUsed: totalTokens,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
        toolsUsed,
      },
    }
  }
}

// 工厂函数
export function createCareerWorkflowExecutor(prisma: PrismaClient, executor: AgentExecutorImpl): CareerWorkflowExecutor {
  return new CareerWorkflowExecutor(prisma, executor)
}
