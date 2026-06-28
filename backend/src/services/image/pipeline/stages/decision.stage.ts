// ============================================================
// stages/decision.stage.ts
//
// 职责：D2 Decision Stage — 双通道质量决策阶段（DOL 统一语义）
//   运行在 validate 之后，决定 pipeline 最终的行为
//
// 架构（更新）：
//   Scorer Lane → DOL normalize → CanonicalAction
//   Graph Lane  → DOL normalize → CanonicalAction
//   ↓
//   Canonical Fusion（基于 mode priority）
//   ↓
//   Pipeline Action（backward compatible）
//
// 设计原则：
//   - 原 D2 scorer 完全不变
//   - DOL 做语义统一，不改变决策结果
//   - 所有 lane 输出最终映射到同一种 canonical action
// ============================================================

import type { PipelineStage, ValidateOutput, PipelineOutput, ExecutionContext } from '../types.js'
import { DecisionEngine } from '../decision/decision-engine.js'
import type { QualityDecision } from '../decision/decision-engine.js'
import type { QualityDomain } from '../validators/core/baseline-registry.js'
import { computeGraphLaneDecision } from '../decision/decision-graph-lane.js'
import { normalizeScorerAction, normalizeGraphAction, fuseCanonical, canonicalToPipelineAction } from '../decision/decision-ontology-layer.js'
import { checkDecisionConsistency } from '../decision/decision-consistency-validation.js'
// DSB: 系统级单例（Phase 4.1.5 — 稳定缓冲层）
import { DecisionStabilityBuffer } from '../decision/decision-stability-buffer.js'
import { synthesizeIntent } from '../decision/director-intent-engine.js'
// ISF: 意图稳定场观测（Phase 4.5，只记录不干预）
import { IntentStabilityField } from '../decision/intent-stability-field.js'
// Phase Portrait: 意图相位图谱（IDF 的可视化投影层）
import { IntentPhasePortrait } from '../decision/intent-phase-portrait.js'
// CII: 因果同一性验证（Phase 4.10，纯观测）
import { CausalIdentityLayer } from '../decision/causal-identity-invariance.js'
const dsb = new DecisionStabilityBuffer()
const isf = new IntentStabilityField()
const portrait = new IntentPhasePortrait()
const causal = new CausalIdentityLayer()

// ─── Decision Stage 输出 ──────────────────────────────

export interface DecisionStageOutput {
  /** pipeline 最终输出 */
  pipelineOutput: PipelineOutput
  /** 融合决策详情 */
  fused: import('../decision/decision-ontology-layer.js').CanonicalFusionResult
  /** 是否应该重试（由 pipeline runner 消费） */
  shouldRetry: boolean
  /** 如果 regenerate，修改后的 prompt 建议 */
  promptHint?: string
}

// ─── Decision Stage ────────────────────────────────────

