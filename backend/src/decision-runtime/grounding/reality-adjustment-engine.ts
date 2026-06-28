/**
 * reality-adjustment-engine.ts — Phase A-3.2 Reality Grounding Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * RealityAdjustmentEngine — 现实调整引擎
 * ═══════════════════════════════════════════════════════════════
 *
 * 核心契约：
 *
 *   1. 永远输出 AdjustedScoreCard，不会返回 null
 *   2. 调整逻辑必须可预测（相同输入 → 相同调整幅度）
 *   3. 调整幅度受 MAX_ADJUSTMENT_RATIO 约束（最大 ±25%）
 *   4. 调整量必须 ≤ MAX_ADJUSTMENT_RATIO × 原始分
 *   5. 若信号过期/不可靠，调整幅度对应衰减
 *   6. 标记 adjustedAt 和 adjustmentReason 供审计追溯
 *
 * 调整规则：
 *   调整量 = 偏差 × 信号可信度 × 衰减因子 × 敏感度
 *
 *   - 偏差越大，调整越大
 *   - 信号越可靠，调整越大
 *   - 信号越旧，调整越小
 *   - 敏感度越低，调整越小
 *
 * 安全机制：
 *   - maxAdjustmentRatio: 0.25 确保单次调整不超过 ±25%
 *   - 若用户明确配置 "useRawScore: true"，则所有调整为 0
 */

import type { EvaluationScoreCard } from '../cognition/evaluation-schema.js'
import type { GroundingSignal, DriftAssessment } from './index.js'
import { assessDrift } from './drift-detector.js'

// ============================================================
// 1. 常量
// ============================================================

/** 单次调整最大比例（±25%） */
export const MAX_ADJUSTMENT_RATIO = 0.25

/** 敏感度映射（信号当局级别 → 敏感度系数） */
const AUTHORITY_SENSITIVITY_MAP: Record<string, number> = {
  AUTHORIZED: 1.0, // 权威数据全量采纳
  AGGREGATED: 0.7, // 聚合数据适度采纳
  SAMPLED: 0.4,    // 采样数据保守采纳
  ESTIMATE: 0.15,  // 估算数据谨慎采纳
}

// ============================================================
// 2. 调整后的评分卡
// ============================================================

export interface AdjustmentRecord {
  /** 原始评分（调整前） */
  originalScore: number
  /** 调整后评分 */
  adjustedScore: number
  /** 调整幅度（绝对值） */
  adjustmentDelta: number
  /** 调整幅度（相对原始分） */
  adjustmentRatio: number
  /** 调整时间戳 */
  adjustedAt: number
  /** 调整原因描述 */
  adjustmentReason: string
  /** 涉及的信号 ID 列表 */
  signalIds: string[]
  /** 偏差评估（若有） */
  driftAssessment?: DriftAssessment
}

export interface AdjustedScoreCard {
  /** 原始评分卡（不做修改） */
  original: EvaluationScoreCard
  /** 调整后的总评分 */
  adjustedTotal: number
  /** 每个轴的调整后评分 */
  adjustedAxes: Array<{
    axisName: string
    originalScore: number
    adjustedScore: number
    adjustmentDelta: number
  }>
  /** 调整记录 */
  adjustments: AdjustmentRecord[]
  /** 是否被调整过 */
  wasAdjusted: boolean
  /** 原始总评分 */
  originalTotal: number
  /** 调整后的总评分 */
  total: number
}

// ============================================================
// 3. 调整引擎配置
// ============================================================

export interface AdjustmentConfig {
  /** 最大调整比例（默认 0.25） */
  maxAdjustmentRatio?: number
  /** 是否使用原始评分（跳过调整） */
  useRawScore?: boolean
}

// ============================================================
// 4. 调整引擎
// ============================================================

