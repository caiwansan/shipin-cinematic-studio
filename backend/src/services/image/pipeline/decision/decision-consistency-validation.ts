// ============================================================
// decision/decision-consistency-validation.ts
//
// 职责：DCVL — Decision Consistency Validation Layer
//   验证 DOL 是否保留了原始 reasoning diversity
//
// 核心观测指标：
//   1. divergence retention — graph vs scorer 分歧率
//   2. ontology collapse — canonical actions entropy 是否异常下降
//   3. forced decision audit — PATH_FORCED vs natural agreement 比例
//   4. information loss — 原始信息在归一化中是否丢失
//
// 设计原则：
//   - 只观测，不改变任何决策路径（影子层）
//   - 不引入新语义（只计算已有差异）
//   - 不设置阈值（让人类观察者做判断）
// ============================================================

import type { QualityDecision } from './decision-engine.js'
import type { GraphLaneDecision } from './decision-graph-lane.js'
import type { CanonicalAction, CanonicalFusionResult, CanonicalActionType, CanonicalMode } from './decision-ontology-layer.js'
import { normalizeScorerAction, normalizeGraphAction } from './decision-ontology-layer.js'

// ─── 一致性报告 ────────────────────────────────────────

export type ConsistencyStatus = 'HEALTHY' | 'DIVERGENT' | 'COLLAPSING'

export interface ConsistencyReport {
  /** 整体状态 */
  status: ConsistencyStatus
  /** 分歧率 0-1（graph vs scorer 不一致的比例） */
  divergenceRate: number
  /** 分歧详细信息 */
  divergences: Array<{
    /** 分歧类型 */
    type: 'type_mismatch' | 'mode_mismatch' | 'confidence_gap'
    /** scorer 侧值 */
    scorerValue: string
    /** graph 侧值 */
    graphValue: string
    /** 严重程度 0-1 */
    severity: number
  }>
  /** ontology 熵信息 */
  ontologyHealth: {
    /** canonical 动作类型的 entropy */
    typeEntropy: number
    /** canonical 模式的 entropy */
    modeEntropy: number
    /** 是否检测到 collapse */
    collapsed: boolean
    /** collapse 信号详情 */
    collapseSignal?: string
  }
  /** 强制决策审计 */
  forcedDecisionAudit: {
    /** 总决策数 */
    total: number
    /** PATH_FORCED 数 */
    forced: number
    /** BLOCKED 数 */
    blocked: number
    /** 自然一致数 */
    naturalAgreement: number
    /** 强制决策比例 */
    forcedRatio: number
  }
  /** 信息损失检查 */
  informationLoss: {
    /** 是否丢失 lockedNodes 信息 */
    lostLockedNodes: boolean
    /** 是否丢失 graph path 信息 */
    lostGraphPath: boolean
    /** 是否丢失 score 分布信息 */
    lostScoreDistribution: boolean
  }
  /** 可读摘要 */
  summary: string
}

// ─── 熵计算 ────────────────────────────────────────────

function entropy(values: string[]): number {
  if (values.length === 0) return 0
  const freq = new Map<string, number>()
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)

  let H = 0
  const n = values.length
  for (const count of freq.values()) {
    const p = count / n
    H -= p * Math.log2(p)
  }
  return H
}

// ─── 冲突检测 ─────────────────────────────────────────

function detectCanonicalCollapse(
  typeEntropy: number,
  modeEntropy: number,
  forcedRatio: number,
): { collapsed: boolean; signal?: string } {
  // 低 entropy + 高 forced = over-normalization 信号
  if (typeEntropy < 0.5 && modeEntropy < 0.5) {
    return {
      collapsed: true,
      signal: `type_entropy=${typeEntropy.toFixed(2)} mode_entropy=${modeEntropy.toFixed(2)} — 两者同时低，可能语义坍缩`,
    }
  }
  if (forcedRatio > 0.5) {
    return {
      collapsed: true,
      signal: `forced_ratio=${(forcedRatio * 100).toFixed(0)}% — 超半数为强制决策，仲裁可能过强`,
    }
  }
  return { collapsed: false }
}

// ─── 信息损失检查 ─────────────────────────────────────

function checkInformationLoss(
  scorer: QualityDecision,
  graph: GraphLaneDecision | null,
  canonicalScorer: CanonicalAction,
  canonicalGraph: CanonicalAction | null,
): ConsistencyReport['informationLoss'] {
  const lostLockedNodes = !!(canonicalGraph?.metadata.lockedNodes_orig === undefined && graph?.lockedNodes.length)
  const lostGraphPath = !!(canonicalGraph?.metadata.graphPath_orig === undefined && graph?.chosenPath.length)
  const lostScoreDistribution = !!(canonicalScorer.metadata.score_orig === undefined && scorer.triggerScore !== undefined)

  return {
    lostLockedNodes,
    lostGraphPath,
    lostScoreDistribution,
  }
}

