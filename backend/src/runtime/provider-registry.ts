/**
 * runtime/provider-registry.ts — Provider Registry
 *
 * ⚠️ FROZEN CORE NOTICE
 * This module is part of Architecture Convergence v1 frozen core.
 * Do NOT modify: RuntimeCredential, ModelAdapterRegistry, Worker Runtime, Credential Pipeline.
 *
 * Provider Registry 是全新的模块，负责：
 *   1. Provider 元数据注册（名称、图标、模型、能力）
 *   2. API Key 验证（verify）
 *   3. Provider 健康状态
 *   4. 默认模型映射
 *
 * 未来所有新 Provider 必须实现 ProviderLifecycle 接口才能注册。
 */

import { modelAdapterRegistry } from '../model-adapters/registry.js'

// ─── Types ───────────────────────────────────────────────────

export type Capability = 'llm' | 'image' | 'video' | 'tts' | 'music'

export interface ModelInfo {
  id: string
  capabilities: Capability[]
  defaultForCapability?: Capability
  contextWindow?: number
  description?: string
}

export interface ProviderMetadata {
  id: string
  name: string
  type: 'cloud' | 'local'
  baseURL: string
  icon?: string
  docsUrl?: string
  description?: string
  models: ModelInfo[]
  requiresBaseURL?: boolean
}

export interface VerifyRequest {
  provider: string
  apiKey: string
  baseURL?: string
  model?: string
}

export interface VerifyResponse {
  success: boolean
  latency: number
  provider: string
  availableModels: string[]
  capabilities: Capability[]
  defaultModel: string
  errorCode?: string
  errorMessage?: string
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  lastChecked: string
  lastError?: string
  successRate: number
}

/**
 * Provider 生命周期接口
 * 所有新 Provider 必须实现此接口才能注册到 ProviderRegistry
 */
export interface ProviderLifecycle {
  id: string
  name: string
  metadata: ProviderMetadata

  /** 验证 API Key 有效性 */
  verify(apiKey: string, baseURL?: string): Promise<{
    success: boolean
    latency: number
    availableModels: string[]
    capabilities: Capability[]
  }>

  /** 获取 Provider 健康状态 */
  health(): Promise<ProviderHealth>

  /** 获取该 Provider 支持的模型列表 */
  models(): Promise<ModelInfo[]>

  /** 获取 Provider 支持的能力列表 */
  capabilities(): Capability[]

  /** 获取指定能力的默认模型 */
  defaultModel(capability: Capability): string
}

// ─── Built-in Provider Registry ─────────────────────────────

class ProviderRegistry {
  private providers = new Map<string, ProviderLifecycle>()
  private initialized = false

