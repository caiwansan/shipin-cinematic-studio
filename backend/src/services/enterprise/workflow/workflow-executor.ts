/**
 * Workflow Executor — KM-AI-JOB-AGENT-07
 * AI 招聘经理 Hermes Workflow 执行引擎
 *
 * 核心循环：
 *   1. 读取招聘数据（通过 Tool Registry）
 *   2. 调用 LLM 决策（通过 AgentExecutor → Gateway → BYOK）
 *   3. 执行工具调用（读/分析/报告/任务）
 *   4. 记录 Memory（隔离命名空间）
 *   5. 输出结构化结果
 *
 * 架构约束：
 *   - 不直接查数据库（通过 Tool Registry）
 *   - 不直接调 LLM（通过 AgentExecutor → Gateway）
 *   - L1 辅助执行：不自动修改业务数据
 *   - Memory 隔离：tenant/{tenantId}/agent/{agentInstanceId}
 *   - 所有输出附带数据来源标记
 */

import type { PrismaClient } from '@prisma/client'
import { ToolRegistry, type ToolContext, type ToolResult } from './tool-registry'
import { AgentExecutorImpl } from '../../../agent-runtime/brain/agent-executor'
import { MemoryNamespaceService } from '../memory-namespace.service'

// ─── 类型定义 ───────────────────────────────────────────

export type WorkflowType =
  | 'daily_briefing'       // 每日招聘简报
  | 'candidate_discovery'  // 候选人发现
  | 'pipeline_review'      // Pipeline 审查
  | 'risk_assessment'      // 风险评估
  | 'action_plan'          // 行动计划

export interface WorkflowRequest {
  workflowType: WorkflowType
  tenantId: string
  userId: string
  agentId: string
  agentInstanceId: string
  params?: Record<string, any>
}

export interface WorkflowStep {
  stepNumber: number
  action: string
  tool?: string
  result: 'success' | 'failed' | 'skipped'
  summary: string
  sources: string[]
}

export interface WorkflowResult {
  workflowType: WorkflowType
  status: 'completed' | 'partial' | 'failed'
  generatedAt: string
  agentId: string
  agentName: string
  tenantId: string
  hermesAgentId: string
  memoryNamespace: string
  steps: WorkflowStep[]
  output: WorkflowOutput
  metadata: {
    model: string
    tokensUsed: number
    durationMs: number
    provider: string
    toolsUsed: string[]
  }
}

export interface WorkflowOutput {
  summary: string
  findings: Array<{
    type: 'info' | 'risk' | 'opportunity'
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
  tasks: Array<{
    title: string
    description: string
    priority: string
    status: 'pending'
  }>
}

// ─── Workflow Executor ──────────────────────────────────

export class WorkflowExecutor {
  private toolRegistry: ToolRegistry
  private memoryService: MemoryNamespaceService

  constructor(
    private prisma: PrismaClient,
    private executor: AgentExecutorImpl,
  ) {
    this.toolRegistry = new ToolRegistry(prisma)
    this.memoryService = new MemoryNamespaceService()
  }

