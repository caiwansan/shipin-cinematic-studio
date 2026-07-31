/**
 * model-adapters/registry.ts — 模型适配器注册表
 *
 * 新增模型只需：
 *   1. 写一个 adapter 实现 ModelAdapter 接口
 *   2. import 并 register() 到注册表
 *   3. 自动路由生效
 */

import { ModelAdapter, AdapterEntry, ModelAdapterInput, ModelAdapterResult } from './types.js'
import type { RuntimePayload } from '../runtime/runtime-payload.js'
import { getProviderStateService } from '../runtime/provider-state/index.js'
import { safetyGate, onSuccess, onFailure } from '../execution-safety/index.js'
import { traceService } from '../execution-trace/index.js'
import { normalizeProviderError } from '../services/provider-error-normalizer.js'

export class ModelAdapterRegistry {
  private adapters: Map<string, ModelAdapter> = new Map()
  private prefixIndex: Map<string, ModelAdapter> = new Map()

  /**
   * 注册适配器
   */
  register(adapter: ModelAdapter): void {
    this.adapters.set(adapter.name, adapter)

    // 构建前缀索引
    for (const model of adapter.supportedModels) {
      // 如果以 * 结尾，作为前缀匹配
      if (model.endsWith('*')) {
        const prefix = model.slice(0, -1)
        this.prefixIndex.set(prefix, adapter)
        console.log(`[ModelAdapter] 注册前缀匹配: "${prefix}" → ${adapter.name}`)
      } else {
        // 否则精确匹配
        this.prefixIndex.set(model, adapter)
        console.log(`[ModelAdapter] 注册精确匹配: "${model}" → ${adapter.name}`)
      }
    }

    console.log(`[ModelAdapter] ✅ 适配器 ${adapter.name} 已注册，支持 ${adapter.supportedModels.length} 个模型`)
  }

  /**
   * 根据模型名查找适配器
   * 1. 精确匹配
   * 2. 前缀匹配
   * 3. fallback 到 provider 相同 taskType 的适配器
   */
  findAdapter(model: string): ModelAdapter | undefined {
    // 精确匹配
    if (this.prefixIndex.has(model)) {
      return this.prefixIndex.get(model)
    }

    // 前缀匹配（按长度降序，优先匹配最具体的前缀）
    const candidates: { prefix: string; adapter: ModelAdapter }[] = []
    for (const [prefix, adapter] of this.prefixIndex.entries()) {
      if (model.startsWith(prefix)) {
        candidates.push({ prefix, adapter })
      }
    }
    candidates.sort((a, b) => b.prefix.length - a.prefix.length)
    if (candidates.length > 0) {
      console.log(`[ModelAdapter] 前缀匹配: "${model}" → ${candidates[0].adapter.name} (prefix="${candidates[0].prefix}")`)
      return candidates[0].adapter
    }

    return undefined
  }

  /**
   * 根据 taskType 列出所有支持的模型
   */
  listModels(taskType?: 'llm' | 'image' | 'video' | 'tts'): string[] {
    const models = new Set<string>()
    for (const adapter of this.adapters.values()) {
      if (!taskType || adapter.taskTypes.includes(taskType)) {
        for (const model of adapter.supportedModels) {
          models.add(model)
        }
      }
    }
    return Array.from(models).sort()
  }

  /**
   * 罗列所有已注册的适配器
   */
  listAdapters(): string[] {
    return Array.from(this.adapters.keys()).sort()
  }

