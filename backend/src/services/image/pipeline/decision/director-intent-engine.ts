// ============================================================
// decision/director-intent-engine.ts
//
// 职责：DIE — Director Intent Engine（Phase 4.2）
//   在决策空间之上合成导演意图
//
// 核心机制：
//   1. 从 DOL canonical actions 提取行动候选集
//   2. 从 DCVL consistency report 获取冲突结构
//   3. 从 DSB stability buffer 获取稳定窗口
//   4. 合成 intent { primary, suppressedAlternatives, rationale }
//
// 设计原则（non-replacing augmentation）：
//   - 不替代 D2（不改变 decision pipeline）
//   - 不替代 Fusion（不改变仲裁结果）
//   - 不替代 Pipeline Output（不改变执行路径）
//   - 纯叠加层（intent 作为 ctx 附加信息）
// ============================================================

import type { CanonicalFusionResult, CanonicalAction, CanonicalActionType } from './decision-ontology-layer.js'
import type { ConsistencyReport, ConsistencyStatus } from './decision-consistency-validation.js'
import type { DSBState, DecisionStability } from './decision-stability-buffer.js'

// ─── 导演意图 ──────────────────────────────────────────

export type IntentType = 'PROCEED' | 'RECONSIDER' | 'RETHINK' | 'SUSPEND'

export interface DirectorIntent {
  /** 首选意图 */
  primary: IntentType
  /** 被压制的替代意图 */
  suppressedAlternatives: Array<{
    type: CanonicalActionType
    reason: string
  }>
  /** 意图生成依据 */
  rationale: {
    /** 决策空间状态 */
    decisionSpace: string
    /** 冲突结构 */
    conflictState: string
    /** 稳定窗口 */
    stabilityWindow: string
  }
  /** 置信度 0-1 */
  confidence: number
  /** 意图可读摘要 */
  summary: string
}

// ─── 冲突结构分解 ──────────────────────────────────────

interface ConflictProfile {
  typeConflict: boolean           // type 不一致
  modeConflict: boolean           // mode 不一致（更深层）
  forcedPressure: number          // 强制决策比例
  collapseRisk: boolean           // 坍缩风险
  divergenceStability: number     // 分歧稳定性
}

function buildConflictProfile(
  fusion: CanonicalFusionResult,
  consistency: ConsistencyReport,
  stability: DSBState,
): ConflictProfile {
  return {
    typeConflict: fusion.divergence?.typeMismatch ?? false,
    modeConflict: fusion.divergence?.modeMismatch ?? false,
    forcedPressure: consistency.forcedDecisionAudit.forcedRatio,
    collapseRisk: consistency.ontologyHealth.collapsed,
    divergenceStability: stability.stability.metrics.divergenceDrift,
  }
}

// ─── 意图合成 ──────────────────────────────────────────

function synthesizePrimaryIntent(
  profile: ConflictProfile,
  fusion: CanonicalFusionResult,
  stability: DecisionStability,
): { primary: IntentType; suppressed: DirectorIntent['suppressedAlternatives']; confidence: number } {
  const { typeConflict, modeConflict, forcedPressure, collapseRisk, divergenceStability } = profile

  // BLOCKED → SUSPEND（系统级阻断，无法形成意图）
  if (fusion.action.mode === 'BLOCKED') {
    return {
      primary: 'SUSPEND',
      suppressed: [
        { type: 'ACCEPT', reason: 'graph blocked — 系统级阻断，接受不可行' },
        { type: 'RERUN', reason: 'blocked 状态下重试无意义' },
      ],
      confidence: 0.85,
    }
  }

  // 稳定一致 → PROCEED（系统稳定，直接执行）
  if (!typeConflict && !modeConflict && !collapseRisk && stability.stable) {
    return {
      primary: 'PROCEED',
      suppressed: [],
      confidence: Math.min(0.95, 0.7 + (1 - divergenceStability) * 0.3),
    }
  }

  // 结构约束强制 → PROCEED（但有警告）
  if (forcedPressure > 0.3 && !collapseRisk) {
    return {
      primary: 'PROCEED',
      suppressed: [
        { type: fusion.action.type === 'ACCEPT' ? 'RERUN' : 'ACCEPT',
          reason: `forced pressure ${(forcedPressure * 100).toFixed(0)}% — 结构约束主导决策` },
      ],
      confidence: 0.65,
    }
  }

  // 深层冲突（mode mismatch）→ RECONSIDER
  if (modeConflict) {
    return {
      primary: 'RECONSIDER',
      suppressed: [
        { type: fusion.action.type === 'ACCEPT' ? 'RERUN' : 'ACCEPT',
          reason: `mode conflict: ${fusion.divergence?.detail ?? 'unknown'}` },
      ],
      confidence: 0.55,
    }
  }

  // 类型冲突 + 不稳定 → RETHINK
  if (typeConflict && !stability.stable) {
    return {
      primary: 'RETHINK',
      suppressed: [
        { type: 'ACCEPT', reason: 'type conflict 下 accept 不可信' },
        { type: 'ESCALATE', reason: '可以先 escalate 但系统应优先自纠正' },
      ],
      confidence: 0.45,
    }
  }

  // 坍缩检测 → SUSPEND
  if (collapseRisk) {
    return {
      primary: 'SUSPEND',
      suppressed: [
        { type: 'ACCEPT', reason: 'ontology collapse — 接受可能导致盲区' },
        { type: 'REWRITE', reason: '思考被统一，不宜重写' },
      ],
      confidence: 0.9,
    }
  }

  // 默认：安全 proceed
  return {
    primary: 'PROCEED',
    suppressed: [],
    confidence: 0.7,
  }
}

// ─── 主引擎 ────────────────────────────────────────────

export function synthesizeIntent(
  fusion: CanonicalFusionResult,
  consistency: ConsistencyReport,
  stability: DSBState,
): DirectorIntent {
  const profile = buildConflictProfile(fusion, consistency, stability)
  const { primary, suppressed, confidence } = synthesizePrimaryIntent(profile, fusion, stability.stability)

  return {
    primary,
    suppressedAlternatives: suppressed,
    rationale: {
      decisionSpace: `${fusion.action.mode} | ${fusion.action.type} (${(fusion.action.confidence * 100).toFixed(0)}%)`,
      conflictState: `typeConflict=${profile.typeConflict} modeConflict=${profile.modeConflict} collapse=${profile.collapseRisk} forced=${(profile.forcedPressure * 100).toFixed(0)}%`,
      stabilityWindow: `score=${(stability.stability.score * 100).toFixed(0)}% drift=${(profile.divergenceStability * 100).toFixed(0)}% stable=${stability.stability.stable}`,
    },
    confidence: Math.round(confidence * 100) / 100,
    summary: buildIntentSummary(primary, fusion.action.type, suppressed, consistency.status, stability.stability.stable),
  }
}

// ─── 摘要 ──────────────────────────────────────────────

function buildIntentSummary(
  primary: IntentType,
  actionType: CanonicalActionType,
  suppressed: DirectorIntent['suppressedAlternatives'],
  status: ConsistencyStatus,
  stable: boolean,
): string {
  const statusLabel = status === 'COLLAPSING' ? '⚠️COLLAPSE' : status === 'DIVERGENT' ? '⚠️DIVERGE' : '✅NORMAL'
  const stabilityLabel = stable ? '🔒' : '⚡'
  const sup = suppressed.length > 0
    ? ` | suppressed: ${suppressed.map(s => `${s.type}`).join(', ')}`
    : ''

  return `[DIE] ${primary}(${actionType}) ${stabilityLabel}${statusLabel}${sup}`
}
