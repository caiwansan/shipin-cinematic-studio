/**
 * grounding-integration.ts — Phase A-3.2 Reality Grounding Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * GroundingIntegration — Runtime 与现实锚定层的集成入口
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义 GroundingLayer 的顶层集成接口。
 * 它不修改任何已有结构，只在 Runtime 的 pipeline 中插入一个
 * "现实锚定"步骤——在 ScoringAgent 之后、RecommendationAgent 之前。
 *
 * 集成原则：
 *   1. Grounding Step 是可选步骤（若无信号，直接跳过）
 *   2. Grounding Step 不会抛出异常
 *   3. Grounding Step 的记录进入 Trace
 */

import type { EvaluationScoreCard } from '../cognition/evaluation-schema.js'
import type { GroundingSignal } from './grounding-signal.js'
import type { DriftAssessment, AggregatedDrift } from './drift-detector.js'
import type { AdjustedScoreCard, RealityAdjustmentEngine } from './reality-adjustment-engine.js'
import type { DriftLogger, HistoricalBaseline } from './drift-logger.js'
import { createRealityAdjustmentEngine } from './reality-adjustment-engine.js'
import { createDriftLogger } from './drift-logger.js'
import { aggregateDrifts } from './drift-detector.js'

// ============================================================
// 1. Grounding Pipeline Result
// ============================================================

export interface GroundingResult {
  /** 调整后的评分卡 */
  adjusted: AdjustedScoreCard

  /** 使用的信号列表 */
  signalsUsed: GroundingSignal[]

  /** 偏差评估明细 */
  driftAssessments: DriftAssessment[]

  /** 聚合偏差 */
  aggregatedDrift: AggregatedDrift

  /** 历史基线 */
  historicalBaseline: HistoricalBaseline
}

// ============================================================
// 2. Grounding Layer 集成接口
// ============================================================

export interface GroundingLayer {
  /**
   * 对整个评分列表执行现实锚定
   *
   * 输入：SystemScoreCard[]（来自 ScoringAgent）
   * 输出：AdjustedScoreCard[]（传到 RecommendationAgent）
   *
   * 若无信号，原样返回（wasAdjusted = false）
   */
  ground(
    scoreCards: EvaluationScoreCard[],
    signals: GroundingSignal[],
    context: {
      traceId: string
      requirement: string
      domain: string
    },
  ): GroundingResult[]

  /**
   * 获取历史基线统计
   */
  getBaseline(): HistoricalBaseline
}

// ============================================================
// 3. 默认实现
// ============================================================

export function createGroundingLayer(
  engine?: RealityAdjustmentEngine,
  logger?: DriftLogger,
): GroundingLayer {
  const adjustmentEngine = engine ?? createRealityAdjustmentEngine()
  const driftLogger = logger ?? createDriftLogger()

  function ground(
    scoreCards: EvaluationScoreCard[],
    signals: GroundingSignal[],
    context: {
      traceId: string
      requirement: string
      domain: string
    },
  ): GroundingResult[] {
    return scoreCards.map(scoreCard => {
      // 调整评分
      const adjusted = adjustmentEngine.adjust(scoreCard, signals)

      // 收集偏差评估
      const driftAssessments = adjusted.adjustments
        .filter(a => a.driftAssessment)
        .map(a => a.driftAssessment!)

      // 聚合偏差
      const aggregatedDrift = aggregateDrifts(driftAssessments)

      // 记录到日志
      adjusted.adjustments.forEach(adj => {
        if (adj.driftAssessment) {
          driftLogger.record({
            traceId: context.traceId,
            requirement: context.requirement,
            domain: context.domain,
            axisName: adj.driftAssessment.signalName,
            systemScore: adj.originalScore,
            assessment: adj.driftAssessment,
            aggregated: aggregatedDrift,
          })
        }
      })

      // 历史基线
      const historicalBaseline = driftLogger.getBaseline({
        domain: context.domain,
      })

      return {
        adjusted,
        signalsUsed: signals,
        driftAssessments,
        aggregatedDrift,
        historicalBaseline,
      }
    })
  }

  function getBaseline(): HistoricalBaseline {
    return driftLogger.getBaseline()
  }

  return { ground, getBaseline }
}
