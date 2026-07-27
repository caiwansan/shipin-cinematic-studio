/**
 * Phase 3-E: Agent Orchestration Runtime
 * 
 * Agent 编排层 — Hermes 只是实现方式，不是产品能力。
 * 
 * 架构（KM-AI-JOB-AGENT-02 后）：
 *   企业招聘工作台
 *     → Agent Orchestrator
 *       → HermesAdapter（Agent Runtime 生命周期适配层）
 *         → Agent Brain（推理能力）
 *           → executeViaGateway（唯一 LLM 执行入口）
 *             → DeepSeek / 其他 Provider
 * 
 * 注意：HermesAdapter 不是 LLM Adapter，而是 Agent Runtime Adapter。
 * 它负责 Agent 实例管理 + 上下文注入，执行委托给 Agent Brain。
 */

import type { CareerFit } from '../canonical/schemas'
import type { KnowledgeContext, QueryIntent, TaskPlan } from '../runtime/knowledge-runtime'
import type { AgentRequest, AgentResponse } from '../agent/career-advisor-agent'
import { KnowledgeRuntime } from '../runtime/knowledge-runtime'
import { KnowledgeIntelligenceEngine } from '../engine/knowledge-engine'

// ═══════════════════════════════════════════════
// ① Agent Registry（Agent 注册表）
// ═══════════════════════════════════════════════

export type AgentType =
  | 'career_advisor'
  | 'resume_analyst'
  | 'job_search'
  | 'salary_analyst'
  | 'learning_advisor'
  | 'interview_coach'
  | 'company_researcher'

export type AgentStatus = 'available' | 'busy' | 'offline'

export interface AgentCapability {
  id: string
  name: string
  description: string
  type: AgentType
  inputSchema: CapabilityIO
  outputSchema: CapabilityIO
  permissions: string[]
  priority: number         // 0-100, 越高越优先
  status: AgentStatus
  metadata: {
    version: string
    author: string
    createdAt: number
  }
}

export interface CapabilityIO {
  type: 'object'
  properties: Record<string, { type: string; description: string }>
  required?: string[]
}

/**
 * Agent Registry — 注册所有 Agent 能力
 * 
 * Planner 自动从 Registry 选择合适的 Agent
 */
export class AgentRegistry {
  private agents = new Map<string, AgentCapability>()
  private handlers = new Map<string, AgentHandler>()

  /**
   * 注册 Agent
   */
  register(capability: AgentCapability, handler: AgentHandler): void {
    this.agents.set(capability.id, capability)
    this.handlers.set(capability.id, handler)
  }

  /**
   * 注销 Agent
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId)
    this.handlers.delete(agentId)
  }

  /**
   * 查找 Agent（按能力类型）
   */
  findByType(type: AgentType): AgentCapability[] {
    return Array.from(this.agents.values()).filter(a => a.type === type)
  }

  /**
   * 查找 Agent（按 ID）
   */
  getById(agentId: string): AgentCapability | null {
    return this.agents.get(agentId) || null
  }

  /**
   * 获取所有 Agent
   */
  getAll(): AgentCapability[] {
    return Array.from(this.agents.values())
  }

  /**
   * 获取 Handler
   */
  getHandler(agentId: string): AgentHandler | null {
    return this.handlers.get(agentId) || null
  }

  /**
   * 根据用户需求自动选择最佳 Agent
   */
  selectBest(intent: QueryIntent): AgentCapability | null {
    const candidates = this.getAvailableAgents()

    // 根据意图匹配最佳 Agent
    const intentAgentMap: Record<string, AgentType> = {
      career_recommendation: 'career_advisor',
      career_transition: 'career_advisor',
      skill_gap: 'learning_advisor',
      salary_query: 'salary_analary' as AgentType,
      career_detail: 'career_advisor',
      general_explain: 'career_advisor',
    }

    const targetType = intentAgentMap[intent.type] || 'career_advisor'
    const matched = candidates.filter(a => a.type === targetType)

    if (matched.length === 0) return null

    // 按优先级排序
    matched.sort((a, b) => b.priority - a.priority)
    return matched[0]
  }

