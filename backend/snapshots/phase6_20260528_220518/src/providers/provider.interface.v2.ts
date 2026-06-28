/**
 * providers/provider.interface.v2.ts — Provider 执行契约 v2
 *
 * ═══════════════════════════════════════════════════════════════════
 * 所有 Provider 必须实现本接口
 *
 * 规则（Runtime Constitution）:
 *   1. provider 接收 ResolvedRuntimeConfig，不自行查找 API Key / Model
 *   2. provider 不自行决定 fallback
 *   3. provider 不读写 process.env
 *   4. provider 只做一件事：把 ResolvedRuntimeConfig + Input → Result
 * ═══════════════════════════════════════════════════════════════════
 */

import type { ResolvedRuntimeConfig } from '../runtime/resolveRuntimeConfig.js'

// ─── 输入 ──────────────────────────────────────────────────────────

export interface V2Input {
  prompt?: string
  text?: string
  systemPrompt?: string
  negativePrompt?: string
  imageUrl?: string
  referenceImages?: string[]
  size?: string
  aspectRatio?: string
  n?: number
  duration?: number
  ratio?: string
  voice?: string
  speed?: number
  format?: string
  temperature?: number
  maxTokens?: number
  [key: string]: unknown
}

// ─── 输出 ───────────────────────────────────────────────────────────

export type V2TaskStatus = 'submitted' | 'running' | 'completed' | 'failed'

export interface V2Result {
  /** 同步结果 URL */
  url?: string
  /** 异步任务 ID */
  taskId?: string
  /** 任务状态 */
  status?: V2TaskStatus
  /** 文本内容 */
  content?: string
  /** 解析度 */
  resolution?: string
  /** 时长（视频/音频） */
  duration?: number
  /** seed */
  seed?: number
  /** token 消耗 */
  totalTokens?: number
  /** 修正后的 prompt */
  revisedPrompt?: string
  /** 使用的 provider 名 */
  provider?: string
}

// ─── Provider V2 契约 ──────────────────────────────────────────────

export interface ProviderV2 {
  /** Provider 唯一标识（全小写） */
  readonly name: string

  /** 支持的能力列表 */
  readonly capabilities: Array<'llm' | 'image' | 'video' | 'tts'>

  /**
   * 执行入口
   *
   * @param config - 已解析的运行配置（不含 fallback 决策）
   * @param input  - 纯输入数据
   * @returns V2Result
   */
  execute(config: ResolvedRuntimeConfig, input: V2Input): Promise<V2Result>
}
