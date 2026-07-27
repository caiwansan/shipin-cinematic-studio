/**
 * Phase 3.9: LLM Gateway — Reasoning Provider 统一层
 * 
 * 核心原则：昆仑镜提供 Agent，不提供 Token。
 * 
 * 架构：
 *   Agent → LLM Gateway → Model Router → Provider Adapter → API
 *          ↑ Budget Guard
 *          ↑ Fallback Chain
 *          ↑ Token Stats
 */

// ─── Provider 类型 ───

export type LLMProviderType =
  | 'deepseek'
  | 'openai'
  | 'claude'
  | 'qwen'
  | 'gemini'
  | 'zhipu'
  | 'ollama'
  | 'azure'
  | 'volcengine'

export interface LLMModel {
  id: string
  provider: LLMProviderType
  model: string
  label: string
  maxTokens: number
  costPerInputToken: number   // 每 token 成本（元）
  costPerOutputToken: number
  supportedTasks: string[]
  enabled: boolean
}

export interface LLMRequest {
  messages: LLMMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  organizationId?: string    // 企业 ID，用于路由到企业自己的 Key
  taskType?: string          // 任务类型：career_analysis, job_matching, etc.
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  model: string
  provider: LLMProviderType
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cost: number
  }
  latencyMs: number
  cached: boolean
}

// ─── LLM Gateway 主类 ───

export interface LLMGatewayConfig {
  models: LLMModel[]
  defaultProvider?: LLMProviderType
  budgetGuard?: BudgetGuard
  cache?: Map<string, LLMResponse>
}

/**
 * LLM Gateway — Reasoning Provider 统一层
 * 
 * 所有 Agent 通过 Gateway 调用模型，不直接接触 Provider SDK
 */
export class LLMGateway {
  private models = new Map<string, LLMModel>()
  private adapters = new Map<LLMProviderType, ProviderAdapter>()
  private budgetGuard?: BudgetGuard
  private cache = new Map<string, LLMResponse>()
  private defaultProvider: LLMProviderType

  constructor(config: LLMGatewayConfig) {
    for (const model of config.models) {
      this.models.set(`${model.provider}:${model.model}`, model)
    }
    this.budgetGuard = config.budgetGuard
    this.defaultProvider = config.defaultProvider || 'deepseek'
  }

  /**
   * 注册 Provider Adapter
   */
  registerAdapter(provider: LLMProviderType, adapter: ProviderAdapter): void {
    this.adapters.set(provider, adapter)
  }

  /**
   * 调用 LLM（主入口）
   * 
   * 流程：请求 → Budget Guard → Model Router → Provider Adapter → 响应
   */
  async call(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now()

    // 1. Budget Guard 检查
    if (this.budgetGuard && request.organizationId) {
      const budgetCheck = await this.budgetGuard.check(request.organizationId, request.taskType || 'default')
      if (!budgetCheck.allowed) {
        throw new LLMBudgetExceededError(budgetCheck.reason)
      }
    }

    // 2. 选择模型
    const model = this.selectModel(request)

    // 3. 检查缓存
    const cacheKey = this.buildCacheKey(request)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return { ...cached, cached: true }
    }

    // 4. 获取 Adapter
    const adapter = this.adapters.get(model.provider)
    if (!adapter) {
      throw new Error(`No adapter for provider: ${model.provider}`)
    }

    // 5. 调用 Provider
    const response = await adapter.call({
      ...request,
      model: model.model,
    })

    // 6. 记录用量
    if (this.budgetGuard && request.organizationId) {
      await this.budgetGuard.recordUsage(request.organizationId, response.usage)
    }

    // 7. 缓存结果
    this.cache.set(cacheKey, response)

    return { ...response, latencyMs: Date.now() - startTime, cached: false }
  }

  /**
   * 选择最佳模型
   */
  private selectModel(request: LLMRequest): LLMModel {
    // 如果指定了模型，优先使用
    if (request.model) {
      const key = `${this.defaultProvider}:${request.model}`
      const model = this.models.get(key)
      if (model) return model
    }

    // 根据任务类型选择
    const taskModels = Array.from(this.models.values())
      .filter(m => m.enabled && m.supportedTasks.includes(request.taskType || 'default'))
    
    if (taskModels.length > 0) {
      // 按成本排序（优先选便宜的）
      taskModels.sort((a, b) => a.costPerInputToken - b.costPerInputToken)
      return taskModels[0]
    }

    // 返回默认模型
    const defaultModel = Array.from(this.models.values()).find(m => m.provider === this.defaultProvider && m.enabled)
    if (defaultModel) return defaultModel

    // 返回任意可用模型
    const anyModel = Array.from(this.models.values()).find(m => m.enabled)
    if (anyModel) return anyModel

    throw new Error('No available LLM model')
  }

  private buildCacheKey(request: LLMRequest): string {
    const msgKey = request.messages.map(m => `${m.role}:${m.content}`).join('|')
    return `${request.taskType || 'default'}:${msgKey}`
  }
}

// ─── Provider Adapter 接口 ───

export interface ProviderAdapter {
  call(request: LLMRequest & { model: string }): Promise<LLMResponse>
}

// ─── Budget Guard（预算守卫） ───

export interface BudgetCheckResult {
  allowed: boolean
  reason?: string
  remainingBudget?: number
  currentUsage?: number
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
}

