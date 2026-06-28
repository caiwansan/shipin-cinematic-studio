/**
 * Legacy Provider Bridge — 历史 Provider 调用的安全适配层
 *
 * ═══ 核心设计 ═══
 * 不做「替换」，做「包装、翻译、迁移、废弃」
 *
 * 把 images.ts/tts.ts/voice.ts 中的历史 provider 调用包装到
 * executionCutover.executeProviderTask() 上，同时保证：
 *   1. 参数结构不变
 *   2. 业务语义保留
 *   3. 可逐步切换
 *
 * ═══ 迁移阶段 ═══
 * Phase 0: Bridge 建立（当前）
 * Phase 1: tts/voice → bridge wrapper（安全替换，Class A）
 * Phase 2: images → bridge wrapper（需 payload transform，Class B）
 * Phase 3: ai-tasks/script-submit → partial migration（Class B）
 * Phase 4: director/continuity → architecture refactor（Class C，最后动）
 */

import { Capability } from '../runtime/capabilities.js'
import { executionCutover } from '../control-plane/cutover/execution-cutover.js'
import { runtimeCallTracer } from '../verification/execution-plane/runtime-call-tracer.js'

/**
 * Legacy Bridge 配置
 * 控制每个历史路径的迁移状态
 */
export interface LegacyBridgeConfig {
  /** 图片生成 */
  image: { mode: 'direct' | 'bridged' | 'cutover' }
  /** TTS 语音合成 */
  tts: { mode: 'direct' | 'bridged' | 'cutover' }
  /** 语音合成（voice 路由） */
  voice: { mode: 'direct' | 'bridged' | 'cutover' }
  /** 视频生成 */
  video: { mode: 'direct' | 'bridged' | 'cutover' }
  /** 旧队列系统 */
  queue: { mode: 'direct' | 'bridged' | 'cutover' }
  /** director 编排 */
  director: { mode: 'direct' | 'bridged' | 'cutover' }
  /** 连续性管线 */
  continuity: { mode: 'direct' | 'bridged' | 'cutover' }
}

export type BridgeMode = 'direct' | 'bridged' | 'cutover'

/**
 * Bridge 执行上下文（参数转换用）
 */
export interface BridgeContext {
  userId: string
  capability: Capability
  provider: string
  model: string
  input: Record<string, any>
}

class LegacyProviderBridge {
  private config: LegacyBridgeConfig = {
    image: { mode: 'direct' },
    tts: { mode: 'direct' },
    voice: { mode: 'direct' },
    video: { mode: 'direct' },
    queue: { mode: 'direct' },
    director: { mode: 'direct' },
    continuity: { mode: 'direct' },
  }

  constructor() {
    console.log('[LegacyBridge] 🔌 Legacy Provider Bridge 已初始化，所有路径默认 direct 模式')
  }

  /**
   * 设置单个路径的迁移模式
   */
  setMode(path: keyof LegacyBridgeConfig, mode: BridgeMode): void {
    if (!this.config[path]) {
      console.warn(`[LegacyBridge] ⚠️ 未知路径: ${path}`)
      return
    }
    this.config[path].mode = mode
    console.log(`[LegacyBridge] 🔄 ${path}: ${this.config[path].mode} → ${mode}`)
  }

  /**
   * 批量设置迁移模式
   */
  setModes(modes: Partial<Record<keyof LegacyBridgeConfig, BridgeMode>>): void {
    for (const [path, mode] of Object.entries(modes)) {
      this.setMode(path as keyof LegacyBridgeConfig, mode!)
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): LegacyBridgeConfig {
    return { ...this.config }
  }

  /**
   * 获取模式
   */
  getMode(path: keyof LegacyBridgeConfig): BridgeMode {
    return this.config[path]?.mode ?? 'direct'
  }

  /**
   * 执行桥接调用
   *
   * 根据当前迁移模式决定行为：
   *   direct  — 什么都不做，返回 null（调用方继续走旧逻辑）
   *   bridged — 执行并返回结果，同时记录 trace
   *   cutover — 执行并返回结果（完全接管）
   */
  async execute(ctx: BridgeContext): Promise<{ handled: boolean; result?: any }> {
    const mode = this.getMode(this.capabilityToPath(ctx.capability))

    // direct 模式：不拦截
    if (mode === 'direct') {
      return { handled: false }
    }

    // bridged / cutover：走 executionCutover
    const start = Date.now()

    // 记录 trace（P7 可观测）
    runtimeCallTracer.record({
      userId: ctx.userId,
      capability: ctx.capability,
      path: `legacy-bridge → executionCutover.executeProviderTask (${ctx.model})`,
      latency: 0,
      finalProvider: ctx.provider,
      bypassed: false,
      source: 'legacy-bridge',
    })

    try {
      const result = await executionCutover.executeProviderTask({
        capability: ctx.capability,
        userId: ctx.userId,
        model: ctx.model,
        provider: ctx.provider,
        input: ctx.input,
      })

      return { handled: true, result }
    } catch (err: any) {
      if (mode === 'cutover') {
        // cutover 模式失败直接抛
        throw err
      }
      // bridged 模式失败：fallback 到原逻辑
      console.warn(`[LegacyBridge] ⚠️ bridged 调用失败 (${ctx.capability}): ${err.message}，fallback 到原始路径`)
      return { handled: false }
    }
  }

  /**
   * Capability 到配置路径的映射
   */
  private capabilityToPath(cap: Capability): keyof LegacyBridgeConfig {
    switch (cap) {
      case Capability.IMAGE_GENERATION: return 'image'
      case Capability.VIDEO_GENERATION: return 'video'
      case Capability.VOICE_GENERATION: return 'tts'
      // voice 路由自己判断
      default: return 'director'
    }
  }
}

export const legacyBridge = new LegacyProviderBridge()
