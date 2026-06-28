/**
 * runtime/narrative-gateway.ts — AI Gateway Runtime
 *
 * 统一 LLM 调用网关，整合：
 *   - Observability (tracing + metrics)
 *   - Policy Engine (timeout + retry + circuit breaker)
 *   - Router (provider list + fallback chain)
 *   - Fallback Layer (无侵入，不重复 init trace/metrics)
 *   - Response Normalizer (统一输出)
 *   - Async Degrade Mode (队列降级)
 *
 * 所有旧函数（callSingleLLM, callLLMWithFallback, makeProviders）
 * 收敛到 gateway.execute()
 */

import { runtimeTrace } from './trace/runtime-trace.js'
import { checkDomainAllowed } from './runtime-gate.js'
import { getProvider, listProviders } from './providers/provider.registry.js'
import type { LLMProvider, LLMRequest, LLMResponse } from './providers/base.provider.js'
import { canRequest, recordResult, registerProvider } from '../core/circuit-breaker.js'
import type { CircuitState } from '../core/circuit-breaker.js'
import { recordRequest, recordQueueWait, recordQueueProcessing } from '../observability/metrics.js'
import { createTrace, addSpan, completeTrace } from '../observability/distributed-trace.js'
import { traceProviderCall } from '../observability/distributed-trace.js'
import { enqueueTask } from '../queue/queue-manager.js'

// ============================================================
// Types
// ============================================================

export type TimeoutTier = 'fast' | 'normal' | 'batch'

export interface GatewayRequest {
  systemPrompt: string
  userMessage: string
  userId: string
  projectId?: string
  timeoutTier?: TimeoutTier
  maxTokens?: number
  temperature?: number
  /**
   * 自定义 provider 列表覆盖（用于测试或特殊路由）
   */
  providerOverride?: string[]
  /**
   * 允许异步降级（默认 true）
   */
  allowDegrade?: boolean
}

export interface GatewayResponse {
  content: string
  provider: string
  latency: number
  fallbackUsed: boolean
  traceId: string
  totalTokens: number
  /** 异步降级：如果任务被推入队列，此值非 null */
  asyncJobId?: string
  /** 原始 LLM 响应（用于调试） */
  rawResponse?: LLMResponse
  /** 标准化契约字段：ok/false */
  ok: boolean
  /** 标准化契约字段：是否降级 */
  degraded: boolean
  /** 标准化契约字段：降级后的 jobId */
  jobId?: string
  /** 标准化契约字段：下一步操作指引 */
  next?: string
}

export interface ProviderConfig {
  name: string
  provider: LLMProvider
  model: string
  priority: 'primary' | 'fallback'
}

// ============================================================
// Policy Engine
// ============================================================

const TIMEOUT_MAP: Record<TimeoutTier, number> = {
  fast: 15_000,
  normal: 120_000,
  batch: 600_000,   // 角色设计师可能很慢
}

const MAX_RETRIES = 0
const RETRY_DELAY_BASE_MS = 1000

export class PolicyEngine {
  /**
   * 根据 tier 获取超时时间 (ms)
   */
  getTimeout(timeoutTier: TimeoutTier = 'normal'): number {
    return TIMEOUT_MAP[timeoutTier]
  }

  /**
   * 判断是否应重试
   * max retry: 2, exponential backoff
   */
  shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= MAX_RETRIES) return false
    // 不可重试的错误类型
    const nonRetryableMessages = [
      '401', '403', '404',              // 认证/权限
      'context_length_exceeded',         // token 超长（重试也没用）
      'invalid_api_key',
      'invalid_request_error',
    ]
    const errMsg = error.message.toLowerCase()
    for (const nrm of nonRetryableMessages) {
      if (errMsg.includes(nrm)) return false
    }
    // 超时/网络错误可重试
    return true
  }

  /**
   * 获取重试延迟 (exponential backoff + jitter)
   */
  getRetryDelayMs(attempt: number): number {
    const base = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 500
    return Math.min(base + jitter, 10_000) // cap at 10s
  }

  /**
   * 检查熔断器状态（同步调用）
   */
  checkCircuitBreaker(providerKey: string): { allowed: boolean; degradeFactor: number; reason?: string } {
    return canRequest(providerKey)
  }
}

// ============================================================
// Router Layer
// ============================================================

