// ============================================================
// Pipeline — Discovery 可插拔 Pipeline 执行器
// V2: Signal 驱动。Stage 输出 DiscoverySignal，Pipeline 聚合后构建 Result
// ============================================================

import type { DiscoveryContext } from '../../domain/discovery-context.js'
import type { DiscoverySignal } from '../../domain/discovery-signal.js'
import type { PipelineStage, PipelineStageOutput } from './types.js'
import { DiscoveryResultBuilder } from '../builders/discovery-result-builder.js'
import type { DiscoveryResult } from '../../domain/discovery-result.js'

export class DiscoveryPipeline {
  private stages: PipelineStage[] = []
  private builder = new DiscoveryResultBuilder()

  addStage(stage: PipelineStage): this {
    this.stages.push(stage)
    this.stages.sort((a, b) => a.order - b.order)
    return this
  }

  addStages(stages: PipelineStage[]): this {
    for (const s of stages) this.addStage(s)
    return this
  }

  /**
   * 执行 Pipeline
   * Stage 通过 Context 通信，Pipeline 聚合 DiscoverySignal
   */
  async execute(
    initialCtx: DiscoveryContext,
    providers: string[],
    executionId: string,
  ): Promise<DiscoveryResult> {
    const ctx: DiscoveryContext = {
      ...initialCtx,
      currentStage: '',
      stageResults: {},
      startedAt: initialCtx.startedAt || new Date().toISOString(),
      errors: [],
      signals: initialCtx.signals || [],
    }

    for (const stage of this.stages) {
      ctx.currentStage = stage.id
      try {
        const output: PipelineStageOutput = await stage.execute(ctx)

        // 聚合 Stage 产生的 Signal
        if (Array.isArray(output.signals)) {
          ctx.signals.push(...output.signals)
        }

        // 记录 Stage 结果
        ctx.stageResults[stage.id] = {
          stage: stage.id,
          input: {},
          output: { signals: output.signals, errors: output.errors },
          durationMs: output.durationMs,
          confidence: output.signals.reduce((max, s) => Math.max(max, s.confidence), 0),
          evidenceCount: output.signals.reduce((sum, s) => sum + s.evidence.length, 0),
          error: output.errors.length > 0 ? output.errors.join('; ') : undefined,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        ctx.errors.push({ stage: stage.id, message: msg, recoverable: true })
        ctx.stageResults[stage.id] = {
          stage: stage.id,
          input: {},
          output: {},
          durationMs: 0,
          confidence: 0,
          evidenceCount: 0,
          error: msg,
        }
      }
    }

    return this.builder.build(ctx, providers, executionId)
  }
}