  /**
   * 执行 Workflow
   */
  async execute(req: WorkflowRequest): Promise<WorkflowResult> {
    const startTime = Date.now()
    const steps: WorkflowStep[] = []
    const toolsUsed: string[] = []
    let totalTokens = 0

    // 1. 获取 Memory Namespace
    const nsResult = await this.memoryService.getNamespace(req.agentInstanceId)
    const memoryNamespace = nsResult?.namespace || `tenant/${req.tenantId}/agent/${req.agentInstanceId}`

    // 2. 获取 Hermes Agent ID
    const binding = await (this.prisma as any).hermesProfileBinding.findUnique({
      where: { agentInstanceId: req.agentInstanceId },
      select: { hermesAgentId: true },
    })
    const hermesAgentId = binding?.hermesAgentId || `hermes_${req.tenantId.slice(0, 8)}_${req.agentInstanceId.slice(0, 8)}`

    // 3. 构建 Tool Context
    const toolCtx: ToolContext = {
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
      : this.toolRegistry.listTools().map(t => t.name) // 默认全部可用

    const availableTools = this.toolRegistry.getAvailableTools(allowedTools)

    // 5. 执行 Workflow 步骤
    let workflowOutput: WorkflowOutput

    try {
      switch (req.workflowType) {
        case 'daily_briefing':
          workflowOutput = await this.runDailyBriefing(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'candidate_discovery':
          workflowOutput = await this.runCandidateDiscovery(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'pipeline_review':
          workflowOutput = await this.runPipelineReview(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'risk_assessment':
          workflowOutput = await this.runRiskAssessment(toolCtx, req, availableTools, steps, toolsUsed)
          break
        case 'action_plan':
          workflowOutput = await this.runActionPlan(toolCtx, req, availableTools, steps, toolsUsed)
          break
        default:
          throw new Error(`Unknown workflow type: ${req.workflowType}`)
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
      agentName: 'AI 招聘经理',
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
   * 每日招聘简报
   * 步骤：读取数据 → 生成报告 → LLM 分析 → 推荐行动 → 创建任务
   */
  private async runDailyBriefing(
    ctx: ToolContext,
    req: WorkflowRequest,
    tools: any[],
    steps: WorkflowStep[],
    toolsUsed: string[],
  ): Promise<WorkflowOutput> {
    // Step 1: 读取招聘数据
    const readTool = this.toolRegistry.getTool('read_recruitment_data')
    const readResult = readTool
      ? await readTool.execute(ctx, { dataType: 'all', limit: 50 })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '读取招聘数据',
      tool: 'read_recruitment_data',
      result: readResult.success ? 'success' : 'failed',
      summary: readResult.success ? `读取到 ${readResult.sources.join(', ')}` : readResult.error || '读取失败',
      sources: readResult.sources,
    })
    if (readResult.success) toolsUsed.push('read_recruitment_data')

    // Step 2: 生成报告
    const reportTool = this.toolRegistry.getTool('generate_report')
    const reportResult = reportTool
      ? await reportTool.execute(ctx, { reportType: 'daily_summary' })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 2,
      action: '生成每日简报',
      tool: 'generate_report',
      result: reportResult.success ? 'success' : 'failed',
      summary: reportResult.success ? '报告已生成' : reportResult.error || '生成失败',
      sources: reportResult.sources,
    })
    if (reportResult.success) toolsUsed.push('generate_report')

    // Step 3: LLM 分析（走 Gateway → BYOK）
    const reportData = reportResult.data || {}
    const prompt = this.buildDailyBriefingPrompt(readResult.data, reportData)
    const llmAgentId = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'workflow:daily_briefing'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 3,
      action: 'LLM 分析',
      result: 'success',
      summary: `LLM 分析完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    // Step 4: 推荐行动
    const actionTool = this.toolRegistry.getTool('recommend_next_action')
    const actionResult = actionTool
      ? await actionTool.execute(ctx, { focusArea: 'all' })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 4,
      action: '推荐行动',
      tool: 'recommend_next_action',
      result: actionResult.success ? 'success' : 'failed',
      summary: actionResult.success ? `${actionResult.data?.total || 0} 条建议` : actionResult.error || '推荐失败',
      sources: actionResult.sources,
    })
    if (actionResult.success) toolsUsed.push('recommend_next_action')

    // Step 5: 创建 HR 任务（高优先级建议）
    const highActions = (actionResult.data?.actions || []).filter((a: any) => a.priority === 'high')
    for (const action of highActions.slice(0, 3)) {
      const taskTool = this.toolRegistry.getTool('create_hr_task')
      if (taskTool) {
        await taskTool.execute(ctx, {
          title: action.action === 'review_pending' ? '审核待处理候选人' : action.action === 'contact_candidate' ? '联系高匹配候选人' : action.action,
          description: action.reason,
          priority: action.priority,
          relatedCandidate: action.target,
        })
      }
    }
    if (highActions.length > 0) {
      steps.push({
        stepNumber: 5,
        action: '创建 HR 任务',
        tool: 'create_hr_task',
        result: 'success',
        summary: `创建 ${Math.min(highActions.length, 3)} 个 HR 任务`,
        sources: ['AgentMemory:hr_task'],
      })
      toolsUsed.push('create_hr_task')
    }

    // 组装输出
    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: this.buildFindings(readResult, reportResult),
      actions: (actionResult.data?.actions || []).map((a: any) => ({
        action: a.action,
        target: a.target,
        priority: a.priority,
        reason: a.reason,
        sources: a.sources,
      })),
      tasks: highActions.slice(0, 3).map((a: any) => ({
        title: a.action,
        description: a.reason,
        priority: a.priority,
        status: 'pending' as const,
      })),
    }
  }

  /**
   * 候选人发现
   * 步骤：搜索候选人 → 分析 → LLM 评价 → 推荐联系
   */
  private async runCandidateDiscovery(
    ctx: ToolContext,
    req: WorkflowRequest,
    tools: any[],
    steps: WorkflowStep[],
    toolsUsed: string[],
  ): Promise<WorkflowOutput> {
    const keyword = req.params?.keyword
    const minScore = req.params?.minScore || 65

    // Step 1: 搜索候选人
    const searchTool = this.toolRegistry.getTool('search_candidates')
    const searchResult = searchTool
      ? await searchTool.execute(ctx, { keyword, minScore, status: 'discovered' })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '搜索候选人',
      tool: 'search_candidates',
      result: searchResult.success ? 'success' : 'failed',
      summary: searchResult.success ? `发现 ${searchResult.data?.total || 0} 名候选人` : searchResult.error || '搜索失败',
      sources: searchResult.sources,
    })
    if (searchResult.success) toolsUsed.push('search_candidates')

    // Step 2: 分析 Top 候选人
    const candidates = (searchResult.data?.candidates || []).slice(0, 3)
    const analyses: any[] = []
    for (const candidate of candidates) {
      const analyzeTool = this.toolRegistry.getTool('analyze_candidate')
      if (analyzeTool) {
        const result = await analyzeTool.execute(ctx, { candidateName: candidate.candidateName })
        if (result.success) {
          analyses.push(result.data)
        }
      }
    }
    steps.push({
      stepNumber: 2,
      action: '分析候选人',
      tool: 'analyze_candidate',
      result: analyses.length > 0 ? 'success' : 'failed',
      summary: `分析 ${analyses.length} 名候选人`,
      sources: ['CandidateMatch', 'RecruitmentPipeline'],
    })
    if (analyses.length > 0) toolsUsed.push('analyze_candidate')

    // Step 3: LLM 综合评价
    const prompt = this.buildCandidateDiscoveryPrompt(analyses)
    const llmAgentId2 = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId2, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'workflow:candidate_discovery'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 3,
      action: 'LLM 综合评价',
      result: 'success',
      summary: `LLM 评价完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: analyses.map((a: any) => ({
        type: a.overallRating === 'recommend' ? 'opportunity' : 'info',
        content: `${a.candidateName}（${a.jobTitle}）匹配度 ${a.matchScore}%，评级: ${a.overallRating}`,
        sources: ['CandidateMatch'],
      })),
      actions: analyses
        .filter((a: any) => a.overallRating === 'recommend')
        .map((a: any) => ({
          action: 'contact_candidate',
          target: a.candidateName,
          priority: 'high',
          reason: `高匹配度 ${a.matchScore}%，建议优先联系`,
          sources: ['CandidateMatch'],
        })),
      tasks: [],
    }
  }

  /**
   * Pipeline 审查
   * 步骤：读取 Pipeline → 分析瓶颈 → LLM 建议
   */
  private async runPipelineReview(
    ctx: ToolContext,
    req: WorkflowRequest,
    tools: any[],
    steps: WorkflowStep[],
    toolsUsed: string[],
  ): Promise<WorkflowOutput> {
    // Step 1: 读取 Pipeline 数据
    const readTool = this.toolRegistry.getTool('read_recruitment_data')
    const readResult = readTool
      ? await readTool.execute(ctx, { dataType: 'pipeline', limit: 100 })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '读取 Pipeline',
      tool: 'read_recruitment_data',
      result: readResult.success ? 'success' : 'failed',
      summary: readResult.success ? `${readResult.data?.pipelines?.length || 0} 条 Pipeline` : readResult.error || '读取失败',
      sources: readResult.sources,
    })
    if (readResult.success) toolsUsed.push('read_recruitment_data')

    // Step 2: 生成 Pipeline 分析
    const reportTool = this.toolRegistry.getTool('generate_report')
    const reportResult = reportTool
      ? await reportTool.execute(ctx, { reportType: 'pipeline_analysis' })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 2,
      action: 'Pipeline 分析',
      tool: 'generate_report',
      result: reportResult.success ? 'success' : 'failed',
      summary: reportResult.success ? `瓶颈: ${reportResult.data?.bottleneck || 'unknown'}` : reportResult.error || '分析失败',
      sources: reportResult.sources,
    })
    if (reportResult.success) toolsUsed.push('generate_report')