// ─── 主函数 ────────────────────────────────────────────

export function checkDecisionConsistency(
  scorer: QualityDecision,
  graph: GraphLaneDecision | null,
  fusion: CanonicalFusionResult,
): ConsistencyReport {
  const divergences: ConsistencyReport['divergences'] = []

  const canonicalScorer = normalizeScorerAction(scorer)
  const canonicalGraph = graph ? normalizeGraphAction(graph) : null

  // ── Divergence detection ──

  if (canonicalGraph) {
    // Type mismatch
    if (canonicalScorer.type !== canonicalGraph.type) {
      divergences.push({
        type: 'type_mismatch',
        scorerValue: canonicalScorer.type,
        graphValue: canonicalGraph.type,
        severity: 0.7,
      })
    }

    // Mode mismatch
    if (canonicalScorer.mode !== canonicalGraph.mode) {
      divergences.push({
        type: 'mode_mismatch',
        scorerValue: canonicalScorer.mode,
        graphValue: canonicalGraph.mode,
        severity: 0.5,
      })
    }

    // Confidence gap
    const gap = Math.abs(canonicalScorer.confidence - canonicalGraph.confidence)
    if (gap > 0.3) {
      divergences.push({
        type: 'confidence_gap',
        scorerValue: canonicalScorer.confidence.toFixed(2),
        graphValue: canonicalGraph.confidence.toFixed(2),
        severity: Math.round(gap * 100) / 100,
      })
    }
  }

  // ── Ontology health ──

  const allTypes: string[] = [canonicalScorer.type]
  if (canonicalGraph) allTypes.push(canonicalGraph.type)
  const typeEntropy = entropy(allTypes)

  const allModes: string[] = [canonicalScorer.mode]
  if (canonicalGraph) allModes.push(canonicalGraph.mode)
  const modeEntropy = entropy(allModes)

  // ── Forced decision audit ──

  const forced = ((canonicalGraph?.mode === 'PATH_FORCED') ? 1 : 0)
  const blocked = ((canonicalGraph?.mode === 'BLOCKED') ? 1 : 0)
  const naturalAgreement = fusion.agreement && !forced && !blocked ? 1 : 0
  const forcedRatio = forced ? 1 : 0

  const ontologyHealth = detectCanonicalCollapse(typeEntropy, modeEntropy, forcedRatio)

  // ── Information loss ──

  const infoLoss = checkInformationLoss(scorer, graph, canonicalScorer, canonicalGraph)

  // ── 状态判定 ──

  const divergenceRate = divergences.length > 0
    ? Math.round((divergences.reduce((s, d) => s + d.severity, 0) / divergences.length) * 100) / 100
    : 0

  let status: ConsistencyStatus = 'HEALTHY'
  if (ontologyHealth.collapsed || infoLoss.lostLockedNodes || infoLoss.lostGraphPath) {
    status = 'COLLAPSING'
  } else if (divergenceRate > 0.5 || forcedRatio > 0.5) {
    status = 'DIVERGENT'
  }

  const total = 1 + (graph ? 1 : 0)

  const report: ConsistencyReport = {
    status,
    divergenceRate,
    divergences,
    ontologyHealth: {
      typeEntropy: Math.round(typeEntropy * 1000) / 1000,
      modeEntropy: Math.round(modeEntropy * 1000) / 1000,
      collapsed: ontologyHealth.collapsed,
      collapseSignal: ontologyHealth.signal,
    },
    forcedDecisionAudit: {
      total,
      forced,
      blocked,
      naturalAgreement,
      forcedRatio: Math.round(forcedRatio * 100) / 100,
    },
    informationLoss: infoLoss,
    summary: buildSummary(status, divergenceRate, ontologyHealth, forcedRatio, total),
  }

  return report
}

// ─── 摘要构建 ──────────────────────────────────────────

function buildSummary(
  status: ConsistencyStatus,
  divergenceRate: number,
  ontologyHealth: { collapsed: boolean; signal?: string },
  forcedRatio: number,
  totalScenarios: number,
): string {
  const statusLabel = status === 'COLLAPSING' ? '⚠️ COLLAPSING' : status === 'DIVERGENT' ? '⚠️ DIVERGENT' : '✅ HEALTHY'

  const parts: string[] = [
    statusLabel,
    `divergence=${(divergenceRate * 100).toFixed(0)}%`,
    `forced=${(forcedRatio * 100).toFixed(0)}%`,
  ]

  if (ontologyHealth.collapsed) {
    parts.push('COLLAPSE_DETECTED')
  }

  return `[DCVL] ${statusLabel}: divergence=${(divergenceRate * 100).toFixed(0)}% forced/blocked=${(forcedRatio * 100).toFixed(0)}% scenarios=${totalScenarios} ${ontologyHealth.collapsed ? '| ⚠️ ONTOLOGY COLLAPSE: ' + ontologyHealth.signal : ''}`
}