export function createDecisionStage(
  decisionEngine: DecisionEngine,
  domain: QualityDomain,
  retryCount = 0,
  maxRetries = 2,
): PipelineStage<ValidateOutput, ValidateOutput> {
  return {
    name: 'decision',
    async execute(input: ValidateOutput, ctx: ExecutionContext): Promise<ValidateOutput> {
      const { validation } = input

      // 如果 validation 不存在或已通过，快速路径
      if (!validation || validation.score === undefined) {
        return input
      }

      // ── Lane 1: Scorer（原 D2，完全不变） ──
      let scorerDecision: QualityDecision
      if (validation.passed && validation.issues.length === 0) {
        scorerDecision = {
          action: { type: 'accept', reason: 'validate 直接通过，无 issue' },
          triggerDimension: 'composite',
          triggerScore: validation.score,
          confidence: 1,
          context: { domain, retryCount, maxRetries, downstreamDomains: [], upstreamDomains: [] },
          timestamp: new Date().toISOString(),
        }
      } else {
        scorerDecision = decisionEngine.decide(validation, domain, retryCount, maxRetries)
      }

      // ── Lane 2: Graph Lane（DEIP） ──
      const graphDecision = ctx.d2InputGraph
        ? computeGraphLaneDecision(ctx.d2InputGraph as any)
        : null

      // ── DOL: 统一到 CanonicalAction ──
      const scorerCanonical = normalizeScorerAction(scorerDecision)
      const graphCanonical = graphDecision ? normalizeGraphAction(graphDecision) : null

      // ── DOL Fusion（基于 canonical mode priority） ──
      const fusion = fuseCanonical(scorerCanonical, graphCanonical)
      const finalAction = canonicalToPipelineAction(fusion.action)

      if (decisionEngine['rules'].enableTraceLogging) {
        console.log(`[Decision] ${domain} | ${fusion.action.summary}`)
      }

      // 写入 telemetry
      if (!fusion.agreement) {
        ctx.telemetry ??= {}
        ;(ctx.telemetry as Record<string, unknown>).dolFusion = {
          agreement: fusion.agreement,
          divergenc: fusion.divergence?.detail,
          resolvedAction: fusion.action.type,
          resolvedMode: fusion.action.mode,
        }
      }

      // ── DCVL: 一致性验证（影子层，只观测） ──
      const consistency = checkDecisionConsistency(scorerDecision, graphDecision, fusion)
      ctx.telemetry ??= {}
      ;(ctx.telemetry as Record<string, unknown>).dcvl = {
        status: consistency.status,
        divergenceRate: consistency.divergenceRate,
        collapsed: consistency.ontologyHealth.collapsed,
        forcedRatio: consistency.forcedDecisionAudit.forcedRatio,
        summary: consistency.summary,
      }

      if (consistency.status !== 'HEALTHY' && decisionEngine['rules'].enableTraceLogging) {
        console.log(`[DCVL] ${domain} | ${consistency.summary}`)
      }

      // ── DSB: 稳定缓冲（Phase 4.1.5，只观测不下令） ──
      const stability = dsb.update(consistency)
      if (!dsb.getSnapshot().baselineFrozen) {
        dsb.freezeBaseline(consistency)
      }
      ;(ctx.telemetry as Record<string, unknown>).dsb = {
        freeze: stability.stable,
        score: stability.score,
        metrics: stability.metrics,
        signals: stability.signals,
        tickCount: dsb.getSnapshot().tickHistory.length,
      }

      // ── DIE: 导演意图合成（Phase 4.2，non-replacing） ──
      const intent = synthesizeIntent(fusion, consistency, dsb.getSnapshot())
      ctx.telemetry ??= {}
      ;(ctx.telemetry as Record<string, unknown>).dieIntent = {
        primary: intent.primary,
        confidence: intent.confidence,
        summary: intent.summary,
        suppressed: intent.suppressedAlternatives.map(s => `${s.type}: ${s.reason}`),
      }

      // ── ISF: 意图稳定场观测（Phase 4.5 + 4.6，只记录不干预） ──
      isf.record(intent, consistency, dsb.getSnapshot())
      const report = isf.generateReport()
      const hasAlert = report.summary.includes('⚠️')
      // 每 5 次采样或检测到异常信号时输出日志
      if (decisionEngine['rules'].enableTraceLogging && (hasAlert || report.totalSamples % 5 === 0)) {
        console.log(report.summary)
      }
      ctx.telemetry ??= {}
      ;(ctx.telemetry as Record<string, unknown>).isf = {
        total: report.totalSamples,
        drift: report.intentTypeDriftRate,
        variance: report.intentConfidenceVariance,
        mismatchRate: report.intentDecisionMismatchRate,
        dsbDropJump: report.dsbResponse.lastDropCausedJump,
        dominantIntentRatio: report.frequencyAnalysis.dominantIntentRatio,
      }

      // ── Phase Portrait: 意图相位图谱投影 ──
      const snapshots = isf.getSnapshots()
      if (snapshots.length > 0) {
        portrait.record(snapshots[snapshots.length - 1])
      }
      if (report.totalSamples > 0 && report.totalSamples % 10 === 0 && decisionEngine['rules'].enableTraceLogging) {
        const trajectory = portrait.analyzeTrajectory()
        console.log(trajectory.summary)
        if (trajectory.identityPreserved !== undefined) {
          ;(ctx.telemetry as Record<string, unknown>).identity = {
            preserved: trajectory.identityPreserved,
            drift: trajectory.identityDrift,
            threshold: trajectory.initialAttractor ? `2×radius(${((portrait as any).initialSpreadRadius ?? 0.4) * 2 * 100}%)` : 'n/a',
          }
          if (!trajectory.identityPreserved) {
            console.log(`[Identity] ⚠️ 系统同一性丢失！drift=${trajectory.identityDrift}`)
          }
        }
      }

      // ── CII: 因果同一性验证（Phase 4.10） ──
      const isBlocked = fusion.action?.mode === 'BLOCKED' || (graphDecision as any)?.blocked === true
      const fusionResolution: 'agreement' | 'mode-priority' | 'blocked' =
        isBlocked ? 'blocked' as const
          : fusion.agreement ? 'agreement' as const
            : 'mode-priority' as const
      causal.record(consistency, intent, fusionResolution)
      if (report.totalSamples > 0 && report.totalSamples % 10 === 0 && decisionEngine['rules'].enableTraceLogging) {
        const cii = causal.generateReport()
        console.log(cii.summary)
        if (cii.alerts.length > 0) {
          cii.alerts.forEach(a => console.log(`[CII] ${a}`))
        }
        ;(ctx.telemetry as Record<string, unknown>).cii = {
          confidence: cii.identityConfidence,
          entropy: cii.structural.topologicalEntropy,
          causalConsistency: cii.causalPathConsistency,
          alerts: cii.alerts,
        }
      }

      return {
        ...input,
        decision: scorerDecision as any,       // backward compatible: 保留原 decision
        fusion,                                   // DOL fusion 结果
        promptHint: finalAction.type === 'regenerate' ? finalAction.reason : undefined,
      } as any
    },
  }
}
