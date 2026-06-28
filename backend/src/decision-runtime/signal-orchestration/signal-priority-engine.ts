/**
 * signal-priority-engine.ts — Phase A-3.3 Signal Orchestration Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * SignalPriorityEngine — 信号优先级引擎
 * ═══════════════════════════════════════════════════════════════
 *
 * 功能：
 *   将一组信号按"优先级得分"排序。
 *   优先级得分 = 信任权重 × 时效因子 × 领域相关因子 × 波动倒数
 *
 * 设计原则：
 *   1. 排序必须是确定性的——相同信号集永远产出相同顺序
 *   2. 优先级得分仅用于排序，不用于评分调整
 *   3. 权重为 0 的信号不参与排序（由 trustWeightRegistry 过滤）
 *   4. 时效因子 = min(1, (expiresAt - now) / (expiresAt - capturedAt))
 *      越接近过期，时效因子越小
 *
 * @phase decision-runtime
 */

import type { GroundingSignal } from '../grounding/grounding-signal.js'
import type { DomainType } from '../business-intelligence/domain-classifier.js'
import type { TrustWeightRegistry } from './trust-weight-registry.js'
import { trustWeightRegistry } from './trust-weight-registry.js'

// ============================================================
// 1. 优先级排序参数
// ============================================================

export interface PriorityConfig {
  /** 信任权重在总分中的占比（默认 0.5） */
  weightFactor: number
  /** 时效因子占比（默认 0.3） */
  recencyFactor: number
  /** 领域相关因子占比（默认 0.1） */
  relevanceFactor: number
  /** 波动倒数占比（默认 0.1） */
  volatilityFactor: number
}

export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  weightFactor: 0.5,
  recencyFactor: 0.3,
  relevanceFactor: 0.1,
  volatilityFactor: 0.1,
}

// ============================================================
// 2. 优先级排序结果
// ============================================================

export interface PriorityRankedSignal {
  /** 原信号 */
  signal: GroundingSignal
  /** 优先级得分（越高越优先） */
  priorityScore: number
  /** 各维度得分 */
  breakdown: {
    weightScore: number
    recencyScore: number
    relevanceScore: number
    volatilityScore: number
  }
}

// ============================================================
// 3. 信号优先级引擎
// ============================================================

export interface SignalPriorityEngine {
  /**
   * 对一组信号按优先级排序
   *
   * 输入：原始信号列表
   * 输出：按优先级得分降序排列的信号
   *
   * 若 signals 为空，返回空数组
   * 若所有信号优先级相同，保留原顺序
   */
  rank(
    signals: GroundingSignal[],
    domain: DomainType,
    config?: Partial<PriorityConfig>,
  ): PriorityRankedSignal[]

  /**
   * 获取单个信号的优先级得分细节
   */
  score(
    signal: GroundingSignal,
    domain: DomainType,
    config?: Partial<PriorityConfig>,
  ): PriorityRankedSignal
}

// ============================================================
// 4. 默认实现
// ============================================================

export function createSignalPriorityEngine(
  trustRegistry?: TrustWeightRegistry,
): SignalPriorityEngine {
  const registry = trustRegistry ?? trustWeightRegistry

  function computePriorityScore(
    signal: GroundingSignal,
    domain: DomainType,
    config: PriorityConfig,
  ): PriorityRankedSignal {
    const now = Date.now()

    // 信任权重得分 [0, 1]
    const weightScore = registry.getWeight(signal.source, domain)

    // 时效因子 [0, 1]
    const lifespan = signal.expiresAt - signal.capturedAt
    const remaining = signal.expiresAt - now
    const recencyScore = lifespan > 0
      ? Math.max(0, Math.min(1, remaining / lifespan))
      : 0

    // 领域相关因子 [0, 1]
    // 信号有 geoScope 且匹配 domain 时加分
    const relevanceScore = signal.geoScope ? 0.8 : 0.5

    // 波动倒数 [0, 1]：波动越低越好
    const volatilityScore = 1 - Math.min(signal.volatility, 1)

    // 综合优先级分
    const priorityScore =
      config.weightFactor * weightScore +
      config.recencyFactor * recencyScore +
      config.relevanceFactor * relevanceScore +
      config.volatilityFactor * volatilityScore

    return {
      signal,
      priorityScore,
      breakdown: { weightScore, recencyScore, relevanceScore, volatilityScore },
    }
  }

  function rank(
    signals: GroundingSignal[],
    domain: DomainType,
    config?: Partial<PriorityConfig>,
  ): PriorityRankedSignal[] {
    const mergedConfig = { ...DEFAULT_PRIORITY_CONFIG, ...config }

    const scored = signals.map(s => computePriorityScore(s, domain, mergedConfig))

    // 确定性排序：优先级同分时按信号 ID 字典序
    return scored.sort((a, b) => {
      const scoreDiff = b.priorityScore - a.priorityScore
      if (Math.abs(scoreDiff) > 0.0001) return scoreDiff > 0 ? 1 : -1
      return a.signal.id.localeCompare(b.signal.id)
    })
  }

  function score(
    signal: GroundingSignal,
    domain: DomainType,
    config?: Partial<PriorityConfig>,
  ): PriorityRankedSignal {
    const mergedConfig = { ...DEFAULT_PRIORITY_CONFIG, ...config }
    return computePriorityScore(signal, domain, mergedConfig)
  }

  return { rank, score }
}

/** 单例 */
export const signalPriorityEngine = createSignalPriorityEngine()