  private getAvailableAgents(): AgentCapability[] {
    return Array.from(this.agents.values()).filter(a => a.status === 'available')
  }
}

// ─── Agent Handler 接口 ───

export interface AgentHandler {
  execute(input: AgentInput, context: AgentExecutionContext): Promise<AgentOutput>
}

export interface AgentInput {
  userMessage: string
  userId?: string
  skills?: string[]
  fit?: CareerFit | null
  intent?: QueryIntent
  memory?: unknown[]
  params?: Record<string, unknown>
}

export interface AgentExecutionContext {
  runtime: KnowledgeRuntime
  engine: KnowledgeIntelligenceEngine
  workflow?: WorkflowState
}

export interface AgentOutput {
  message: string
  data?: Record<string, unknown>
  evidence?: string[]
  confidence: number
  suggestedActions?: string[]
  nextAgent?: AgentType  // 下一个 Agent 类型
}

// ═══════════════════════════════════════════════
// ② Workflow Engine（工作流引擎）
// ═══════════════════════════════════════════════

export type WorkflowStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface WorkflowState {
  id: string
  name: string
  steps: WorkflowStep[]
  currentStep: number
  status: WorkflowStatus
  context: Record<string, unknown>
  results: WorkflowStepResult[]
}

export interface WorkflowStep {
  id: string
  agentType: AgentType
  input: Partial<AgentInput>
  dependsOn?: string[]
  retryCount?: number
  timeout?: number
}

export interface WorkflowStepResult {
  stepId: string
  agentId: string
  status: 'success' | 'failed' | 'skipped'
  output: AgentOutput | null
  error?: string
  durationMs: number
}

/**
 * Workflow Engine — 多 Agent 工作流
 * 
 * 例如：用户要换工作 → Resume → Career → Job Search → Salary → Summary
 */
export class WorkflowEngine {
  private workflows = new Map<string, WorkflowState>()

  /**
   * 创建工作流
   */
  create(name: string, steps: WorkflowStep[]): WorkflowState {
    const workflow: WorkflowState = {
      id: `wf_${Date.now().toString(36)}`,
      name,
      steps,
      currentStep: 0,
      status: 'pending',
      context: {},
      results: [],
    }
    this.workflows.set(workflow.id, workflow)
    return workflow
  }

