// ============================================================
// decision/decision-ontology-layer.ts
//
// 职责：DOL — Decision Ontology Layer
// 让 scorer lane 和 graph lane 输出同一种“动作语言”
//
// 核心机制：
//   1. CanonicalAction — 统一动作协议
//   2. normalizeScorerAction() — scorer → canonical
//   3. normalizeGraphAction() — graph → canonical
//
// 解决：
//   - scorer 的 accept/retry/regenerate/escalate 与
//     graph 的 path/locked/weight 无统一语义空间
//   - Fusion 无法在同一语义空间做推理
// ============================================================

import type { QualityDecision } from './decision-engine.js'
import type { GraphLaneDecision } from './decision-graph-lane.js'

// ─── 规范动作 ──────────────────────────────────────────

export type CanonicalActionType = 'ACCEPT' | 'RERUN' | 'REWRITE' | 'ESCALATE'

export type CanonicalMode =
  | 'SCORE_CONFIRMED'       // Scorer 高分确认
  | 'SCORE_TOLERATED'       // Scorer 可接受
  | 'PATH_PREFERRED'        // Graph 最优路径
  | 'PATH_FORCED'           // Graph 强制路径（hard bias）
  | 'STRUCTURE_CONSTRAINED' // 结构约束导致修改
  | 'BLOCKED'               // 系统阻断
  | 'FALLBACK'              // 降级（默认行为）

export interface CanonicalAction {
  /** 规范动作类型 */
  type: CanonicalActionType
  /** 决策模式 */
  mode: CanonicalMode
  /** 决策置信度 0-1 */
  confidence: number
  /** 决策来源 provenance */
  provenance: {
    /** 来源 line */
    source: 'scorer' | 'graph' | 'fusion'
    /** 原始动作类型 */
    rawType: string
  }
  /** 元数据（保留原始信息，不丢失） */
  metadata: {
    /** Scorer 原始分数 */
    score_orig?: number
    /** Graph 原始路径 */
    graphPath_orig?: Array<{ from: string; to: string; weight: number }>
    /** Graph locked 节点 */
    lockedNodes_orig?: string[]
    /** Graph 是否 blocked */
    blocked_orig?: boolean
    /** 关联的约束来源 */
    constraintSources?: string[]
  }
  /** 可读摘要 */
  summary: string
}

// ─── Scorer → Canonical ───────────────────────────────

const SCORER_TO_CANONICAL: Record<string, { type: CanonicalActionType; mode: CanonicalMode }> = {
  accept:     { type: 'ACCEPT',   mode: 'SCORE_CONFIRMED' },
  retry:      { type: 'RERUN',    mode: 'SCORE_TOLERATED' },
  regenerate: { type: 'REWRITE',  mode: 'SCORE_TOLERATED' },
  escalate:   { type: 'ESCALATE', mode: 'FALLBACK' },
}

export function normalizeScorerAction(decision: QualityDecision): CanonicalAction {
  const mapping = SCORER_TO_CANONICAL[decision.action.type] ?? {
    type: 'ESCALATE' as CanonicalActionType,
    mode: 'FALLBACK' as CanonicalMode,
  }

  return {
    type: mapping.type,
    mode: mapping.mode,
    confidence: decision.confidence,
    provenance: { source: 'scorer', rawType: decision.action.type },
    metadata: {
      score_orig: decision.triggerScore,
      constraintSources: decision.context.upstreamDomains.map(d => d.domain),
    },
    summary: `[scorer] ${decision.action.type} (score=${decision.triggerScore})`,
  }
}

// ─── Graph → Canonical ────────────────────────────────

const GRAPH_TO_CANONICAL: Record<string, { type: CanonicalActionType; mode: CanonicalMode }> = {
  accept:     { type: 'ACCEPT',   mode: 'PATH_PREFERRED' },
  retry:      { type: 'RERUN',    mode: 'SCORE_TOLERATED' },
  regenerate: { type: 'REWRITE',  mode: 'STRUCTURE_CONSTRAINED' },
  escalate:   { type: 'ESCALATE', mode: 'BLOCKED' },
}

export function normalizeGraphAction(graph: GraphLaneDecision): CanonicalAction {
  const mapping = GRAPH_TO_CANONICAL[graph.action.type] ?? {
    type: 'ESCALATE' as CanonicalActionType,
    mode: 'FALLBACK' as CanonicalMode,
  }

  // 如果 graph blocked，升格为 BLOCKED mode
  const mode: CanonicalMode = graph.blocked ? 'BLOCKED' : mapping.mode

  // 如果有 hard bias（lockedNodes 不为空），升格为 PATH_FORCED
  const effectiveMode: CanonicalMode =
    !graph.blocked && graph.lockedNodes.length > 0 && mode === 'PATH_PREFERRED'
      ? 'PATH_FORCED'
      : mode

  return {
    type: mapping.type,
    mode: effectiveMode,
    confidence: graph.confidence,
    provenance: { source: 'graph', rawType: graph.action.type },
    metadata: {
      graphPath_orig: graph.chosenPath.map(p => ({ from: p.from, to: p.to, weight: p.weight })),
      lockedNodes_orig: graph.lockedNodes,
      blocked_orig: graph.blocked,
    },
    summary: `[graph] ${graph.action.type} (mode=${effectiveMode}, path=${graph.chosenPath.length ? graph.chosenPath[0].from + '→' + graph.chosenPath[0].to : 'none'})`,
  }
}