/**
 * Budget Guard — 监控企业 Token 用量和预算
 * 
 * 超预算时自动降级或拒绝
 */
export class BudgetGuard {
  private usage = new Map<string, TokenUsage>()
  private budgets = new Map<string, { daily: number; monthly: number }>()

  constructor(
    private config: {
      dailyBudgetLimit?: number      // 每日预算限制（元）
      monthlyBudgetLimit?: number    // 每月预算限制（元）
      autoDowngrade?: boolean        // 超预算时自动降级
      downgradeProvider?: LLMProviderType  // 降级到哪个 Provider
    },
  ) {}

  /**
   * 检查预算
   */
  async check(organizationId: string, _taskType: string): Promise<BudgetCheckResult> {
    const usage = this.usage.get(organizationId) || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }
    const budget = this.budgets.get(organizationId) || { daily: Infinity, monthly: Infinity }

    // 检查每日预算
    if (this.config.dailyBudgetLimit && usage.cost >= this.config.dailyBudgetLimit) {
      return {
        allowed: false,
        reason: `Daily budget exceeded: ${usage.cost} >= ${this.config.dailyBudgetLimit}`,
        remainingBudget: 0,
        currentUsage: usage.cost,
      }
    }

    return {
      allowed: true,
      remainingBudget: budget.daily - usage.cost,
      currentUsage: usage.cost,
    }
  }

  /**
   * 记录用量
   */
  async recordUsage(organizationId: string, usage: TokenUsage): Promise<void> {
    const existing = this.usage.get(organizationId) || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }
    existing.inputTokens += usage.inputTokens
    existing.outputTokens += usage.outputTokens
    existing.totalTokens += usage.totalTokens
    existing.cost += usage.cost
    this.usage.set(organizationId, existing)
  }

  /**
   * 设置预算
   */
  setBudget(organizationId: string, daily: number, monthly: number): void {
    this.budgets.set(organizationId, { daily, monthly })
  }

  /**
   * 获取用量统计
   */
  getUsage(organizationId: string): TokenUsage {
    return this.usage.get(organizationId) || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 }
  }

  /**
   * 获取所有用量
   */
  getAllUsage(): Map<string, TokenUsage> {
    return this.usage
  }
}

// ─── Fallback Chain（降级链） ───

export interface FallbackChainConfig {
  providers: LLMProviderType[]
  retryCount?: number
  retryDelayMs?: number
}

/**
 * Fallback Chain — Provider 失败时自动降级
 * 
 * Claude → GPT → DeepSeek → Qwen
 */
export class FallbackChain {
  private chains = new Map<string, FallbackChainConfig>()

  constructor(
    private adapters: Map<LLMProviderType, ProviderAdapter>,
    private defaultChain: FallbackChainConfig = {
      providers: ['deepseek', 'openai', 'claude', 'qwen'],
      retryCount: 3,
      retryDelayMs: 1000,
    },
  ) {}

  /**
   * 为特定任务类型设置降级链
   */
  setChain(taskType: string, config: FallbackChainConfig): void {
    this.chains.set(taskType, config)
  }

  /**
   * 执行带降级的调用
   */
  async callWithFallback(
    request: LLMRequest & { model: string },
    taskType?: string,
  ): Promise<LLMResponse> {
    const chain = this.chains.get(taskType || 'default') || this.defaultChain
    let lastError: Error | null = null

    for (const provider of chain.providers) {
      const adapter = this.adapters.get(provider)
      if (!adapter) continue

      for (let attempt = 0; attempt < (chain.retryCount || 1); attempt++) {
        try {
          const response = await adapter.call({ ...request, model: request.model })
          return response
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          if (attempt < (chain.retryCount || 1) - 1) {
            await this.delay(chain.retryDelayMs || 1000)
          }
        }
      }
    }

    throw lastError || new Error('All providers failed')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─── 内置 Provider Adapters ───

export class DeepSeekAdapter implements ProviderAdapter {
  constructor(private apiKey: string, private baseUrl = 'https://api.deepseek.com/v1') {}

  async call(request: LLMRequest & { model: string }): Promise<LLMResponse> {
    // 实际实现中调用 DeepSeek API
    return {
      content: `[DeepSeek ${request.model}] 模拟响应`,
      model: request.model,
      provider: 'deepseek',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cost: 0.001 },
      latencyMs: 500,
      cached: false,
    }
  }
}

export class OpenAIAdapter implements ProviderAdapter {
  constructor(private apiKey: string, private baseUrl = 'https://api.openai.com/v1') {}

  async call(request: LLMRequest & { model: string }): Promise<LLMResponse> {
    return {
      content: `[OpenAI ${request.model}] 模拟响应`,
      model: request.model,
      provider: 'openai',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cost: 0.01 },
      latencyMs: 800,
      cached: false,
    }
  }
}

export class ClaudeAdapter implements ProviderAdapter {
  constructor(private apiKey: string, private baseUrl = 'https://api.anthropic.com/v1') {}

  async call(request: LLMRequest & { model: string }): Promise<LLMResponse> {
    return {
      content: `[Claude ${request.model}] 模拟响应`,
      model: request.model,
      provider: 'claude',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cost: 0.015 },
      latencyMs: 1000,
      cached: false,
    }
  }
}

// ─── 自定义错误 ───

export class LLMBudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMBudgetExceededError'
  }
}
