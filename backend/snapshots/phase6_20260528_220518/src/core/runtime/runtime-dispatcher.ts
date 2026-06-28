/**
 * P1 — Runtime Dispatcher（Stateless Provider Runtime）
 *
 * ═══ 宪法 ═══
 * RuntimeDispatcher is the ONLY entry point for AI execution.
 * 所有 AI 调用必须经过 Dispatcher。
 * ProviderConfig 全链路显式传递，禁止 process.env 动态注入。
 * Dispatcher 不持有任何全局可变状态。
 *
 * ═══ 禁止 ═══
 * 1. 直接调用 adapter.execute() — 必须通过 Dispatcher
 * 2. 动态注入 process.env — providerConfig 显式传递
 * 3. 隐式 global fallback — 失败直接返回，不降级到默认 provider
 *
 * LEGACY: 任何绕过 Dispatcher 的 AI 调用均属于 Architecture Drift
 *
 * ═══ 调用链 ═══
 *   Agent → runtimeDispatcher.execute(capability, payload)
 *       ↓
 *   resolveCapabilityProvider() → providerConfig (显式数据)
 *       ↓
 *   providerRegistry.getAdapter() → adapter
 *       ↓
 *   adapter.execute({ providerConfig, payload })
 *
 * @see /providers/core/provider-adapter.ts
 * @see /providers/core/provider-registry.ts
 * @see /services/user-model-resolver-v2.ts
 */

import { Capability } from '../../core/runtime/capabilities.js'
import { userModelResolverV2, type ResolvedProvider } from '../../services/user-model-resolver-v2.js'
import { providerRegistry } from '../../providers/core/provider-registry.js'
import type { ProviderConfig } from '../../providers/core/provider-adapter.js'

export interface DispatchRequest {
  capability: Capability
  userId: string
  payload: {
    systemPrompt: string
    userMessage: string
    projectId?: string
    maxTokens?: number
    temperature?: number
  }
}

export interface DispatchResponse {
  content: string
  provider: string
  modelName: string
  latency: number
  ok: boolean
  totalTokens: number
}

class RuntimeDispatcher {
  /**
   * 执行 AI 调用
   *
   * 全链路无全局状态：
   *   1. 解析 capability → providerConfig (显式对象)
   *   2. 查 Registry → adapter
   *   3. adapter.execute({ providerConfig, payload })
   */
  async execute(request: DispatchRequest): Promise<DispatchResponse> {
    const { capability, userId, payload } = request
    const start = Date.now()

    // 1. 解析用户配置 → providerConfig (显式数据，不读 env)
    let resolved: ResolvedProvider
    try {
      resolved = await userModelResolverV2.resolveCapabilityProvider(capability, userId)
    } catch (err) {
      console.error(`[RuntimeDispatcher] ❌ 用户 ${userId.substring(0, 8)} capability "${capability}" 未配置:`, err)
      return {
        content: '',
        provider: 'none',
        modelName: 'none',
        latency: Date.now() - start,
        ok: false,
        totalTokens: 0,
      }
    }

    // 2. 构造 providerConfig（显式数据对象）
    const providerConfig: ProviderConfig = {
      provider: resolved.provider,
      modelName: resolved.modelName,
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
    }

    // 3. 从 Registry 获取 Adapter
    const adapter = providerRegistry.getAdapter(providerConfig.provider)
    if (!adapter) {
      console.error(`[RuntimeDispatcher] ❌ Provider "${providerConfig.provider}" 未在 Registry 中注册`)
      return {
        content: '',
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        latency: Date.now() - start,
        ok: false,
        totalTokens: 0,
      }
    }

    // 4. 执行（显式传参 providerConfig，不依赖 process.env）
    try {
      const result = await adapter.execute({
        providerConfig,
        payload: {
          systemPrompt: payload.systemPrompt,
          userMessage: payload.userMessage,
          maxTokens: payload.maxTokens || 4096,
          temperature: payload.temperature,
        },
      })

      return {
        content: result.content,
        provider: providerConfig.provider,
        modelName: result.model,
        latency: Date.now() - start,
        ok: true,
        totalTokens: result.totalTokens,
      }
    } catch (err) {
      console.error(`[RuntimeDispatcher] ❌ Provider "${providerConfig.provider}" 执行失败:`, err)
      return {
        content: '',
        provider: providerConfig.provider,
        modelName: providerConfig.modelName,
        latency: Date.now() - start,
        ok: false,
        totalTokens: 0,
      }
    }
  }

  /**
   * 快速检查用户是否配置了某个 capability
   */
  async hasCapability(capability: Capability, userId: string): Promise<boolean> {
    try {
      await userModelResolverV2.resolveCapabilityProvider(capability, userId)
      return true
    } catch {
      return false
    }
  }
}

export const runtimeDispatcher = new RuntimeDispatcher()