// ─── 融合辅助 ──────────────────────────────────────────

export interface CanonicalFusionResult {
  action: CanonicalAction
  scorerCanonical: CanonicalAction
  graphCanonical: CanonicalAction | null
  agreement: boolean
  divergence?: {
    typeMismatch: boolean
    modeMismatch: boolean
    confidenceGap: number
    detail: string
  }
}

/**
 * 在规范动作空间做融合
 *
 * 规则：
 *   - BLOCKED → 永远优先
 *   - PATH_FORCED → 优先于 SCORE_*
 *   - type 相同 → 合并 confidence + 合并 metadata
 *   - type 不同 → 按 mode 优先级裁决
 */
export function fuseCanonical(
  scorer: CanonicalAction,
  graph: CanonicalAction | null,
): CanonicalFusionResult {
  if (!graph) {
    return {
      action: { ...scorer, provenance: { ...scorer.provenance, source: 'fusion' } },
      scorerCanonical: scorer,
      graphCanonical: null,
      agreement: true,
    }
  }

  const typeMismatch = scorer.type !== graph.type
  const modeMismatch = scorer.mode !== graph.mode
  const confidenceGap = Math.abs(scorer.confidence - graph.confidence)

  // BLOCKED 永远优先
  if (graph.mode === 'BLOCKED') {
    return {
      action: {
        ...graph,
        provenance: { source: 'fusion', rawType: 'graph:blocked' },
        summary: `${graph.summary} | fusion: BLOCKED override`,
      },
      scorerCanonical: scorer,
      graphCanonical: graph,
      agreement: false,
      divergence: {
        typeMismatch,
        modeMismatch,
        confidenceGap,
        detail: `Graph BLOCKED: ${graph.metadata.blocked_orig ? 'system block' : 'all paths locked'}. Scorer 未感知`,
      },
    }
  }

  // PATH_FORCED 优先
  if (graph.mode === 'PATH_FORCED') {
    return {
      action: {
        ...graph,
        provenance: { source: 'fusion', rawType: 'graph:forced' },
        summary: `${graph.summary} | fusion: FORCED path (hard bias active)`,
      },
      scorerCanonical: scorer,
      graphCanonical: graph,
      agreement: false,
      divergence: {
        typeMismatch,
        modeMismatch,
        confidenceGap,
        detail: `Graph PATH_FORCED by ${graph.metadata.lockedNodes_orig?.join(', ')} lock`,
      },
    }
  }

  // 完全一致 → 合并
  if (!typeMismatch && !modeMismatch) {
    const combinedConfidence = Math.round(Math.max(scorer.confidence, graph.confidence) * 100) / 100
    return {
      action: {
        type: scorer.type,
        mode: scorer.mode,
        confidence: combinedConfidence,
        provenance: { source: 'fusion', rawType: `${scorer.provenance.rawType} + ${graph.provenance.rawType}` },
        metadata: { ...scorer.metadata, ...graph.metadata },
        summary: `${scorer.summary} | ${graph.summary} | fusion: AGREEMENT`,
      },
      scorerCanonical: scorer,
      graphCanonical: graph,
      agreement: true,
    }
  }

  // type 不同 → mode 优先级裁决
  const modeRank: Record<string, number> = {
    BLOCKED: 5,
    PATH_FORCED: 4,
    STRUCTURE_CONSTRAINED: 3,
    PATH_PREFERRED: 2,
    SCORE_CONFIRMED: 1,
    SCORE_TOLERATED: 0,
    FALLBACK: -1,
  }

  const scorerRank = modeRank[scorer.mode] ?? 0
  const graphRank = modeRank[graph.mode] ?? 0

  const winner = graphRank >= scorerRank ? graph : scorer
  const loser = graphRank >= scorerRank ? scorer : graph

  return {
    action: {
      ...winner,
      provenance: { source: 'fusion', rawType: `${winner.provenance.rawType} > ${loser.provenance.rawType}` },
      summary: `${winner.summary} | fusion: CONFLICT resolved by mode priority | diverged: ${loser.summary}`,
    },
    scorerCanonical: scorer,
    graphCanonical: graph,
    agreement: false,
    divergence: {
      typeMismatch,
      modeMismatch,
      confidenceGap,
      detail: `Scorer: ${scorer.type}(${scorer.mode}) vs Graph: ${graph.type}(${graph.mode}) → preference by mode priority`,
    },
  }
}

// ─── Canonical → pipeline action ──────────────────────

export function canonicalToPipelineAction(canonical: CanonicalAction): QualityDecision['action'] {
  switch (canonical.type) {
    case 'ACCEPT':
      return { type: 'accept', reason: canonical.summary }
    case 'RERUN':
      return { type: 'retry', reason: canonical.summary, attemptRemaining: 2 }
    case 'REWRITE':
      return { type: 'regenerate', reason: canonical.summary, promptHint: 'DOL auto-generated' }
    case 'ESCALATE': {
      const severity = canonical.mode === 'BLOCKED' ? 'high' : canonical.mode === 'FALLBACK' ? 'mid' : 'low'
      return { type: 'escalate', reason: canonical.summary, severity }
    }
  }
}