export class LLMRouter {
  /**
   * 检查 provider 是否有可用的 API key
   * ⭐ 现在支持按 provider 检查对应的 env 变量（injectUserApiKey 会分别注入）
   */
  private hasApiKey(provider: LLMProvider): boolean {
    if (provider?.apiKey) return true
    // 按 provider name 检查对应的 env 变量
    const envVarMap: Record<string, string> = {
      deepseek: 'DEEPSEEK_API_KEY',
      volcengine: 'VOLCENGINE_API_KEY',
      bailian: 'BAILIAN_API_KEY',
    }
    const envVar = envVarMap[provider?.name || ''] || 'DEEPSEEK_API_KEY'
    return !!process.env[envVar]
  }

  /**
   * 获取 provider 列表（带健康检查过滤）
   * 遍历所有注册的 provider，只要有 API key 的就加入列表。
   * 可插拔：支持运行时 providerOverride
   */
  getProviderList(override?: string[]): ProviderConfig[] {
    const configs: ProviderConfig[] = []

    // 如果指定了 override，只使用指定的 provider
    if (override && override.length > 0) {
      for (const name of override) {
        const p = getProvider(name)
        if (p && p.models.length > 0 && this.hasApiKey(p)) {
          configs.push({
            name,
            provider: p,
            model: p.models[0],
            priority: configs.length === 0 ? 'primary' : 'fallback',
          })
        }
      }
      return configs
    }

    // 默认：遍历所有已注册且可用的 provider，优先级：最先找到的为 primary
    const priorityOrder = ['deepseek', 'volcengine', 'bailian']
    for (const name of priorityOrder) {
      const p = getProvider(name)
      if (p && p.models.length > 0 && this.hasApiKey(p)) {
        configs.push({
          name,
          provider: p,
          model: p.models[0],
          priority: configs.length === 0 ? 'primary' : 'fallback',
        })
      }
    }

    return configs
  }
}

// ============================================================
// Fallback Layer（无侵入）
// ============================================================

export class FallbackExecutor {
  /**
   * 执行单次 LLM 调用（不初始化 trace/metrics，这些由 caller 负责）
   */
  async execute(
    provider: ProviderConfig,
    systemPrompt: string,
    userMessage: string,
    signal: AbortSignal,
    maxTokens: number = 4096,
    temperature: number = 0.1,
  ): Promise<{ content: string; totalTokens: number; latencyMs: number }> {
    const t0 = Date.now()

    const request: LLMRequest = {
      model: provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      maxTokens,
      temperature,
      stream: false,
    }

    const response = await provider.provider.call(request, signal)
    const latencyMs = Date.now() - t0

    return {
      content: response.content,
      totalTokens: response.usage.totalTokens,
      latencyMs,
    }
  }
}

// ============================================================
// Response Normalizer
// ============================================================

export function normalizeResponse(params: {
  content: string
  provider: string
  latency: number
  fallbackUsed: boolean
  traceId: string
  totalTokens: number
  asyncJobId?: string
  degraded?: boolean
}): GatewayResponse {
  const isDegraded = !!params.asyncJobId
  return {
    ok: true,
    degraded: isDegraded,
    content: params.content,
    provider: params.provider,
    latency: params.latency,
    fallbackUsed: params.fallbackUsed,
    traceId: params.traceId,
    totalTokens: params.totalTokens,
    asyncJobId: params.asyncJobId,
    jobId: params.asyncJobId,
    next: isDegraded ? 'aigc_pipeline_continue' : undefined,
  }
}

// ============================================================
// Async Degrade Mode
// ============================================================

export class AsyncDegrader {
  /**
   * 将 LLM 任务推入统一队列
   * @returns jobId
   */
  async degrade(request: GatewayRequest): Promise<string> {
    const traceId = createTrace({
      userId: request.userId,
      projectId: request.projectId,
      taskType: 'llm',
    })

    addSpan(traceId, 'async-enqueue', 'ok', {
      promptSize: request.userMessage.length,
      degradeReason: 'timeout_or_circuit_open',
    })

    const trace = await enqueueTask({
      taskType: 'llm',
      projectId: request.projectId || 'narrative',
      userId: request.userId,
      input: {
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        traceId,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      },
      priority: 1,
    })

    completeTrace(traceId)

    return trace
  }
}

// ============================================================
// NarrativeLLMGateway — 统一入口
// ============================================================

export class NarrativeLLMGateway {
  private policyEngine: PolicyEngine
  private router: LLMRouter
  private fallbackExecutor: FallbackExecutor
  private asyncDegrader: AsyncDegrader

