// ============================================================
// anchor-sync-gate.ts
//
// 职责：Phase 4.1 — Anchor Sync Gate Rule（观测级）
//   在 D4 激活前提供 readness 评估
//   只 warn/log，不 block 执行
//
// 设计原则（三等硬约束）：
//   1. ❌ 不阻断任何执行路径
//   2. ✔ 只输出 readiness score + warning level
//   3. ✔ 可审计，可覆盖
//
// D4 激活条件（仅观测）：
//   - constraint_influence_coverage > 0.6
//   - drift_score < 0.3
//   - trace completeness = true
//
// 注意：
//   - 当前 drift 是 PHASE 1 PROMPT_PROXY 级别
//   - 不代表真实视觉世界 drift
// ============================================================

import type { ExecutionContext } from './pipeline/types.js'
import { computeAnchorDrift } from './anchor-sync-trace.js'

// ─── Readiness 报告 ────────────────────────────────────

export type WarningLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AnchorSyncReadiness {
  /** D4 是否 ready（仅观测标记，不阻断） */
  readyForD4: boolean
  /** 警告级别 */
  warningLevel: WarningLevel
  /** 约束覆盖度（命中 prompt 的约束比例） */
  coverage: number
  /** drift 分数（0=完美对齐，1=完全漂移） */
  driftScore: number
  /** 约束丢失信号 */
  constraintLossSignals: string[]
  /** trace 完整性 */
  traceComplete: boolean
  /** 当前 drift 测量级别说明 */
  driftStageNote: string
}

// ─── Gate — 只观察 ─────────────────────────────────────

export function anchorSyncReadiness(ctx: ExecutionContext): AnchorSyncReadiness {
  const drift = computeAnchorDrift(ctx)

  if (!drift) {
    return {
      readyForD4: false,
      warningLevel: 'HIGH',
      coverage: 0,
      driftScore: 1,
      constraintLossSignals: ['AnchorSync 未注入 — syncConstraints 或 finalPrompt 缺失'],
      traceComplete: false,
      driftStageNote: 'PHASE_1_PROMPT_PROXY — 无约束数据，无法评估',
    }
  }

  const hasConstraints = !!(ctx.syncConstraints?.lighting || ctx.syncConstraints?.spatial || ctx.syncConstraints?.identity)
  const hasPrompt = !!ctx.finalPrompt

  const readyForD4 = drift.coverage > 0.6 && drift.driftScore < 0.3 && hasConstraints && hasPrompt
  const traceComplete = hasConstraints && hasPrompt

  let warningLevel: WarningLevel = 'LOW'
  if (drift.driftScore > 0.5 || drift.constraintLossSignals.length > 2) {
    warningLevel = 'HIGH'
  } else if (drift.driftScore > 0.3 || drift.constraintLossSignals.length > 0) {
    warningLevel = 'MEDIUM'
  }

  return {
    readyForD4,
    warningLevel,
    coverage: drift.coverage,
    driftScore: drift.driftScore,
    constraintLossSignals: drift.constraintLossSignals,
    traceComplete,
    driftStageNote: 'PHASE_1_PROMPT_PROXY — 仅测编译器正确性，不测渲染保真度',
  }
}
