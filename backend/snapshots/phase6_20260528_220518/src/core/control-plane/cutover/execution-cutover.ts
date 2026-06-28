/**
 * P2-7 — ExecutionCutover（执行切换层）
 *
 * ═══ 宪法 ═══
 * ExecutionCutover 是系统唯一的 AI 执行入口。
 * 所有业务层必须通过 cutover.execute()，禁止直接调 Dispatcher。
 * P2 阶段强制全部走 ControlPlane。
 *
 * ═══ 不存在双入口 ═══
 * 没有 "有些链路走旧系统，有些走新系统"。
 * 唯一合法路径：cutover.execute() → ControlPlane
 *
 * ═══ 调用约束 ═══
 * 禁止：业务层直接 import runtimeDispatcher、queue-manager、worker-runtime
 * 禁止：绕过 ControlPlane 直接调 adapter.execute()
 */

import { Capability } from '../../runtime/capabilities.js'
import { controlPlane } from '../control-plane.js'
import { runtimeDispatcher } from '../../runtime/runtime-dispatcher.js'
import { modelAdapterRegistry } from '../../../model-adapters/registry.js'
import { patternLearner } from '../../autonomous/pattern-learner.js'
import type { RuntimePayload } from '../../../runtime/runtime-payload.js'
import { runtimeCallTracer } from '../../verification/execution-plane/runtime-call-tracer.js'

export type ExecutionMode = 'control-plane' | 'dispatcher-legacy' | 'auto'

class ExecutionCutover {
  private mode: ExecutionMode = 'control-plane'

  /**
   * 设置执行模式
   *   - 'control-plane': 全部走 ControlPlane（P2 生产模式）
   *   - 'dispatcher-legacy': 全部走旧 Dispatcher（回退）
   *   - 'auto': 自动选择
   */
  setMode(mode: ExecutionMode): void {
    this.mode = mode
    console.log(`[ExecutionCutover] 🔄 切换模式: ${mode}`)
  }

  /**
   * 统一执行入口
   *
   * P2 阶段：强制全部走 ControlPlane
   * fallback：仅在 ControlPlane 不可用时回退到 Dispatcher
   */
  async execute(task: {
    capability: Capability
    userId: string
    payload: {
      systemPrompt: string
      userMessage: string
      maxTokens?: number
      temperature?: number
    }
  }): Promise<{
    content: string
    success: boolean
    latency: number
    mode: string
    provider?: string
    modelName?: string
    totalTokens?: number
  }> {
    const start = Date.now()

    // P2 模式：全部走 ControlPlane
    if (this.mode === 'control-plane' || this.mode === 'auto') {
      try {
        const result = await controlPlane.executeSync({
          capability: task.capability,
          userId: task.userId,
          payload: task.payload,
        })

        return {
          content: result.content || '',
          success: true,
          latency: Date.now() - start,
          mode: 'control-plane',
          provider: result.provider,
          modelName: result.model,
          totalTokens: result.totalTokens,
        }
      } catch (err: any) {
        if (this.mode === 'control-plane') {
          // 生产模式：失败直接返回，不 fallback
          return {
            content: '',
            success: false,
            latency: Date.now() - start,
            mode: 'control-plane',
          }
        }
        // auto 模式：fallback 到 Dispatcher
        console.warn(`[ExecutionCutover] ⚠️ ControlPlane 失败，fallback 到 Dispatcher:`, err.message)
      }
    }

    // fallback：旧 Dispatcher
    try {
      const result = await runtimeDispatcher.execute({
        capability: task.capability,
        userId: task.userId,
        payload: task.payload,
      })

      return {
        content: result.content,
        success: result.ok,
        latency: Date.now() - start,
        mode: 'dispatcher',
        provider: result.provider,
        modelName: result.modelName,
        totalTokens: result.totalTokens,
      }
    } catch (err: any) {
      return {
        content: '',
        success: false,
        latency: Date.now() - start,
        mode: 'dispatcher',
      }
    }
  }

  /**
   * 通过 Model Adapter 执行 image/video/tts 等非 LLM 能力
   *
   * 这确保了 image/tts/voice 路由也走在统一执行平面上
   * （P7 学习 / P7-GOV 治理 / Audit 全覆盖）
   */
  async executeProviderTask(task: {
    capability: Capability
    userId: string
    model: string
    provider: string
    input: Record<string, any>
    runtime?: RuntimePayload
  }): Promise<{ success: boolean; result: any; latency: number }> {
    const start = Date.now()

    // Phase 4, Rule 1: 唯一执行入口必须是 modelAdapterRegistry.execute(runtime, model, input)
    // Phase 4, Rule 2: 禁止 runtime reconstruction，优先使用显式传递的 runtime
    let runtimePayload = task.runtime
    if (!runtimePayload) {
      // 从 task 字段构建临时 RuntimePayload（最小版本，仅用于适配旧调用方）
      runtimePayload = {
        userId: task.userId,
        provider: task.provider,
        model: task.model,
        taskType: task.capability as string,
        apiKey: '',  // callProvider 中会通过 provider 参数注入
      }
    }

    // 运行时追踪
    runtimeCallTracer.record({
      userId: task.userId,
      capability: task.capability,
      path: `executionCutover → modelAdapterRegistry.execute (${task.model})`,
      latency: 0,
      finalProvider: task.provider,
      bypassed: false,
      source: 'execution-cutover',
    })

    try {
      const result = await modelAdapterRegistry.execute(runtimePayload, task.model, {
        ...task.input,
        model: task.model,
      }, task.provider, task.capability as unknown as 'llm' | 'image' | 'video' | 'tts')

      // 记录执行模式到 P7 PatternLearner（统一执行平面的可观测性）
      const execPattern: import('../../autonomous/execution-pattern.js').ExecutionPattern = {
        executionId: `cutover-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        capability: task.capability,
        selectedRegion: 'local',
        selectedNode: 'api-server',
        decisionScore: 1.0,
        actualLatency: Date.now() - start,
        actualCost: 0,
        success: true,
        timestamp: Date.now(),
      }
      patternLearner.record(execPattern)

      return { success: true, result, latency: Date.now() - start }
    } catch (err: any) {
      const execPattern: import('../../autonomous/execution-pattern.js').ExecutionPattern = {
        executionId: `cutover-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        capability: task.capability,
        selectedRegion: 'local',
        selectedNode: 'api-server',
        decisionScore: 0,
        actualLatency: Date.now() - start,
        actualCost: 0,
        success: false,
        error: err.message,
        timestamp: Date.now(),
      }
      patternLearner.record(execPattern)

      return { success: false, result: null, latency: Date.now() - start }
    }
  }

  /**
   * 获取当前模式
   */
  getMode(): ExecutionMode {
    return this.mode
  }
}

/**
 * 唯一实例 — 系统所有 AI 调用都经过它
 */
export const executionCutover = new ExecutionCutover()