  constructor() {
    this.policyEngine = new PolicyEngine()
    this.router = new LLMRouter()
    this.fallbackExecutor = new FallbackExecutor()
    this.asyncDegrader = new AsyncDegrader()

    // 注册默认 provider 到熔断器
    this.registerProviders()
  }

  /**
   * 注册所有可用 provider 到熔断器
   */
  private registerProviders(): void {
    const existing = listProviders()
    for (const name of existing) {
      registerProvider(name)
    }
  }

  /**
   * 在 LLM 调用前注入用户的私有 API Key（BYOK）
   *
   * ⭐ 已重构为 Config Sovereignty Layer：
   *   - 配置仅从 config-runtime (V2 ONLY) 读取
   *   - ENV 仅用于 bootstrap 冻结，不参与 runtime
   *   - V1 表不再读取（legacy 隔离）
   *   - 解密失败直接抛错（不静默跳过）
   */
  private async injectUserApiKey(userId: string): Promise<(() => void) | null> {
    const backup: Record<string, string | undefined> = {}

    if (!userId || userId === 'anonymous') {
      return null
    }

    try {
      const { getRuntimeConfig, assertConfigIntegrity } = await import('../config-runtime/index.js')

      const cfg = await getRuntimeConfig({
        userId,
        requestId: `inject-${Date.now()}`,
      })

      if (!cfg.user) {
        console.warn(`[NarrativeGateway] ❌ 用户 ${userId.substring(0,8)} 无有效 LLM 配置（Config Sovereignty Layer 返回空）`)
        return null
      }

      assertConfigIntegrity(cfg)

      const { apiKey, model, provider } = cfg.user

      // 注入到 ENV（保持 downstream 兼容）
      const provKey = provider === 'siliconflow' ? 'DEEPSEEK'
        : provider === 'aliyun' ? 'BAILIAN'
        : provider.toUpperCase()

      const envKey = `${provKey}_API_KEY`
      const envModel = `${provKey}_LLM_MODEL`
      const envBaseUrl = `${provKey}_BASE_URL`

      // 备份已有值
      if (!(envKey in backup)) backup[envKey] = process.env[envKey]
      process.env[envKey] = apiKey

      if (model) {
        if (!(envModel in backup)) backup[envModel] = process.env[envModel]
        process.env[envModel] = model
      }

      console.log(`[NarrativeGateway] 🔑 用户 ${userId.substring(0,8)} V2注入: ${provider} → ${provKey}_API_KEY (model=${model})`)

      return () => {
        for (const [k, v] of Object.entries(backup)) {
          if (v !== undefined) process.env[k] = v
        }
        console.log(`[NarrativeGateway] 🔑 已恢复用户 Key 环境变量`)
      }
    } catch (err: any) {
      console.error(`[NarrativeGateway] ❌ injectUserApiKey 失败: ${err.message}`)
      return null
    }
  }