  /**
   * 执行工作流
   */
  async execute(
    workflowId: string,
    registry: AgentRegistry,
    baseContext: AgentExecutionContext,
    baseInput: AgentInput,
  ): Promise<WorkflowState> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`)

    workflow.status = 'running'

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i]
      workflow.currentStep = i

      // 检查依赖
      if (step.dependsOn && !this.dependenciesMet(step.dependsOn, workflow.results)) {
        workflow.results.push({
          stepId: step.id,
          agentId: '',
          status: 'skipped',
          output: null,
          error: 'Dependencies not met',
          durationMs: 0,
        })
        continue
      }

      // 执行步骤
      const startTime = Date.now()
      try {
        const agent = registry.findByType(step.agentType)[0]
        if (!agent) throw new Error(`No agent found for type: ${step.agentType}`)

        const handler = registry.getHandler(agent.id)
        if (!handler) throw new Error(`No handler for agent: ${agent.id}`)

        const output = await handler.execute(
          { ...baseInput, ...step.input } as AgentInput,
          { ...baseContext, workflow },
        )

        workflow.results.push({
          stepId: step.id,
          agentId: agent.id,
          status: 'success',
          output,
          durationMs: Date.now() - startTime,
        })

        // 将输出存入上下文供后续步骤使用
        workflow.context[step.id] = output

      } catch (error) {
        workflow.results.push({
          stepId: step.id,
          agentId: '',
          status: 'failed',
          output: null,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        })

        // 如果步骤失败，可以选择继续或终止
        if (!step.dependsOn) {
          workflow.status = 'failed'
          return workflow
        }
      }
    }

    workflow.status = 'complete'
    return workflow
  }

  /**
   * 获取预定义工作流模板
   */
  getTemplate(name: string): WorkflowStep[] {
    switch (name) {
      case 'job_change':
        return [
          { id: 'step_1', agentType: 'resume_analyst', input: {} },
          { id: 'step_2', agentType: 'career_advisor', input: {}, dependsOn: ['step_1'] },
          { id: 'step_3', agentType: 'job_search', input: {}, dependsOn: ['step_2'] },
          { id: 'step_4', agentType: 'salary_analyst', input: {}, dependsOn: ['step_2'] },
          { id: 'step_5', agentType: 'learning_advisor', input: {}, dependsOn: ['step_2'] },
        ]

      case 'career_planning':
        return [
          { id: 'step_1', agentType: 'career_advisor', input: {} },
          { id: 'step_2', agentType: 'learning_advisor', input: {}, dependsOn: ['step_1'] },
        ]

      case 'interview_prep':
        return [
          { id: 'step_1', agentType: 'career_advisor', input: {} },
          { id: 'step_2', agentType: 'interview_coach', input: {}, dependsOn: ['step_1'] },
        ]

      default:
        return [
          { id: 'step_1', agentType: 'career_advisor', input: {} },
        ]
    }
  }

  private dependenciesMet(deps: string[], results: WorkflowStepResult[]): boolean {
    const completed = new Set(results.filter(r => r.status === 'success').map(r => r.stepId))
    return deps.every(d => completed.has(d))
  }
}

// ═══════════════════════════════════════════════
// ③ Capability Bus（能力总线）
// ═══════════════════════════════════════════════

export interface BusMessage {
  id: string
  from: string
  to: string
  type: 'request' | 'response' | 'event'
  payload: unknown
  timestamp: number
  correlationId?: string
}

export interface BusSubscriber {
  id: string
  filter: (message: BusMessage) => boolean
  handler: (message: BusMessage) => void
}

/**
 * Capability Bus — 统一能力总线
 * 
 * 所有 Agent 通过 Bus 通信，不直接耦合
 */
export class CapabilityBus {
  private subscribers = new Map<string, BusSubscriber>()
  private messageHistory: BusMessage[] = []

  /**
   * 订阅消息
   */
  subscribe(subscriber: BusSubscriber): void {
    this.subscribers.set(subscriber.id, subscriber)
  }

  /**
   * 取消订阅
   */
  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId)
  }

  /**
   * 发布消息
   */
  publish(message: BusMessage): void {
    this.messageHistory.push(message)

    for (const sub of this.subscribers.values()) {
      if (sub.filter(message)) {
        sub.handler(message)
      }
    }
  }

  /**
   * 请求-响应模式
   */
  async request(from: string, to: string, payload: unknown, timeout = 5000): Promise<BusMessage> {
    const correlationId = `corr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe()
        reject(new Error(`Bus request timeout: ${from} → ${to}`))
      }, timeout)

      const unsubscribe = () => this.unsubscribe(`temp_${correlationId}`)

      this.subscribe({
        id: `temp_${correlationId}`,
        filter: msg => msg.correlationId === correlationId && msg.type === 'response',
        handler: (msg) => {
          clearTimeout(timeoutId)
          unsubscribe()
          resolve(msg)
        },
      })

      this.publish({
        id: `msg_${Date.now().toString(36)}`,
        from,
        to,
        type: 'request',
        payload,
        timestamp: Date.now(),
        correlationId,
      })
    })
  }

  /**
   * 获取消息历史
   */
  getHistory(limit = 50): BusMessage[] {
    return this.messageHistory.slice(-limit)
  }
}

// ═══════════════════════════════════════════════
// ④ Multi-Agent Coordinator（多 Agent 协调器）
// ═══════════════════════════════════════════════

