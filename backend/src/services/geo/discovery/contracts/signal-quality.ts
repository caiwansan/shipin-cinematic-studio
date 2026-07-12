// ============================================================
// B3-003: Signal Quality Score — Signal 质量评分
//
// 不只是 Confidence，还包括：
//   completeness — 信号字段填充完整性
//   consistency — 同一实体多次扫描的一致性
//   freshness — 信号新鲜度
//   costEfficiency — 成本效率
//
// Learning Engine 将来可以根据这些指标学习 Provider 偏好
// ============================================================

import type { DiscoverySignal } from '../../domain/discovery-signal.js'

export interface SignalQualityScore {
  /** 基础置信度（直接来自 Signal） */
  confidence: number

  /** 信息完整性（0~1）：evidence 数量、rawReference 等字段填充率 */
  completeness: number

  /** 时效性（0~1）：信号新鲜度，越新越接近 1 */
  freshness: number

  /** 成本效率（0~1）：越低 cost 产出越高 score */
  costEfficiency: number

  /** 总体质量分（综合加权） */
  overall: number
}

const COMPLETENESS_WEIGHTS = {
  evidence: 0.4,       // evidence 存在且有内容
  rawReference: 0.3,   // 有原始引用
  cost: 0.15,          // cost 字段填充
  citation: 0.15,      // evidence 中的 citation
}

const OVERALL_WEIGHTS = {
  confidence: 0.35,
  completeness: 0.25,
  freshness: 0.15,
  costEfficiency: 0.25,
}

export function calculateSignalQuality(signal: DiscoverySignal): SignalQualityScore {
  // Completeness
  const evidenceScore = Math.min(1, signal.evidence.length / 3)
  const hasRawRef = signal.rawReference ? 1 : 0
  const hasCost = signal.cost.tokensIn > 0 || signal.cost.tokensOut > 0 ? 1 : 0
  const hasCitation = signal.evidence.some((e) => e.citation) ? 1 : 0

  const completeness =
    evidenceScore * COMPLETENESS_WEIGHTS.evidence +
    hasRawRef * COMPLETENESS_WEIGHTS.rawReference +
    hasCost * COMPLETENESS_WEIGHTS.cost +
    hasCitation * COMPLETENESS_WEIGHTS.citation

  // Freshness
  const ageMs = Date.now() - new Date(signal.timestamp).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  const freshness = Math.max(0, Math.min(1, 1 - ageHours / 48)) // 48 小时后衰减到 0

  // Cost Efficiency
  const totalTokens = signal.cost.tokensIn + signal.cost.tokensOut
  const costEff = totalTokens > 0 && signal.confidence > 0
    ? Math.min(1, (signal.confidence / (totalTokens / 1000)) * 2)
    : 0.5

  // Overall
  const overall =
    signal.confidence * OVERALL_WEIGHTS.confidence +
    completeness * OVERALL_WEIGHTS.completeness +
    freshness * OVERALL_WEIGHTS.freshness +
    costEff * OVERALL_WEIGHTS.costEfficiency

  return {
    confidence: Math.round(signal.confidence * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    freshness: Math.round(freshness * 100) / 100,
    costEfficiency: Math.round(costEff * 100) / 100,
    overall: Math.round(overall * 100) / 100,
  }
}