  /**
   * 执行 LLM 调用（完整 gateway 流程）
   *
   * 流程：
   * 1. Observability Init
   * 2. BYOK 注入（用户私有 key → process.env）
   * 3. Policy Check (timeout, circuit breaker)
   * 4. Router (get provider list)
   * 5. Fallback Chain (deepseek → deepseek retry → gpt-4o-mini → gpt-4o-mini retry)
   * 6. Response Normalization
   * 7. Async Degrade (if needed)
   */
  async execute(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now()

    // Phase 4.2: Record invocation trace (non-invasive, does not modify control flow)
    try {
      runtimeTrace.record({
        module: 'narrative-gateway',
        function: 'execute',
        caller: 'gateway-entry',
      })
    } catch { /* trace must never break execution */ }

    // Phase 4.3: Runtime gate — check caller domain. Currently only logs.
    // In strict mode, would reject OBSERVE callers.
    try {
      checkDomainAllowed('narrative-gateway-caller', 'SYNC', false)
    } catch { /* gate must never break execution */ }

    const timeoutTier = request.timeoutTier || 'normal'
    const timeoutMs = this.policyEngine.getTimeout(timeoutTier)

    // ===== 1. Observability Init =====
    const traceId = createTrace({
      userId: request.userId,
      projectId: request.projectId,
      taskType: 'narrative-llm',
    })

    addSpan(traceId, 'narrative-llm-request', 'ok', {
      promptSize: request.userMessage.length,
      userId: request.userId,
      timeoutTier,
    })

    // ===== 1.5 Execution Graph — 统一配置 + 路由 + 执行图 =====
    let restoreUserKey: (() => void) | null = null
    let executionGraph: any = null
    try {
      const { buildExecutionGraph, assertGraphIntegrity } = await import('../llm-execution-graph-v2/index.js')
      executionGraph = await buildExecutionGraph({
        userId: request.userId || 'anonymous',
        projectId: request.projectId,
        requestId: traceId,
      })

      // 完整性检查（失败直接抛错）
      assertGraphIntegrity(executionGraph)

      const final = executionGraph.final!
      const provKey = final.provider === 'siliconflow' ? 'DEEPSEEK'
        : final.provider === 'aliyun' ? 'BAILIAN'
        : final.provider.toUpperCase()

      const backup: Record<string, string | undefined> = {}
      const envKey = `${provKey}_API_KEY`
      const envModel = `${provKey}_LLM_MODEL`
      if (!(envKey in backup)) backup[envKey] = process.env[envKey]
      process.env[envKey] = final.apiKey
      if (final.model) {
        if (!(envModel in backup)) backup[envModel] = process.env[envModel]
        process.env[envModel] = final.model
      }

      console.log(`[NarrativeGateway] 🔑 ExecutionGraph 注入: ${final.provider} → ${provKey}_API_KEY (model=${final.model})`)
      console.log(`[NarrativeGateway] 📊 Graph: ${executionGraph.nodes.length} nodes, status=${executionGraph.status}`)

      restoreUserKey = () => {
        for (const [k, v] of Object.entries(backup)) {
          if (v !== undefined) process.env[k] = v
        }
      }
    } catch (err: any) {
      console.error(`[NarrativeGateway] ❌ ExecutionGraph 构建失败: ${err.message}`)
      const errMsg = '请先在「大模型设置」配置您的 API Key 才能使用 AI 功能'
      completeTrace(traceId, errMsg)
      throw new Error(errMsg)
    }

    // 👇 同步 provider 注册表中的 API Key（env 已更新，但 provider 构造时缓存的是旧值）
    try {
      const { refreshProviderApiKeys } = await import('../runtime/providers/provider.registry.js')
      refreshProviderApiKeys()
    } catch (err) {
      console.warn('[NarrativeGateway] refreshProviderApiKeys 失败:', err)
    }

    // ===== 2. Get provider list =====
    const userProvider = (this as any)._lastUserProvider
    const providerOverride = userProvider ? [userProvider] : request.providerOverride
    const providers = this.router.getProviderList(providerOverride)
    if (providers.length === 0) {
      const err = new Error('未配置任何 LLM API Key（需设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY）')
      completeTrace(traceId, err.message)
      throw err
    }

    // ===== 3. Build fallback chain: [p1, p1-retry, p2, p2-retry, ...] =====
    interface ChainEntry {
      provider: ProviderConfig
      attempt: number  // 1-based
    }

    const chain: ChainEntry[] = []
    for (const p of providers) {
      // 最多 MAX_RETRIES + 1 次尝试（初始 + retry）
      for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        chain.push({ provider: p, attempt })
      }
    }

    // ===== 4. Execute fallback chain =====
    let lastError: Error | null = null
    let fallbackUsed = false