export interface CoordinationRequest {
  userMessage: string
  userId?: string
  skills?: string[]
  fit?: CareerFit | null
  intent: QueryIntent
  workflow?: string  // 可选的工作流模板名
}

export interface CoordinationResponse {
  message: string
  workflowId?: string
  steps: WorkflowStepResult[]
  evidence: string[]
  confidence: number
  suggestedActions: string[]
  metadata: {
    processingTimeMs: number
    agentsUsed: string[]
    cacheHit: boolean
  }
}

/**
 * Multi-Agent Coordinator — 多 Agent 协调器
 * 
 * 协调多个 Agent 完成复杂任务
 */
export class MultiAgentCoordinator {
  private registry: AgentRegistry
  private workflowEngine: WorkflowEngine
  private bus: CapabilityBus
  private runtime: KnowledgeRuntime
  private engine: KnowledgeIntelligenceEngine

  constructor(
    registry: AgentRegistry,
    workflowEngine: WorkflowEngine,
    bus: CapabilityBus,
    runtime: KnowledgeRuntime,
    engine: KnowledgeIntelligenceEngine,
  ) {
    this.registry = registry
    this.workflowEngine = workflowEngine
    this.bus = bus
    this.runtime = runtime
    this.engine = engine
  }

  /**
   * 处理用户请求（主入口）
   * 
   * 流程：请求 → 意图 → 工作流选择 → Agent 编排 → 汇总
   */
  async coordinate(request: CoordinationRequest): Promise<CoordinationResponse> {
    const startTime = Date.now()
    const agentsUsed: string[] = []
    const evidence: string[] = []

    // 1. 选择工作流
    const workflowSteps = request.workflow
      ? this.workflowEngine.getTemplate(request.workflow)
      : this.selectWorkflow(request.intent)

    // 2. 创建工作流
    const workflow = this.workflowEngine.create(
      `coordination_${Date.now()}`,
      workflowSteps,
    )

    // 3. 执行工作流
    const context: AgentExecutionContext = {
      runtime: this.runtime,
      engine: this.engine,
    }

    const input: AgentInput = {
      userMessage: request.userMessage,
      userId: request.userId,
      skills: request.skills,
      fit: request.fit,
      intent: request.intent,
    }

    const result = await this.workflowEngine.execute(
      workflow.id,
      this.registry,
      context,
      input,
    )

    // 4. 汇总结果
    for (const stepResult of result.results) {
      if (stepResult.status === 'success' && stepResult.output) {
        agentsUsed.push(stepResult.agentId)
        evidence.push(...stepResult.output.evidence || [])
      }
    }

    // 5. 构建最终回复
    const finalOutput = this.aggregateResults(result.results)

    return {
      message: finalOutput.message,
      workflowId: workflow.id,
      steps: result.results,
      evidence,
      confidence: finalOutput.confidence,
      suggestedActions: finalOutput.suggestedActions || [],
      metadata: {
        processingTimeMs: Date.now() - startTime,
        agentsUsed,
        cacheHit: false,
      },
    }
  }

  /**
   * 获取可用 Agent 列表
   */
  getAvailableAgents(): AgentCapability[] {
    return this.registry.getAll()
  }

  private selectWorkflow(intent: QueryIntent): WorkflowStep[] {
    switch (intent.type) {
      case 'career_recommendation':
        return this.workflowEngine.getTemplate('career_planning')
      case 'career_transition':
        return this.workflowEngine.getTemplate('job_change')
      default:
        return this.workflowEngine.getTemplate('default')
    }
  }

  private aggregateResults(results: WorkflowStepResult[]): AgentOutput {
    // 合并所有成功步骤的输出
    const successful = results.filter(r => r.status === 'success' && r.output)
    
    if (successful.length === 0) {
      return {
        message: '暂无分析结果，请稍后重试。',
        confidence: 0,
      }
    }

    // 取最后一个成功步骤的输出作为主回复
    const lastOutput = successful[successful.length - 1].output!

    // 合并所有证据
    const allEvidence: string[] = []
    for (const r of successful) {
      if (r.output?.evidence) {
        allEvidence.push(...r.output.evidence)
      }
    }

    return {
      ...lastOutput,
      evidence: allEvidence,
    }
  }
}