  /** 注册一个 Provider */
  register(provider: ProviderLifecycle): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[ProviderRegistry] Provider ${provider.id} 已注册，跳过`)
      return
    }
    this.providers.set(provider.id, provider)
    console.log(`[ProviderRegistry] ✅ 已注册: ${provider.name} (${provider.id})`)
  }

  /** 获取 Provider 元数据 */
  getMetadata(providerId: string): ProviderMetadata | undefined {
    return this.providers.get(providerId)?.metadata
  }

  /** 获取 Provider 实例 */
  getProvider(providerId: string): ProviderLifecycle | undefined {
    return this.providers.get(providerId)
  }

  /** 列出所有已注册的 Provider */
  listProviders(): ProviderMetadata[] {
    return Array.from(this.providers.values()).map(p => p.metadata)
  }

  /** 按能力列出支持该能力的 Provider */
  listProvidersByCapability(capability: Capability): ProviderMetadata[] {
    return this.listProviders().filter(p =>
      p.models.some(m => m.capabilities.includes(capability))
    )
  }

  /** 按能力列出可用模型 */
  listModels(capability?: Capability): ModelInfo[] {
    const allModels: ModelInfo[] = []
    for (const p of this.providers.values()) {
      for (const m of p.metadata.models) {
        if (!capability || m.capabilities.includes(capability)) {
          allModels.push(m)
        }
      }
    }
    return allModels
  }

  /** 获取指定能力的默认模型（第一个注册的 Provider 的默认模型） */
  getDefaultModel(capability: Capability): { provider: string; model: string } | undefined {
    for (const p of this.providers.values()) {
      const defaultM = p.metadata.models.find(m => m.defaultForCapability === capability)
      if (defaultM) {
        return { provider: p.id, model: defaultM.id }
      }
    }
    return undefined
  }

  /** 验证 API Key */
  async verify(req: VerifyRequest): Promise<VerifyResponse> {
    const provider = this.providers.get(req.provider)
    if (!provider) {
      return {
        success: false,
        latency: 0,
        provider: req.provider,
        availableModels: [],
        capabilities: [],
        defaultModel: '',
        errorCode: 'UNKNOWN_PROVIDER',
        errorMessage: `不支持的 Provider: ${req.provider}。支持的: ${this.listProviders().map(p => p.id).join(', ')}`,
      }
    }

    const start = Date.now()
    try {
      const result = await provider.verify(req.apiKey, req.baseURL)

      const defaultModel = req.model || provider.defaultModel(result.capabilities[0] || 'llm')

      // P4.1.1: 验证失败时，从 result 中提取结构化错误
      if (!result.success) {
        const errorResult = result as any
        return {
          success: false,
          latency: Date.now() - start,
          provider: req.provider,
          availableModels: result.availableModels,
          capabilities: result.capabilities,
          defaultModel: '',
          errorCode: errorResult._error?.code || (result.availableModels.length === 0 ? 'VERIFY_FAILED' : 'UNKNOWN_ERROR'),
          errorMessage: errorResult._error?.message || '验证失败',
        }
      }

      return {
        success: result.success,
        latency: Date.now() - start,
        provider: req.provider,
        availableModels: result.availableModels,
        capabilities: result.capabilities,
        defaultModel,
      }
    } catch (err: any) {
      // P4.1.1: 尝试从 adapter 的分类错误中提取结构化错误码
      const classified = err?.body?._error || err?._error || null
      return {
        success: false,
        latency: Date.now() - start,
        provider: req.provider,
        availableModels: [],
        capabilities: provider.capabilities(),
        defaultModel: '',
        errorCode: classified?.code || 'VERIFY_FAILED',
        errorMessage: classified?.message || err.message,
      }
    }
  }

  /** 获取所有 Provider 的健康状态 */
  async healthCheck(): Promise<Record<string, ProviderHealth>> {
    const result: Record<string, ProviderHealth> = {}
    for (const [id, p] of this.providers) {
      try {
        result[id] = await p.health()
      } catch {
        result[id] = {
          status: 'unhealthy',
          latency: 0,
          lastChecked: new Date().toISOString(),
          lastError: 'Health check threw exception',
          successRate: 0,
        }
      }
    }
    return result
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  setInitialized(): void {
    this.initialized = true
  }
}

// ─── Singleton ──────────────────────────────────────────────

export const providerRegistry = new ProviderRegistry()

// ─── Factory: Reuse ModelAdapterRegistry for verification ────

/**
 * 通用 Provider Verifier — 复用 ModelAdapter 的 execute 能力做轻量验证
 *
 * 对大多数 Provider，调用 models list API 或一次最小 chat completion 确认 Key 有效。
 * 不做实际生产任务。
 */
export async function verifyModelProvider(
  provider: string,
  apiKey: string,
  baseURL?: string,
): Promise<{ success: boolean; latency: number; availableModels: string[] }> {
  // 尝试通过 ModelAdapterRegistry 找到第一个匹配的模型做验证
  // 复用已有的 adapter 逻辑，不重复实现
  const defaultModel = getDefaultModelForProvider(provider)

  if (!defaultModel) {
    // fallback: 用 HTTP GET models 列表
    return verifyViaModelsAPI(provider, apiKey, baseURL)
  }

  // 使用 adapter 做最小验证（轻量 chat completion）
  return verifyViaAdapter(provider, defaultModel, apiKey, baseURL)
}

function getDefaultModelForProvider(provider: string): string | undefined {
  const map: Record<string, string> = {
    deepseek: 'deepseek-chat',
    volcengine: 'volcengine-llm',
    aliyun: 'aliyun-llm',
    siliconflow: 'siliconflow-llm',
    openai: 'openai-compat',
  }
  return map[provider]
}

async function verifyViaAdapter(
  provider: string,
  model: string,
  apiKey: string,
  baseURL?: string,
): Promise<{ success: boolean; latency: number; availableModels: string[] }> {
  const adapter = modelAdapterRegistry.findAdapter(model)
  if (!adapter) {
    return { success: false, latency: 0, availableModels: [] }
  }

  const runtime = {
    requestId: `verify-${Date.now()}`,
    userId: '__verify__',
    provider,
    model,
    taskType: adapter.metadata?.taskType || 'llm',
    apiKey,
    baseURL,
    metadata: { purpose: 'key-verification' },
  }

  const input = {
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 1,
    temperature: 0,
  }

  const start = Date.now()
  try {
    const result = await adapter.execute(runtime, input as any)
    const latency = Date.now() - start

    return {
      success: result.success !== false,
      latency,
      availableModels: result.model ? [result.model] : [],
    }
  } catch (err: any) {
    const latency = Date.now() - start
    return { success: false, latency, availableModels: [] }
  }
}

async function verifyViaModelsAPI(
  provider: string,
  apiKey: string,
  baseURL?: string,
  timeoutMs = 5000,
): Promise<{ success: boolean; latency: number; availableModels: string[] }> {
  const endpoints: Record<string, string> = {
    deepseek: 'https://api.deepseek.com/v1/models',
    volcengine: 'https://ark.cn-beijing.volces.com/api/v3/models',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models',
    siliconflow: 'https://api.siliconflow.cn/v1/models',
    openai: 'https://api.openai.com/v1/models',
  }

  const url = baseURL
    ? `${baseURL.replace(/\/+$/, '')}/models`
    : endpoints[provider]

  if (!url) {
    return { success: false, latency: 0, availableModels: [] }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const start = Date.now()
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    const latency = Date.now() - start

    if (!res.ok) {
      return { success: false, latency, availableModels: [] }
    }

    const data = await res.json() as any
    const models: string[] = (data.data || data || [])
      .map((m: any) => m.id || m)
      .filter(Boolean)
      .slice(0, 50)

    return { success: true, latency, availableModels: models }
  } catch {
    const latency = Date.now() - start
    return { success: false, latency, availableModels: [] }
  } finally {
    clearTimeout(timer)
  }
}
