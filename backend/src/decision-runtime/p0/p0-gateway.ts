/**
 * p0-gateway.ts — Phase P-0 Productization Shell: 唯一入口
 *
 * ============================================================
 * 链路（2026-06-22 U-0 注入后）：
 *
 *   User Query
 *     ↓
 *   1. Policy Guard — 合法性检查
 *     ↓
 *   2. Shadow Execution
 *       ├─ U-0 seed 匹配 → 子 universe → D-1 → D-2 → D-3
 *       └─ 未匹配 → 空 universe → D-1 → 空决策
 *     ↓
 *   3. 主路径有效 → ✅ P-0 Verified（degraded=false）
 *      主路径无效 → ⚠️ Fallback Reasoner（degraded=true）
 *     ↓
 *   4. Trace Sink（主/退都记录）
 * ============================================================
 *
 * 铁律：
 *   1. Frozen Core Invariance — B/D/E 不被修改
 *   2. Shadow Execution — 所有计算是影子运行
 *   3. Trace-Only Learning — 只学统计，不学逻辑
 */

import { E0PolicyGuard, GuardResult } from './policy-guard.js'
import { ShadowExecutor, ShadowResult } from './shadow-executor.js'
import { TraceSink } from './trace-sink.js'
import { FallbackReasoner } from './fallback-reasoner.js'

export interface P0Request {
  tenantId: string
  query: string
  context?: Record<string, any>
  source?: string
}

export interface P0Response {
  decision: {
    value: string
    truth: string
    confidence: number
  }
  traceId: string
  metrics: {
    stability: number
    fidelity: number
    consistency: number
    trustRate: number
  }
  provenance: {
    anchorSignature: string
    traceId: string
  }
  success: boolean
  degraded: boolean
  /** 命中的 seed ID */
  matchedSeed?: string | null
  /** U-1 匹配分数 */
  matchScore?: number
  /** U-1 匹配级别 */
  matchLevel?: 'strong' | 'acceptable' | 'weak' | 'none'
  /** U-1 候选列表 */
  matchCandidates?: Array<{ seedId: string; score: number }>
  /** U-1 Top Seed 组件详情 */
  topSeedComponents?: Record<string, number> | null
  error?: string
}

export class P0Gateway {
  private guard: E0PolicyGuard
  private shadow: ShadowExecutor
  private sink: TraceSink
  private fallback: FallbackReasoner

  constructor(guard: E0PolicyGuard, shadow: ShadowExecutor, sink: TraceSink) {
    this.guard = guard
    this.shadow = shadow
    this.sink = sink
    this.fallback = new FallbackReasoner()
  }

  handle(req: P0Request): P0Response {
    try {
      // Step 1: Policy Guard
      const guardResult = this.guard.check(req.query)
      if (!guardResult.allowed) {
        return this.reject(guardResult.reason ?? 'QUERY_REJECTED_BY_POLICY')
      }

      // Step 2: Shadow Execution（U-0 aware + U-1 matching + U-2 coverage trace）
      const result = this.shadow.executeWithCoverage(req.query)
      this.sink.record(result.trace)

      const mrCandidates = (result.matchResult as any)?.candidates ?? []
      const mrComponents = (result.matchResult as any)?.topSeedComponents ?? null

      if (result.hasValidDecision) {
        // ✅ 主路径有效 — P-0 Verified
        const metrics = this.sink.normalize(result.trace)
        return {
          decision: {
            value: result.decision.value,
            truth: result.decision.truth,
            confidence: result.decision.confidence,
          },
          traceId: result.trace.queryId,
          metrics: {
            stability: metrics.stability,
            fidelity: metrics.fidelity,
            consistency: metrics.consistency,
            trustRate: metrics.trustRate,
          },
          provenance: {
            anchorSignature: result.decision.provenance?.anchorSignature ?? 'unknown',
            traceId: result.trace.queryId,
          },
          success: true,
          degraded: false,
          matchedSeed: result.matchedSeedId,
          matchScore: result.matchResult?.bestScore ?? 0,
          matchLevel: result.matchResult?.matchLevel ?? 'none',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          matchCandidates: ((result.matchResult as any)?.candidates ?? []) as Array<{ seedId: string; score: number }>,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          topSeedComponents: ((result.matchResult as any)?.topSeedComponents ?? null) as Record<string, number> | null,
        }
      }

      // ⚠️ 主路径无效 — 退化模式
      const fb = this.fallback.classify(req.query)
      const degradedTruth: 'true' | 'unknown' = fb.confidence > 0.5 ? 'true' : 'unknown'
      const degradedDecision = {
        value: fb.value,
        truth: degradedTruth,
        confidence: fb.confidence,
      }

      const degradedTrace = { ...result.trace, decisionValue: fb.value, truth: degradedTruth }
      this.sink.record(degradedTrace)
      const metrics = this.sink.normalize(degradedTrace)

      return {
        decision: degradedDecision,
        traceId: result.trace.queryId,
        metrics: {
          stability: metrics.stability,
          fidelity: metrics.fidelity,
          consistency: metrics.consistency,
          trustRate: Math.min(metrics.trustRate, 0.3),
        },
        provenance: {
          anchorSignature: 'degraded-fallback',
          traceId: result.trace.queryId,
        },
        success: true,
        degraded: true,
        matchedSeed: null,
        matchScore: 0,
        matchLevel: 'none',
        error: 'P-0 主路径未找到匹配证明，已使用退化模式',
      }
    } catch (err: any) {
      return {
        decision: { value: 'ERROR', truth: 'unknown', confidence: 0 },
        traceId: 'error',
        metrics: { stability: 0, fidelity: 0, consistency: 0, trustRate: 0 },
        provenance: { anchorSignature: 'error', traceId: 'error' },
        success: false,
        degraded: false,
        error: err.message ?? 'INTERNAL_ERROR',
      }
    }
  }

  private reject(reason: string): P0Response {
    return {
      decision: { value: 'REJECTED', truth: 'unknown', confidence: 0 },
      traceId: 'none',
      metrics: { stability: 0, fidelity: 0, consistency: 0, trustRate: 0 },
      provenance: { anchorSignature: 'none', traceId: 'none' },
      success: false,
      degraded: false,
      error: reason,
    }
  }
}