  /**
   * 统一执行入口（Phase 1-C: 显式 RuntimePayload）
   * 根据 model 名自动路由到对应适配器
   *
   * Phase 1-D 修复: 执行 adapter 前，将 runtime.apiKey 写入 process.env
   * 使旧 provider（如 siliconflow-tts）能从 process.env 读取 Key
   */
  async execute(
    runtime: RuntimePayload,
    model: string,
    input: ModelAdapterInput,
    fallbackProvider?: string,
    fallbackTaskType?: 'llm' | 'image' | 'video' | 'tts'
  ): Promise<ModelAdapterResult> {
    // Phase 1-D: 将 runtime API Key 注入 process.env，供旧 provider 读取
    const envKeyName = `${runtime.provider.toUpperCase()}_API_KEY`
    const prevEnvVal = process.env[envKeyName]
    if (runtime.apiKey && !process.env[envKeyName]) {
      process.env[envKeyName] = runtime.apiKey
    }
    // 也设置通用的 SILICONFLOW_API_KEY（硅基流动）等
    if (runtime.apiKey && runtime.provider === 'siliconflow') {
      if (!process.env.SILICONFLOW_API_KEY) process.env.SILICONFLOW_API_KEY = runtime.apiKey
    }

    try {
      let adapter = this.findAdapter(model)

      // fallback: 按 provider + taskType 找
      if (!adapter && fallbackProvider && fallbackTaskType) {
        for (const a of this.adapters.values()) {
          if (a.provider === fallbackProvider && a.taskTypes.includes(fallbackTaskType)) {
            adapter = a
            console.log(`[ModelAdapter] fallback: 按 provider=${fallbackProvider}, taskType=${fallbackTaskType} → ${a.name}`)
            break
          }
        }
      }

      if (!adapter) {
        throw new Error(`[ModelAdapter] 找不到模型 "${model}" 的适配器${fallbackProvider ? ` (fallback provider=${fallbackProvider} 也失败)` : ''}`)
      }

      console.log(`[ModelAdapter] 路由: model=${model} → adapter=${adapter.name} (userId=${runtime.userId?.substring(0, 8)})`)

      // Provider State Layer v1: 查询当前状态
      const provider = adapter.provider
      const userId = runtime.userId || 'anonymous'
      const apiKey = runtime.apiKey || input.apiKey || ''

      // ═══════════════════════════════════════════════════
      // Execution Trace — 记录开始
      // ═══════════════════════════════════════════════════
      const traceId = traceService.startTrace({
        userId,
        taskType: adapter.taskTypes[0] || 'unknown',
        provider,
        model,
        input,
      })

      // ═══════════════════════════════════════════════════
      // Execution Safety Layer — 独立安全护栏
      // ═══════════════════════════════════════════════════
      const state = await getProviderStateService().get(userId, provider)
      console.log(`[SafetyGate] userId=${userId} provider=${provider} status=${state.status} enabled=${state.enabled} failures=${state.consecutiveFailures}`)
      const { allowed, reason } = safetyGate({
        enabled: state.enabled,
        status: state.status,
        failureCount: state.consecutiveFailures || 0,
        circuitOpenedAt: state.circuitOpenedAt || null,
      })

      if (!allowed) {
        traceService.blockTrace(traceId, reason || 'unknown')
        throw new Error(`[ExecutionSafety] Provider ${provider} 被安全护栏阻断: ${reason}`)
      }

      traceService.addStep(traceId, { name: 'safety-check', data: { allowed: true } })

      let result: ModelAdapterResult
      try {
        traceService.addStep(traceId, { name: 'adapter-execute', data: { provider, model } })
        result = await adapter.execute(runtime, { ...input, model })
        traceService.addStep(traceId, { name: 'provider-response', data: { status: 'success' } })
      } catch (execErr: any) {
        traceService.failTrace(traceId, execErr)
        // Safety Layer: 计算新状态并传给 state recorder
        const newState = onFailure({
          enabled: state.enabled,
          status: state.status,
          failureCount: state.consecutiveFailures || 0,
          circuitOpenedAt: state.circuitOpenedAt || null,
        })
        // Provider State: 纯记录（fire-and-forget）
        getProviderStateService().markFailure(userId, provider, execErr, apiKey, newState.failureCount, newState.circuitOpenedAt).catch(() => {})

        // ⭐ 错误规范化：Provider 原始错误 → 用户可理解的产品化错误
        const normalized = normalizeProviderError(execErr, provider)
        const normalizedErr = new Error(`${normalized.code}: ${normalized.message}`)
        console.error(`[ModelAdapter] ❌ adapter ${adapter.name} 失败: ${normalized.raw?.slice(0, 200) || execErr.message}`)
        throw normalizedErr
      }

      // Safety Layer: 成功后重置
      const resetState = onSuccess({
        enabled: state.enabled,
        status: 'healthy',
        failureCount: 0,
        circuitOpenedAt: null,
      })
      // Provider State: 纯记录（fire-and-forget）
      getProviderStateService().markSuccess(userId, provider, apiKey, resetState.circuitOpenedAt).catch(() => {})
      // Trace: 记录完成
      traceService.finishTrace(traceId, result)
      return result
    } finally {
      // 恢复 process.env（防止污染）
      if (runtime.apiKey && !prevEnvVal) {
        delete process.env[envKeyName]
        if (runtime.provider === 'siliconflow') delete process.env.SILICONFLOW_API_KEY
      }
    }
  }
}

/**
 * 全局单例（boot 前注册用，boot 后 freeze）
 */
export const modelAdapterRegistry = new ModelAdapterRegistry()

/**
 * 冻结注册表 — boot 完成后调用，防止运行时修改
 */
export function freezeRegistry() {
  Object.freeze(modelAdapterRegistry)
  console.log('[ModelAdapter] ✅ Registry frozen — 运行时不可更改')
}