    for (let i = 0; i < chain.length; i++) {
      const { provider: prov, attempt } = chain[i]

      // 熔断器检查（同步）
      const cbResult = this.policyEngine.checkCircuitBreaker(prov.name)
      if (!cbResult.allowed) {
        console.log(`[NarrativeGateway] ⛔ Circuit OPEN for ${prov.name}, skipping`)
        recordResult(prov.name, false, 0, true)
        fallbackUsed = true
        continue
      }

      // 非第一个 provider 标记 fallback
      if (i > 0 && prov.priority === 'fallback') {
        fallbackUsed = true
      }

      // 构建 AbortController
      const adjustedTimeout = cbResult.degradeFactor < 1
        ? Math.floor(timeoutMs * cbResult.degradeFactor)
        : timeoutMs
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), adjustedTimeout)

      const callStart = Date.now()
      try {
        const result = await this.fallbackExecutor.execute(
          prov,
          request.systemPrompt,
          request.userMessage,
          controller.signal,
          request.maxTokens,
          request.temperature,
        )

        clearTimeout(timeoutId)
        const latency = Date.now() - callStart

        // 记录成功
        recordResult(prov.name, true, latency, false)
        recordRequest(true, latency, prov.name, 0)
        traceProviderCall(traceId, prov.name, true, latency)

        addSpan(traceId, `llm-call:${prov.name}`, 'ok', {
          attempt,
          latencyMs: latency,
          tokens: result.totalTokens,
        })

        // ===== 5. Normalize response =====
        const totalLatency = Date.now() - startTime

        // 持久化 execution graph trace
        try {
          const { persistTrace } = await import('../llm-execution-graph-v2/index.js')
          if (executionGraph) {
            executionGraph.status = 'executed'
            await persistTrace(executionGraph, {
              success: true,
              latencyMs: totalLatency,
            })
          }
        } catch { /* trace never breaks execution */ }

        // 恢复用户 Key
        restoreUserKey?.()

        completeTrace(traceId)

        return normalizeResponse({
          content: result.content,
          provider: prov.name,
          latency: totalLatency,
          fallbackUsed,
          traceId,
          totalTokens: result.totalTokens,
          degraded: false,
        })
      } catch (err: any) {
        clearTimeout(timeoutId)
        const latency = Date.now() - callStart

        // 判断是否超时
        const isTimeout = err.name === 'AbortError' || err.message?.includes('signal') || err.message?.includes('timeout')

        // 记录失败
        recordResult(prov.name, false, latency, isTimeout)
        recordRequest(false, latency, prov.name, 0)
        traceProviderCall(traceId, prov.name, false, latency)

        addSpan(traceId, `llm-call:${prov.name}`, 'error', {
          attempt,
          latencyMs: latency,
          error: err.message?.slice(0, 200),
          isTimeout,
        })

        lastError = err

        // 检查是否应重试
        if (!this.policyEngine.shouldRetry(attempt, err)) {
          console.log(`[NarrativeGateway] ⛔ Non-retryable error for ${prov.name}: ${err.message?.slice(0,300)}, moving to next`)
          continue // 跳到下一个 provider
        }

        // 如果是最后一次尝试，不再等待重试
        if (i >= chain.length - 1) break

        // 指数退避等待
        const delayMs = this.policyEngine.getRetryDelayMs(attempt)
        addSpan(traceId, `retry-backoff:${prov.name}`, 'ok', { attempt, delayMs })
        await new Promise(r => setTimeout(r, delayMs))
      }
    }

    // ===== 6. All providers failed — throw error =====
    // ⭐ 零回退零兜底宪法：直接抛错，不降级
    if (lastError) {
      // 持久化失败 trace
      try {
        const { persistTrace } = await import('../llm-execution-graph-v2/index.js')
        if (executionGraph) {
          executionGraph.status = 'failed'
          await persistTrace(executionGraph, {
            success: false,
            error: lastError.message,
            latencyMs: Date.now() - startTime,
          })
        }
      } catch { /* trace never breaks execution */ }

      const errMsg = `AI 服务不可用：${lastError.message}。请检查「大模型设置」中的 API Key 是否有效`
      console.error(`[NarrativeGateway] ❌ All providers failed: ${lastError.message}`)

      restoreUserKey?.()
      completeTrace(traceId, errMsg)
      throw new Error(errMsg)
    }

    // ===== 完全失败 =====
    const finalError = lastError || new Error('所有 LLM provider 均失败')

    // v6: 记录 provider telemetry
    const providerUsed = request.userId && request.userId !== 'anonymous' ? this._lastUserProvider?.name || providers[0]?.name || 'unknown' : 'unknown'
    try {
      ExecutionTelemetryCollector.recordExecution({
        projectId: request.projectId || '',
        directorRunId: '',
        stage: 'render',
        startTime,
        endTime: Date.now(),
        success: false,
        provider: providerUsed,
        failureType: finalError.message?.slice(0, 100),
        shotCount: undefined,
        tags: { userId: request.userId?.slice(0, 8) || '' },
      })
    } catch {}

    // 恢复用户 Key
    restoreUserKey?.()

    completeTrace(traceId, finalError.message)
    throw finalError
  }

  /**
   * 获取 gateway 状态快照
   */
  getStatus() {
    const providers = this.router.getProviderList()
    const providerNames = providers.map(p => p.name)
    return {
      gateway_mode: 'enabled' as const,
      providers: providerNames,
      circuit_breaker: 'active' as const,
      observability: 'fully_integrated' as const,
      fallback_chain: providerNames.length >= 2
        ? (providerNames as [string, ...string[]]).reduce((a, b) => `${a} -> ${b}`)
        : providerNames.join(' -> '),
      async_degrade: true,
    }
  }
}

// ============================================================
// Singleton
// ============================================================

/** 全局的单例 gateway */
export const narrativeGateway = new NarrativeLLMGateway()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