// ═══════════════════════════════════════════════
// ⑤ Hermes Adapter（Agent Runtime 生命周期适配层）
// ═══════════════════════════════════════════════

/**
 * Agent 执行 Handler — 由上层注入，避免反向依赖
 * 
 * KM-AI-JOB-AGENT-02: HermesAdapter 不再直接调用 LLM，
 * 而是委托给 Agent Brain（通过此接口）。
 */
export interface AgentExecutor {
  /**
   * 执行 Agent 任务
   * @param agentId Agent Profile ID
   * @param message 用户消息
   * @param context 执行上下文（organizationId, actorId 等）
   */
  execute(
    agentId: string,
    message: string,
    context: {
      organizationId: string
      actorId: string
      permissionScope: string[]
    }
  ): Promise<{
    output: string
    tokensUsed: number
    provider: string
    model: string
    durationMs: number
  }>

  /**
   * 根据 agentType 解析对应的 Agent Profile ID
   */
  resolveAgentId(agentType: string, organizationId: string): Promise<string | null>
}

export interface AgentAdapter {
  name: string
  version: string
  spawn(config: AgentSpawnConfig): Promise<AgentInstance>
  terminate(instanceId: string): Promise<void>
  send(instanceId: string, message: unknown): Promise<AgentOutput>
  getStatus(instanceId: string): Promise<AgentStatus>
}

export interface AgentSpawnConfig {
  agentType: AgentType
  input: AgentInput
  timeout?: number
  retries?: number
}

export interface AgentInstance {
  id: string
  type: AgentType
  status: AgentStatus
  createdAt: number

  // KM-AI-JOB-AGENT-02: 新增运行时上下文
  agentProfileId?: string  // 对应的 Agent Profile ID
  organizationId?: string  // 所属组织
  runtime?: 'openclaw'    // 当前真实运行时
}

/**
 * HermesAdapter — Agent Runtime 生命周期适配层
 * 
 * 职责（KM-AI-JOB-AGENT-02 重新定义）：
 *   1. Agent 实例管理（spawn/terminate）
 *   2. Runtime 状态追踪
 *   3. 上下文注入（workspace/tenant/role）
 *   4. 委托 Agent Brain 执行推理（不直接调 LLM）
 * 
 * 架构：
 *   HermesAdapter → AgentExecutor → AgentBrain → executeViaGateway → LLM
 */
export class HermesAdapter implements AgentAdapter {
  name = 'Hermes'
  version = '2.0.0'  // KM-AI-JOB-AGENT-02: 升级到 2.0（从 mock 到真实执行）
  private instances = new Map<string, AgentInstance>()

  // KM-AI-JOB-AGENT-02: 注入 Agent Executor（Agent Brain 的薄包装）
  private executor: AgentExecutor | null = null

  /**
   * 注入 Agent Executor
   * 必须在首次 send() 前调用
   */
  setExecutor(executor: AgentExecutor): void {
    this.executor = executor
  }

  async spawn(config: AgentSpawnConfig): Promise<AgentInstance> {
    const instance: AgentInstance = {
      id: `agent_${Date.now().toString(36)}`,
      type: config.agentType,
      status: 'available',
      createdAt: Date.now(),
      runtime: 'openclaw',  // KM-AI-JOB-AGENT-02: 承认现实，不使用不存在的 hermes runtime
    }
    this.instances.set(instance.id, instance)
    return instance
  }

  async terminate(instanceId: string): Promise<void> {
    this.instances.delete(instanceId)
  }

