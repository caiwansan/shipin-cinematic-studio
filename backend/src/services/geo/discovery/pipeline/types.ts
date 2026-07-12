// ============================================================
// Pipeline Stage Contract
// 每个 Stage 接收 DiscoveryContext，返回 PipelineStageOutput
// Stage 不直接操作 Result，只修改 Context
//
// 新版：Stage 消费 DiscoverySignal，不直接写 Context
// ============================================================

import type { DiscoveryContext } from '../../domain/discovery-context.js'
import type { DiscoverySignal } from '../../domain/discovery-signal.js'

export type StageId = string

export interface PipelineStage {
  /** 唯一标识 */
  id: StageId

  /** 人类可读名称 */
  name: string

  /** 执行顺序（低→高） */
  order: number

  /** 核心逻辑 */
  execute(ctx: DiscoveryContext): Promise<PipelineStageOutput>
}

export interface PipelineStageOutput {
  /** Stage 执行耗时 */
  durationMs: number

  /** 执行是否成功 */
  success: boolean

  /** 错误信息 */
  errors: string[]

  /** 推荐的下游 Stage */
  nextStages: string[]

  /** 此 Stage 产生的 DiscoverySignal */
  signals: DiscoverySignal[]
}