export interface RealityAdjustmentEngine {
  /**
   * 根据现实信号调整评分
   *
   * 输入：
   *   - scoreCard: 系统生成的评分
   *   - signals:   可信的现实信号列表
   *
   * 输出：
   *   - AdjustedScoreCard（永远不会是 null）
   *
   * 若无信号可用，返回 adjustedTotal = originalTotal
   */
  adjust(
    scoreCard: EvaluationScoreCard,
    signals: GroundingSignal[],
    config?: AdjustmentConfig,
  ): AdjustedScoreCard

  /**
   * 根据偏差评估调整评分
   */
  adjustWithDrift(
    scoreCard: EvaluationScoreCard,
    drifts: DriftAssessment[],
    config?: AdjustmentConfig,
  ): AdjustedScoreCard
}

// ============================================================
// 5. 默认实现
// ============================================================

export function createRealityAdjustmentEngine(): RealityAdjustmentEngine {
  function computeAdjustment(
    originalScore: number,
    signals: GroundingSignal[],
    maxRatio: number,
  ): { adjustmentDelta: number; signalIds: string[]; driftAssessment?: DriftAssessment; reason: string } {
    if (signals.length === 0) {
      return { adjustmentDelta: 0, signalIds: [], reason: '无信号可用，不做调整' }
    }

    // 使用可信度最高的信号做基准调校
    const sorted = [...signals].sort((a, b) => b.reliability - a.reliability)
    const primarySignal = sorted[0]

    // 偏差评估
    const drift = assessDrift({
      systemScore: originalScore,
      baselineValue: primarySignal.value,
      signalName: primarySignal.name,
      signalReliability: primarySignal.reliability,
    })

    // 敏感度系数
    const sensitivity = AUTHORITY_SENSITIVITY_MAP[primarySignal.authority] ?? 0.5

    // 调整幅度 = 相对偏差 × 信号可信度 × 敏感度
    let adjustmentDelta = drift.relativeDrift * primarySignal.reliability * sensitivity

    // 剪切：禁止超过 maxRatio
    const maxDelta = originalScore * maxRatio
    adjustmentDelta = Math.min(adjustmentDelta, maxDelta)
    adjustmentDelta = Math.max(adjustmentDelta, -maxDelta)

    // 调整方向：系统分高=正偏差→下调，系统分低=负偏差→上调
    if (originalScore > primarySignal.value) {
      adjustmentDelta = -Math.abs(adjustmentDelta)
    } else {
      adjustmentDelta = Math.abs(adjustmentDelta)
    }

    const signalIds = signals.map(s => s.id)

    return {
      adjustmentDelta,
      signalIds,
      driftAssessment: drift,
      reason: `依据"${primarySignal.name}"（可信度 ${(primarySignal.reliability * 100).toFixed(0)}%）调整 ${adjustmentDelta >= 0 ? '+' : ''}${adjustmentDelta.toFixed(2)}`,
    }
  }

  function adjust(
    scoreCard: EvaluationScoreCard,
    signals: GroundingSignal[],
    config?: AdjustmentConfig,
  ): AdjustedScoreCard {
    const maxRatio = config?.maxAdjustmentRatio ?? MAX_ADJUSTMENT_RATIO

    if (config?.useRawScore) {
      return createIdentityAdjusted(scoreCard, '原始评分模式，跳过调整')
    }

    const axisAdjustments = scoreCard.axes.map(ax => {
      const result = computeAdjustment(ax.score, signals, maxRatio)
      return {
        axisName: ax.axisName,
        originalScore: ax.score,
        adjustedScore: ax.score + result.adjustmentDelta,
        adjustmentDelta: result.adjustmentDelta,
      }
    })

    // 轴级调整记录
    const axisRecords: AdjustmentRecord[] = axisAdjustments.map(adj => {
      const result = computeAdjustment(adj.originalScore, signals, maxRatio)
      return {
        originalScore: adj.originalScore,
        adjustedScore: adj.adjustedScore,
        adjustmentDelta: adj.adjustmentDelta,
        adjustmentRatio: adj.originalScore > 0 ? Math.abs(adj.adjustmentDelta) / adj.originalScore : 0,
        adjustedAt: Date.now(),
        adjustmentReason: result.reason,
        signalIds: result.signalIds,
        driftAssessment: result.driftAssessment,
      }
    })

    // 总评分调整（直接计算，不求和轴级）
    const totalResult = computeAdjustment(scoreCard.total, signals, maxRatio)
    const adjustedTotal = scoreCard.total + totalResult.adjustmentDelta

    const wasAdjusted = axisRecords.some(r => Math.abs(r.adjustmentDelta) > 0)

    return {
      original: scoreCard,
      adjustedTotal,
      adjustedAxes: axisAdjustments,
      adjustments: axisRecords,
      wasAdjusted,
      originalTotal: scoreCard.total,
      total: adjustedTotal,
    }
  }

  function adjustWithDrift(
    scoreCard: EvaluationScoreCard,
    drifts: DriftAssessment[],
    config?: AdjustmentConfig,
  ): AdjustedScoreCard {
    if (config?.useRawScore) {
      return createIdentityAdjusted(scoreCard, '原始评分模式，跳过调整')
    }

    const maxRatio = config?.maxAdjustmentRatio ?? MAX_ADJUSTMENT_RATIO

    const axisAdjustments = scoreCard.axes.map(ax => {
      // 找与该轴名称匹配的偏差评估
      const relevantDrift = drifts.find(d => d.signalName.includes(ax.axisName))

      let adjustmentDelta = 0
      let driftAssessment: DriftAssessment | undefined

      if (relevantDrift) {
        driftAssessment = relevantDrift
        const sensitivity = 0.6 // 基于偏差的中等敏感度
        adjustmentDelta = relevantDrift.relativeDrift * relevantDrift.signalReliability * sensitivity

        const maxDelta = ax.score * maxRatio
        adjustmentDelta = Math.min(adjustmentDelta, maxDelta)
        adjustmentDelta = Math.max(adjustmentDelta, -maxDelta)

        if (ax.score > relevantDrift.baselineValue) {
          adjustmentDelta = -Math.abs(adjustmentDelta)
        } else {
          adjustmentDelta = Math.abs(adjustmentDelta)
        }
      }

      return {
        axisName: ax.axisName,
        originalScore: ax.score,
        adjustedScore: ax.score + adjustmentDelta,
        adjustmentDelta,
      }
    })

    const totalResult = computeAdjustment(scoreCard.total, [], maxRatio)
    const adjustedTotal = scoreCard.total + (totalResult.adjustmentDelta !== 0 ? totalResult.adjustmentDelta : 0)

    const wasAdjusted = axisAdjustments.some(a => Math.abs(a.adjustmentDelta) > 0)

    return {
      original: scoreCard,
      adjustedTotal,
      adjustedAxes: axisAdjustments,
      adjustments: [],
      wasAdjusted,
      originalTotal: scoreCard.total,
      total: adjustedTotal,
    }
  }

  return { adjust, adjustWithDrift }
}

// ============================================================
// 6. 内部工具
// ============================================================

function createIdentityAdjusted(scoreCard: EvaluationScoreCard, reason: string): AdjustedScoreCard {
  const now = Date.now()
  const identityRecord: AdjustmentRecord = {
    originalScore: scoreCard.total,
    adjustedScore: scoreCard.total,
    adjustmentDelta: 0,
    adjustmentRatio: 0,
    adjustedAt: now,
    adjustmentReason: reason,
    signalIds: [],
  }

  return {
    original: scoreCard,
    adjustedTotal: scoreCard.total,
    adjustedAxes: scoreCard.axes.map(ax => ({
      axisName: ax.axisName,
      originalScore: ax.score,
      adjustedScore: ax.score,
      adjustmentDelta: 0,
    })),
    adjustments: [identityRecord],
    wasAdjusted: false,
    originalTotal: scoreCard.total,
    total: scoreCard.total,
  }
}
