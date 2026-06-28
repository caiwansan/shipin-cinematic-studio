// ============================================================
// decision/decision-fusion.ts
//
// 职责：D2 Decision Fusion Engine（DFE）
//   融合 Scorer Lane（原 D2）和 Graph Lane（DEIP）的决策
//   输出最终仲裁决策
//
// 核心逻辑：
//   agreement > 0.7 → 直接输出
//   conflict → prefer graph lane，log divergence
//
// 设计原则：
//   - 不修改 scorer lane
//   - 不修改 graph lane
//   - 只做融合仲裁
// ============================================================

import type { QualityDecision } from './decision-engine.js'
import type { GraphLaneDecision } from './decision-graph-lane.js'

// ─── 融合输出 ──────────────────────────────────────────

export interface FusedDecision {
  /** 融合后的最终决策 */
  action: QualityDecision['action']
  /** scorer lane 决策 */
  scorerDecision: QualityDecision
  /** graph lane 决策 */
  graphLaneDecision: GraphLaneDecision | null
  /** 融合置信度 */
  confidence: number
  /** 两条 lane 是否一致 */
  agreement: boolean
  /** 分歧信息（不一致时使用） */
  divergence?: {
    /** 分歧描述 */
    detail: string
    /** 分歧严重程度 0-1 */
    severity: number
    /** 最终选择哪条 lane */
    resolution: 'scorer' | 'graph'
  }
  /** 融合模式 */
  mode: 'SCORER_ONLY' | 'GRAPH_ONLY' | 'DUAL_AGREEMENT' | 'DUAL_CONFLICT'
}

// ─── Action 类型比较 ───────────────────────────────────

function actionType(action: QualityDecision['action']): string {
  return action.type
}

function sameActionType(a: QualityDecision['action'], b: GraphLaneDecision['action']): boolean {
  return actionType(a) === actionType(b)
}

function actionSeverity(action: QualityDecision['action']): number {
  const order: Record<string, number> = { accept: 1, retry: 2, regenerate: 3, escalate: 4 }
  return order[action.type] ?? 0
}

// ─── 融合引擎 ──────────────────────────────────────────

export function fuseDecisions(
  scorer: QualityDecision,
  graph: GraphLaneDecision | null,
): FusedDecision {
  // Case 1: 无 graph lane（scorer only）
  if (!graph) {
    return {
      action: scorer.action,
      scorerDecision: scorer,
      graphLaneDecision: null,
      confidence: scorer.confidence,
      agreement: true,
      mode: 'SCORER_ONLY',
    }
  }

  // Case 2: graph lane blocked（系统级阻断 → 信任 graph）
  if (graph.blocked) {
    return {
      action: graph.action,
      scorerDecision: scorer,
      graphLaneDecision: graph,
      confidence: Math.max(scorer.confidence, graph.confidence),
      agreement: false,
      divergence: {
        detail: `Graph lane blocked: ${graph.blockReason}. Scorer lane 未感知阻断`,
        severity: 0.8,
        resolution: 'graph',
      },
      mode: 'GRAPH_ONLY',
    }
  }

  // 比较 action 是否一致
  const same = sameActionType(scorer.action, graph.action)

  if (same) {
    // Case 3: 一致
    // 取更高的 confidence + 更详细的 reason
    const betterReason = graph.chosenPath.length > 0
      ? `${scorer.action.reason} | 图路径: ${graph.chosenPath.map(p => `${p.from}→${p.to}`).join(', ')}`
      : scorer.action.reason

    const enrichedAction = { ...scorer.action, reason: betterReason }

    return {
      action: enrichedAction,
      scorerDecision: scorer,
      graphLaneDecision: graph,
      confidence: Math.round(Math.max(scorer.confidence, graph.confidence) * 100) / 100,
      agreement: true,
      mode: 'DUAL_AGREEMENT',
    }
  }

  // Case 4: 冲突 — prefer graph lane（结构真理 > 统计真理）
  const severity = Math.abs(actionSeverity(scorer.action) - actionSeverity(graph.action)) / 4

  // 记录 divergence
  const detail = `Scorer: ${scorer.action.type}(${scorer.confidence}) vs Graph: ${graph.action.type}(${graph.confidence})`

  return {
    action: graph.action, // 最终信任 graph lane
    scorerDecision: scorer,
    graphLaneDecision: graph,
    confidence: Math.round(Math.max(scorer.confidence, graph.confidence) * 100) / 100,
    agreement: false,
    divergence: {
      detail,
      severity: Math.round(severity * 100) / 100,
      resolution: 'graph',
    },
    mode: 'DUAL_CONFLICT',
  }
}

// ─── Divergence 摘要（供 telemetry） ────────────────────

export function divergenceSummary(fused: FusedDecision): string {
  if (fused.mode === 'DUAL_AGREEMENT' || fused.mode === 'SCORER_ONLY') {
    return `[${fused.mode}] action=${fused.action.type} confidence=${fused.confidence}`
  }
  if (fused.mode === 'DUAL_CONFLICT') {
    return `[CONFLICT] ${fused.divergence!.detail} → resolved to ${fused.divergence!.resolution}`
  }
  if (fused.mode === 'GRAPH_ONLY') {
    return `[GRAPH_ONLY] ${fused.divergence?.detail ?? 'graph 独立决策'}`
  }
  return `[UNKNOWN_MODE]`
}
