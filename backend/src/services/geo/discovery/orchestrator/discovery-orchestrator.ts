// ============================================================
// Discovery Orchestrator — Discovery Engine 核心编排器
// 职责严格限定：初始化 Context → 执行 Pipeline → 构建 Envelope
// 不直接调 AI、不调 Provider、不调 Prompt
import { buildObservatorySnapshot, observatoryStore } from '../services/observatory'
import { timelineEngine } from '../../workspace/timeline'
// ============================================================

import { DiscoveryPipeline } from '../pipeline/pipeline'
import type { PipelineStage } from '../pipeline/types'
import type { DiscoveryContext } from '../../domain/discovery-context'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'
import { EnvelopeBuilder } from '../builders/envelope-builder'
import { providerRegistry } from '../registry/provider-registry'
import { DiscoveryEvents } from '../events/discovery-events'

export interface OrchestratorOptions {
  eventEmitter?: {
    emit(event: string, payload: unknown): void
  }
}

export class DiscoveryOrchestrator {
  private pipeline: DiscoveryPipeline
  private envelopeBuilder = new EnvelopeBuilder()
  private options: OrchestratorOptions

  constructor(options: OrchestratorOptions = {}) {
    this.pipeline = new DiscoveryPipeline()
    this.options = options
  }

  registerStages(stages: PipelineStage[]): void {
    this.pipeline.addStages(stages)
  }

  async discover(
    projectId: string,
    entityId: string,
    entityName: string,
  ): Promise<DiscoveryEnvelope> {
    const executionId = this.generateExecutionId()
    const enabledProviders = providerRegistry.getEnabled().map((p) => p.name)

    const ctx: DiscoveryContext = {
      projectId,
      entityId,
      entityName,
      currentStage: '',
      stageResults: {},
      startedAt: new Date().toISOString(),
      errors: [],
    }

    // Pipeline 执行，返回 DiscoveryResult
    const result = await this.pipeline.execute(ctx, enabledProviders, executionId)

    // 包装为 Envelope
    const envelope = this.envelopeBuilder.build(
      result,
      ctx,
      executionId,
      {}, // providerTokens — 后续由 Adapter 填充
      {}, // providerLatencyMs
      0,  // retries
    )

    // 发出事件（只传 executionId）
    this.emitCompleted(executionId, projectId, entityId, result.metadata.entityId)
    // Observatory: 记录执行快照
    // Timeline: discovery 事件目前暂不写入。后续 Knowledge Import → Health Recalc 接入时恢复
    // timelineEngine.getProjectTimeline() // 保留占位，后续 Knowledge Verification 引擎接入时启用
    observatoryStore.record(buildObservatorySnapshot(envelope))

    return envelope
  }

  /**
   * Replay — 用记录的 Context 重新执行 Pipeline，用于 Debug/Regression
   */
  async replay(ctx: DiscoveryContext): Promise<DiscoveryEnvelope> {
    const executionId = `replay-${Date.now()}`
    const enabledProviders = providerRegistry.getEnabled().map((p) => p.name)

    const result = await this.pipeline.execute(ctx, enabledProviders, executionId)

    return this.envelopeBuilder.build(
      result,
      ctx,
      executionId,
      {},
      {},
      0,
    )
  }

  private emitCompleted(
    executionId: string,
    projectId: string,
    entityId: string,
    resultId: string,
  ): void {
    if (!this.options.eventEmitter) return

    this.options.eventEmitter.emit(DiscoveryEvents.DiscoveryCompleted, {
      executionId,
      projectId,
      entityId,
      resultId,
      version: '2.0',
    })
  }

  private generateExecutionId(): string {
    return `disco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}