    // Step 3: LLM 建议
    const prompt = this.buildPipelineReviewPrompt(readResult.data, reportResult.data)
    const llmAgentId3 = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId3, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'workflow:pipeline_review'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 3,
      action: 'LLM 建议',
      result: 'success',
      summary: `LLM 建议完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: [
        {
          type: 'info',
          content: `Pipeline 瓶颈: ${reportResult.data?.bottleneck || 'unknown'}，${reportResult.data?.recommendation || ''}`,
          sources: ['RecruitmentPipeline'],
        },
      ],
      actions: (readResult.data?.pipelines || [])
        .filter((p: any) => {
          if (!p.lastActivityAt) return false
          const days = (Date.now() - new Date(p.lastActivityAt).getTime()) / 86400000
          return days > 7 && !['hired', 'rejected'].includes(p.stage)
        })
        .slice(0, 5)
        .map((p: any) => ({
          action: 'advance_pipeline',
          target: `${p.candidateName}（${p.stage}）`,
          priority: 'medium',
          reason: '候选人长时间未推进',
          sources: ['RecruitmentPipeline'],
        })),
      tasks: [],
    }
  }

  /**
   * 风险评估
   * 步骤：读取数据 → 风险报告 → LLM 评估 → 通知
   */
  private async runRiskAssessment(
    ctx: ToolContext,
    req: WorkflowRequest,
    tools: any[],
    steps: WorkflowStep[],
    toolsUsed: string[],
  ): Promise<WorkflowOutput> {
    // Step 1: 读取全量数据
    const readTool = this.toolRegistry.getTool('read_recruitment_data')
    const readResult = readTool
      ? await readTool.execute(ctx, { dataType: 'all', limit: 100 })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '读取招聘数据',
      tool: 'read_recruitment_data',
      result: readResult.success ? 'success' : 'failed',
      summary: readResult.success ? `读取到 ${readResult.sources.join(', ')}` : readResult.error || '读取失败',
      sources: readResult.sources,
    })
    if (readResult.success) toolsUsed.push('read_recruitment_data')

    // Step 2: 生成风险报告
    const reportTool = this.toolRegistry.getTool('generate_report')
    const reportResult = reportTool
      ? await reportTool.execute(ctx, { reportType: 'risk_alert' })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 2,
      action: '生成风险报告',
      tool: 'generate_report',
      result: reportResult.success ? 'success' : 'failed',
      summary: reportResult.success ? `${reportResult.data?.risks?.length || 0} 条风险` : reportResult.error || '生成失败',
      sources: reportResult.sources,
    })
    if (reportResult.success) toolsUsed.push('generate_report')

    // Step 3: LLM 评估
    const prompt = this.buildRiskAssessmentPrompt(readResult.data, reportResult.data)
    const llmAgentId4 = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId4, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'workflow:risk_assessment'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 3,
      action: 'LLM 风险评估',
      result: 'success',
      summary: `LLM 评估完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    // Step 4: 高风险 → 发送通知
    const highRisks = (reportResult.data?.risks || []).filter((r: any) => r.level === 'high')
    if (highRisks.length > 0) {
      const notifyTool = this.toolRegistry.getTool('send_notification')
      if (notifyTool) {
        await notifyTool.execute(ctx, {
          title: '招聘风险告警',
          message: highRisks.map((r: any) => r.content).join('\n'),
          level: 'alert',
        })
        steps.push({
          stepNumber: 4,
          action: '发送风险通知',
          tool: 'send_notification',
          result: 'success',
          summary: `${highRisks.length} 条高风险通知`,
          sources: ['AgentMemory:notification'],
        })
        toolsUsed.push('send_notification')
      }
    }

    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: (reportResult.data?.risks || []).map((r: any) => ({
        type: r.level === 'high' ? 'risk' : 'info',
        content: r.content,
        sources: r.sources,
      })),
      actions: [],
      tasks: highRisks.length > 0 ? [{
        title: '处理高风险项',
        description: highRisks.map((r: any) => r.content).join('; '),
        priority: 'high',
        status: 'pending' as const,
      }] : [],
    }
  }

  /**
   * 行动计划
   * 步骤：读取数据 → 推荐行动 → LLM 规划 → 创建任务
   */
  private async runActionPlan(
    ctx: ToolContext,
    req: WorkflowRequest,
    tools: any[],
    steps: WorkflowStep[],
    toolsUsed: string[],
  ): Promise<WorkflowOutput> {
    const focusArea = req.params?.focusArea || 'all'

    // Step 1: 读取数据
    const readTool = this.toolRegistry.getTool('read_recruitment_data')
    const readResult = readTool
      ? await readTool.execute(ctx, { dataType: 'all', limit: 50 })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 1,
      action: '读取招聘数据',
      tool: 'read_recruitment_data',
      result: readResult.success ? 'success' : 'failed',
      summary: readResult.success ? `读取到 ${readResult.sources.join(', ')}` : readResult.error || '读取失败',
      sources: readResult.sources,
    })
    if (readResult.success) toolsUsed.push('read_recruitment_data')

    // Step 2: 推荐行动
    const actionTool = this.toolRegistry.getTool('recommend_next_action')
    const actionResult = actionTool
      ? await actionTool.execute(ctx, { focusArea })
      : { success: false, data: null, sources: [], error: 'tool not found' }
    steps.push({
      stepNumber: 2,
      action: '推荐行动',
      tool: 'recommend_next_action',
      result: actionResult.success ? 'success' : 'failed',
      summary: actionResult.success ? `${actionResult.data?.total || 0} 条建议` : actionResult.error || '推荐失败',
      sources: actionResult.sources,
    })
    if (actionResult.success) toolsUsed.push('recommend_next_action')

    // Step 3: LLM 规划
    const prompt = this.buildActionPlanPrompt(readResult.data, actionResult.data)
    const llmAgentId5 = await this.resolveAgentProfileId(req.agentId, req.tenantId)
    const llmResult = await this.executor.execute(llmAgentId5, prompt, {
      organizationId: req.tenantId,
      actorId: req.userId,
      permissionScope: ['agent:execute', 'workflow:action_plan'],
      userId: req.userId,
    })
    steps.push({
      stepNumber: 3,
      action: 'LLM 规划',
      result: 'success',
      summary: `LLM 规划完成 (${llmResult.tokensUsed} tokens)`,
      sources: [],
    })

    // Step 4: 创建 HR 任务
    const actions = actionResult.data?.actions || []
    for (const action of actions.slice(0, 5)) {
      const taskTool = this.toolRegistry.getTool('create_hr_task')
      if (taskTool) {
        await taskTool.execute(ctx, {
          title: action.action,
          description: action.reason,
          priority: action.priority,
          relatedCandidate: action.target,
        })
      }
    }
    if (actions.length > 0) {
      steps.push({
        stepNumber: 4,
        action: '创建 HR 任务',
        tool: 'create_hr_task',
        result: 'success',
        summary: `创建 ${Math.min(actions.length, 5)} 个 HR 任务`,
        sources: ['AgentMemory:hr_task'],
      })
      toolsUsed.push('create_hr_task')
    }

    return {
      summary: this.parseLLMSummary(llmResult.output),
      findings: [],
      actions: actions.map((a: any) => ({
        action: a.action,
        target: a.target,
        priority: a.priority,
        reason: a.reason,
        sources: a.sources,
      })),
      tasks: actions.slice(0, 5).map((a: any) => ({
        title: a.action,
        description: a.reason,
        priority: a.priority,
        status: 'pending' as const,
      })),
    }
  }

  // ─── Agent Profile 解析 ────────────────────────────────

  /**
   * 将 agentInstanceId / AgentDef ID 解析为 EnterpriseAgentProfile ID
   * 用于 LLM 调用时通过 validateAccess 的租户检查
   *
   * 优先级：
   *   1. agentInstanceId → HermesProfileBinding → 查找对应 agentType 的 EnterpriseAgentProfile
   *   2. 直接查找 career_advisor 类型（AI 招聘经理）
   *   3. 返回租户下第一个 active profile
   */
  private async resolveAgentProfileId(agentId: string, tenantId?: string): Promise<string> {
    const p = this.prisma as any
    const tid = tenantId || '5ba4891a-511f-4620-8862-7dc83f37ea75'

    // 1. 如果已经是 EnterpriseAgentProfile 的 UUID，直接验证
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(agentId)) {
      const exists = await p.enterpriseAgentProfile.findUnique({
        where: { id: agentId },
        select: { id: true },
      })
      if (exists) return exists.id
    }

    // 2. 查找 AI 招聘经理的 EnterpriseAgentProfile（career_advisor 类型）
    const managerProfile = await p.enterpriseAgentProfile.findFirst({
      where: { agentType: 'career_advisor', tenantId: tid },
      select: { id: true },
    })
    if (managerProfile) return managerProfile.id

    // 3. Fallback: 返回租户下第一个 profile
    const anyProfile = await p.enterpriseAgentProfile.findFirst({
      where: { tenantId: tid },
      select: { id: true },
    })
    return anyProfile?.id || agentId
  }

  // ─── LLM Prompt 构建 ───────────────────────────────────

  private buildDailyBriefingPrompt(data: any, report: any): string {
    const summary = report.summary || {}
    return `你是 AI 招聘经理，负责生成每日招聘简报。

## 今日招聘概况
- 总岗位: ${summary.totalJobs || 0}，活跃: ${summary.activeJobs || 0}
- 候选人匹配: ${summary.totalMatches || 0}，高匹配(≥70): ${summary.highMatches || 0}
- Pipeline: ${summary.pipelineTotal || 0} 人
- 待审核: ${summary.pendingReviews || 0} 项
- 面试: ${summary.totalInterviews || 0} 场

## Pipeline 分布
${Object.entries(report.pipelineDistribution || {}).map(([s, c]) => `- ${s}: ${c}人`).join('\n') || '暂无数据'}

请生成一段简洁的每日招聘简报（200字以内），包括：
1. 今日招聘状态概述
2. 需要关注的风险点
3. 建议优先处理的行动

直接输出文字，不要 JSON。`
  }

  private buildCandidateDiscoveryPrompt(analyses: any[]): string {
    if (analyses.length === 0) {
      return '没有发现匹配的候选人。建议扩大搜索范围或调整筛选条件。'
    }
    return `你是 AI 招聘经理，负责评价候选人。

## 候选人分析结果
${analyses.map((a, i) => `
### ${i + 1}. ${a.candidateName}
- 岗位: ${a.jobTitle}
- 匹配度: ${a.matchScore}%
- Pipeline: ${a.pipelineStage}
- 优势: ${a.strengths.join('、') || '暂无'}
- 风险: ${a.risks.join('、') || '暂无'}
`).join('\n')}

请综合评价这些候选人，给出推荐联系顺序和理由（200字以内）。
直接输出文字，不要 JSON。`
  }

  private buildPipelineReviewPrompt(data: any, report: any): string {
    const pipelines = data?.pipelines || []
    return `你是 AI 招聘经理，负责审查 Pipeline。

## Pipeline 概况
- 总人数: ${pipelines.length}
- 瓶颈阶段: ${report?.bottleneck || 'unknown'}
- 建议: ${report?.recommendation || '暂无'}

## 各阶段分布
${Object.entries(report?.stageFlow || {}).map(([s, c]) => `- ${s}: ${c}人`).join('\n') || '暂无数据'}

## 超期候选人（>7天未推进）
${pipelines.filter((p: any) => {
    if (!p.lastActivityAt) return false
    const days = (Date.now() - new Date(p.lastActivityAt).getTime()) / 86400000
    return days > 7 && !['hired', 'rejected'].includes(p.stage)
  }).map((p: any) => `- ${p.candidateName}（${p.stage}）`).join('\n') || '暂无'}

请给出 Pipeline 优化建议（200字以内）。
直接输出文字，不要 JSON。`
  }

  private buildRiskAssessmentPrompt(data: any, report: any): string {
    const risks = report?.risks || []
    return `你是 AI 招聘经理，负责风险评估。

## 当前风险
${risks.map((r: any, i: any) => `${i + 1}. [${r.level}] ${r.content}`).join('\n') || '暂无风险'}

## 招聘数据
- 岗位: ${data?.jobs?.length || 0}
- Pipeline: ${data?.pipelines?.length || 0}
- 待审核: ${data?.reviews?.length || 0}

请评估风险等级并给出应对建议（200字以内）。
直接输出文字，不要 JSON。`
  }

  private buildActionPlanPrompt(data: any, actionResult: any): string {
    const actions = actionResult?.actions || []
    return `你是 AI 招聘经理，负责制定行动计划。

## 推荐行动（按优先级排序）
${actions.map((a: any, i: number) => `${i + 1}. [${a.priority}] ${a.action} → ${a.target}\n   原因: ${a.reason}`).join('\n') || '暂无建议'}

请制定一个行动计划，包括执行顺序和时间安排（200字以内）。
直接输出文字，不要 JSON。`
  }

  // ─── 辅助方法 ─────────────────────────────────────────

  private parseLLMSummary(output: string): string {
    // 清理 LLM 输出，提取纯文本摘要
    return output
      .replace(/```json\s*[\s\S]*?```/g, '')
      .replace(/```\s*[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*\}/g, '')
      .trim()
      .slice(0, 500)
  }

  private buildFindings(readResult: ToolResult, reportResult: ToolResult): WorkflowOutput['findings'] {
    const findings: WorkflowOutput['findings'] = []
    if (readResult.success && readResult.data) {
      const data = readResult.data
      if (data.jobs?.length > 0) {
        findings.push({
          type: 'info',
          content: `${data.jobs.length} 个岗位，${data.jobs.filter((j: any) => j.status === 'published' || j.status === 'active').length} 个活跃`,
          sources: ['JobPosting'],
        })
      }
      if (data.matches?.length > 0) {
        const high = data.matches.filter((m: any) => m.score >= 70).length
        findings.push({
          type: high > 0 ? 'opportunity' : 'info',
          content: `${data.matches.length} 名匹配候选人，${high} 名高匹配`,
          sources: ['CandidateMatch'],
        })
      }
    }
    return findings
  }

  /**
   * 记录 Workflow 执行到 Memory
   */
  private async recordWorkflowMemory(
    ctx: ToolContext,
    workflowType: string,
    output: WorkflowOutput,
    steps: WorkflowStep[],
  ): Promise<void> {
    try {
      await (this.prisma as any).agentMemory.create({
        data: {
          agentId: 'agent_camera',
          memoryType: 'workflow_execution',
          content: JSON.stringify({
            workflowType,
            executedAt: new Date().toISOString(),
            summary: output.summary,
            steps: steps.map(s => ({ action: s.action, result: s.result })),
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
    req: WorkflowRequest,
    hermesAgentId: string,
    memoryNamespace: string,
    steps: WorkflowStep[],
    toolsUsed: string[],
    totalTokens: number,
    startTime: number,
    error: string,
  ): WorkflowResult {
    return {
      workflowType: req.workflowType,
      status: 'failed',
      generatedAt: new Date().toISOString(),
      agentId: req.agentId,
      agentName: 'AI 招聘经理',
      tenantId: req.tenantId,
      hermesAgentId,
      memoryNamespace,
      steps,
      output: {
        summary: `Workflow 执行失败: ${error}`,
        findings: [],
        actions: [],
        tasks: [],
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

// WorkflowExecutor 通过工厂函数创建（需要运行时 Prisma + AgentExecutor）
export function createWorkflowExecutor(prisma: PrismaClient, executor: AgentExecutorImpl): WorkflowExecutor {
  return new WorkflowExecutor(prisma, executor)
}
