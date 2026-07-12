// ============================================================
// DiscoveryResult Builder
// 职责：DiscoveryContext → DiscoveryResult
// Pipeline 内部不直接产生 Result，所有 Stage 操作 Context
// Builder 负责最后的组装
// ============================================================

import type { DiscoveryContext } from '../../domain/discovery-context.js'
import type { DiscoveryResult, DiscoveryMetadata } from '../../domain/discovery-result.js'
import type { DiscoverySignal } from '../../domain/discovery-signal.js'
import type { StageResult } from '../../domain/discovery-context.js'

export class DiscoveryResultBuilder {
  build(ctx: DiscoveryContext, providers: string[], executionId: string): DiscoveryResult {
    const stageDurations: Record<string, number> = {}
    for (const [stage, result] of Object.entries(ctx.stageResults)) {
      stageDurations[stage] = result.durationMs
    }

    const totalDurationMs = ctx.startedAt
      ? Date.now() - new Date(ctx.startedAt).getTime()
      : 0

    // 从 signals 聚合 visibility 和 entity（不再依赖 Provider 具体返回）
    const presenceSignals = ctx.signals.filter((s) => s.type === 'presence')
    const knowledgeSignals = ctx.signals.filter((s) => s.type === 'knowledge')
    const avgPresenceConfidence = presenceSignals.length > 0
      ? Math.round(presenceSignals.reduce((s, sig) => s + sig.confidence, 0) / presenceSignals.length * 100)
      : 0

    const metadata: DiscoveryMetadata = {
      projectId: ctx.projectId,
      entityId: ctx.entityId,
      discoveredAt: new Date().toISOString(),
      providers,
      overralConfidence: this.calculateOverallConfidence(ctx),
      executionId,
      pipelineVersion: '2.0',
      durationMs: totalDurationMs,
      signals: ctx.signals,
    }

    return {
      version: '2.0',
      metadata,
      entity: {
        name: ctx.entityName,
        aliases: ctx.entity?.aliases ?? [],
        categories: ctx.entity?.categories ?? [],
        locations: ctx.entity?.locations ?? [],
        website: ctx.entity?.website,
        logoUrl: ctx.entity?.logoUrl,
        description: ctx.entity?.description,
      },
      presence: {
        providerResults: [],
        visibility: ctx.presence?.visibility ?? 0,
        sentiment: ctx.presence?.sentiment ?? 0,
        authority: ctx.presence?.authority ?? 0,
        citations: [],
        ...ctx.presence,
      },
      knowledge: {
        coverage: ctx.knowledge?.coverage ?? 0,
        claims: [],
        evidence: [],
        faq: [],
        schema: [],
        missingKnowledge: [],
        ...ctx.knowledge,
      },
      competitors: {
        entities: [],
        gaps: [],
        opportunities: [],
        ...ctx.competitors,
      },
      recommendations: {
        items: [],
        priority: 'medium',
      },
      evidence: {
        totalCount: 0,
        highConfidence: 0,
        totalCitations: 0,
      },
      diagnostics: {
        stageDurations,
        errors: ctx.errors.map((e) => ({
          stage: e.stage,
          message: e.message,
          recoverable: e.recoverable,
        })),
        warnings: [],
      },
    }
  }

  private calculateOverallConfidence(ctx: DiscoveryContext): number {
    const values = Object.values(ctx.stageResults)
      .map((r) => r.confidence)
      .filter((c) => c > 0)
    if (values.length === 0) return 0
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }
}