  async send(
    instanceId: string,
    message: unknown,
    sendOptions?: {
      userId?: string       // 真实登录用户 ID（优先级 1）
      workspaceId?: string  // 工作空间 ID（优先级 3）
    },
  ): Promise<AgentOutput> {
    // KM-AI-JOB-AGENT-02: 不再 mock，委托 Agent Brain 执行
    if (!this.executor) {
      return {
        message: '[HermesAdapter] 错误：未注入 Agent Executor。请先调用 setExecutor()。',
        confidence: 0,
      }
    }

    const instance = this.instances.get(instanceId)
    if (!instance) {
      return {
        message: `[HermesAdapter] 错误：实例 ${instanceId} 不存在`,
        confidence: 0,
      }
    }

    try {
      // 解析 Agent Profile ID
      const agentId = await this.executor.resolveAgentId(
        instance.type,
        instance.organizationId || '',
      )

      if (!agentId) {
        return {
          message: `[HermesAdapter] 错误：未找到类型 ${instance.type} 对应的 Agent Profile`,
          confidence: 0,
        }
      }

      // KM-AI-JOB-AGENT-02 Identity: 传递真实用户上下文给 AgentExecutor
      // AgentExecutor.resolveExecutionIdentity() 按优先级解析执行身份
      const result = await this.executor.execute(
        agentId,
        typeof message === 'string' ? message : JSON.stringify(message),
        {
          organizationId: instance.organizationId || '',
          actorId: 'system:hermes-adapter',  // 标记为系统触发
          permissionScope: ['agent:execute', 'agent:read'],
          userId: sendOptions?.userId,        // 真实登录用户（优先级 1）
          workspaceId: sendOptions?.workspaceId, // 工作空间（优先级 3）
        },
      )

      return {
        message: result.output,
        confidence: 0.8,  // 真实执行结果
        evidence: [
          `provider: ${result.provider}`,
          `model: ${result.model}`,
          `tokens: ${result.tokensUsed}`,
          `duration: ${result.durationMs}ms`,
          ...(result.identity ? [
            `identity.actorType: ${result.identity.actorType}`,
            `identity.ownerUserId: ${result.identity.ownerUserId}`,
            `identity.resolvedBy: ${result.identity.resolvedBy}`,
          ] : []),
        ],
      }
    } catch (error: any) {
      return {
        message: `[HermesAdapter] 执行失败: ${error.message}`,
        confidence: 0,
      }
    }
  }

  async getStatus(instanceId: string): Promise<AgentStatus> {
    const instance = this.instances.get(instanceId)
    return instance?.status || 'offline'
  }
}

// ═══════════════════════════════════════════════
// ★ Agent Orchestration Runtime — 统一入口
// ═══════════════════════════════════════════════

export interface OrchestrationConfig {
  runtime: KnowledgeRuntime
  engine: KnowledgeIntelligenceEngine
  adapter?: AgentAdapter
}

/**
 * Agent Orchestration Runtime
 * 
 * 所有 Agent 的统一编排入口
 */
export class AgentOrchestrationRuntime {
  readonly registry: AgentRegistry
  readonly workflowEngine: WorkflowEngine
  readonly bus: CapabilityBus
  readonly coordinator: MultiAgentCoordinator
  readonly adapter: AgentAdapter

  constructor(config: OrchestrationConfig) {
    this.registry = new AgentRegistry()
    this.workflowEngine = new WorkflowEngine()
    this.bus = new CapabilityBus()
    this.coordinator = new MultiAgentCoordinator(
      this.registry,
      this.workflowEngine,
      this.bus,
      config.runtime,
      config.engine,
    )
    this.adapter = config.adapter || new HermesAdapter()
  }

  /**
   * 注册 Agent
   */
  registerAgent(capability: AgentCapability, handler: AgentHandler): void {
    this.registry.register(capability, handler)
  }

  /**
   * 处理用户请求（主入口）
   */
  async process(request: CoordinationRequest): Promise<CoordinationResponse> {
    return this.coordinator.coordinate(request)
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    return {
      agents: this.registry.getAll(),
      busHistory: this.bus.getHistory(10),
      adapter: this.adapter.name,
    }
  }
}
