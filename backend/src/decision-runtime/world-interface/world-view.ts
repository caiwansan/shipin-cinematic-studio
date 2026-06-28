/**
 * WorldView — Phase A-4 Decision World Interface Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * WorldView — 世界视图
 * ═══════════════════════════════════════════════════════════════
 *
 * WorldView 是"在给定时间点，系统对现实世界的快照理解的抽象"。
 *
 * 它不是一个简单的实体列表+信号列表——
 * 它是系统的"现实认知状态"，包含：
 *   1. 已知实体（见过的世界事物）
 *   2. 观测信号（对这些实体的数据量）
 *   3. 完整度（对现实认知的覆盖度）
 *   4. 新鲜度（数据最新程度）
 *   5. 偏差声明（已知的观测偏差）
 *
 * 哲学：
 *   WorldView 不是现实世界本身，而是系统对世界的"当前最佳理解"。
 *   它一定是片面的、不完整的、有偏的——但系统必须知道自己的局限。
 *
 * 宪法约束：
 *   1. WorldView 必须在每次决策开始时被创建
 *   2. WorldView 创建后不可变（immutable）
 *   3. 每次决策拥有独立的 WorldView（不跨决策共享）
 *   4. WorldView 必须附带 freshness 和 completeness 声明
 *   5. completeness < 0.6 时，系统必须在报告中标注 "数据不完整"
 *
 * @phase decision-runtime
 */

import type { WorldEntity } from './world-entity.js'
import type { WorldSignal } from './world-signal.js'

// ============================================================
// 1. 偏差声明
// ============================================================

export interface BiasDeclaration {
  /** 偏差类型 */
  type: BiasType

  /** 偏差描述 */
  description: string

  /** 偏差严重度 [0, 1] */
  severity: number

  /** 受影响的数据源 */
  affectedSources: string[]
}

export enum BiasType {
  /** 采样偏差 — 数据只覆盖了部分群体 */
  SAMPLING_BIAS = 'SAMPLING_BIAS',
  /** 用户偏差 — 评论/评价由自我选择用户产生 */
  USER_SELECTION_BIAS = 'USER_SELECTION_BIAS',
  /** 时间偏差 — 数据过时 */
  TEMPORAL_BIAS = 'TEMPORAL_BIAS',
  /** 地域偏差 — 数据只覆盖特定区域 */
  GEOGRAPHIC_BIAS = 'GEOGRAPHIC_BIAS',
  /** 来源偏差 — 数据来自单一来源 */
  SOURCE_BIAS = 'SOURCE_BIAS',
  /** 观测缺失 — 对某些属性完全没有数据 */
  OBSERVATION_GAP = 'OBSERVATION_GAP',
}

// ============================================================
// 2. 世界视图
// ============================================================

export interface WorldView {
  /** 视图 ID */
  id: string

  /** 视图创建时间 */
  createdAt: number

  /** 视图快照的时间范围 */
  timeRange: {
    /** 最早信号时间 */
    earliestSignal: number
    /** 最新信号时间 */
    latestSignal: number
  }

  /** 本次决策涵盖的实体列表 */
  entities: WorldEntity[]

  /** 本次决策收集的信号列表 */
  signals: WorldSignal[]

  /** 完整度 [0, 1] — 对目标领域的信息覆盖度 */
  completeness: number

  /** 新鲜度 [0, 1] — 信号的平均新鲜程度 */
  freshness: number

  /** 已知偏差列表 */
  biases: BiasDeclaration[]

  /** 数据源覆盖统计 */
  sourceCoverage: Array<{
    source: string
    signalCount: number
    freshness: number
  }>

  /** 实体的信号密度（信号总数/实体数） */
  signalDensity: number

  /** 视图生成方式 */
  generation: 'system' | 'manual' | 'hybrid'
}

// ============================================================
// 3. 世界视图构建函数
// ============================================================

export function createWorldView(params: {
  id: string
  entities: WorldEntity[]
  signals: WorldSignal[]
  biases?: BiasDeclaration[]
  generation?: WorldView['generation']
}): WorldView {
  const now = Date.now()

  // 计算时间范围
  const timestamps = params.signals.map(s => s.observedAt)
  const earliest = timestamps.length > 0 ? Math.min(...timestamps) : now
  const latest = timestamps.length > 0 ? Math.max(...timestamps) : now

  // 计算新鲜度
  const freshness = timestamps.length > 0
    ? timestamps.reduce((sum, t) => sum + Math.max(0, 1 - (now - t) / (30 * 86400 * 1000)), 0) / timestamps.length
    : 0

  // 计算完整度（当前简化实现：信号覆盖了多少"可能的属性"）
  const completeness = params.entities.length > 0
    ? Math.min(1, params.signals.length / (params.entities.length * 5)) // 每个实体至少 5 条信号算完整
    : 0

  // 数据源覆盖统计
  const sourceMap = new Map<string, { count: number; timestamps: number[] }>()
  for (const s of params.signals) {
    const entry = sourceMap.get(s.source) ?? { count: 0, timestamps: [] }
    entry.count++
    entry.timestamps.push(s.observedAt)
    sourceMap.set(s.source, entry)
  }

  const sourceCoverage = Array.from(sourceMap.entries()).map(([source, data]) => ({
    source,
    signalCount: data.count,
    freshness: data.timestamps.reduce((sum, t) => sum + Math.max(0, 1 - (now - t) / (30 * 86400 * 1000)), 0) / data.timestamps.length,
  }))

  // 信号密度
  const signalDensity = params.entities.length > 0
    ? params.signals.length / params.entities.length
    : 0

  return {
    id: params.id,
    createdAt: now,
    timeRange: { earliestSignal: earliest, latestSignal: latest },
    entities: params.entities,
    signals: params.signals,
    completeness,
    freshness,
    biases: params.biases ?? [],
    sourceCoverage,
    signalDensity,
    generation: params.generation ?? 'system',
  }
}

// ============================================================
// 4. 已知偏差自动检测
// ============================================================

/**
 * 从 WorldView 的信号集中自动检测已知偏差
 *
 * 检测规则（确定性）：
 *   1. 若只有 1 个数据源 → SOURCE_BIAS
 *   2. 若全是用户生成内容 → USER_SELECTION_BIAS
 *   3. 若信号全部在 30 天前 → TEMPORAL_BIAS
 *   4. 若信号数 < 实体数 × 3 → OBSERVATION_GAP
 */
export function detectBiases(view: WorldView): BiasDeclaration[] {
  const biases: BiasDeclaration[] = []

  // 来源偏差
  if (view.sourceCoverage.length === 1) {
    biases.push({
      type: BiasType.SOURCE_BIAS,
      description: `全部数据来自单一来源: ${view.sourceCoverage[0].source}`,
      severity: 0.4,
      affectedSources: [view.sourceCoverage[0].source],
    })
  }

  // 时间偏差
  if (view.freshness < 0.3) {
    biases.push({
      type: BiasType.TEMPORAL_BIAS,
      description: '信号老化严重，新鲜度不足 0.3',
      severity: 0.6,
      affectedSources: view.sourceCoverage.map(s => s.source),
    })
  }

  // 观测缺失
  if (view.completeness < 0.6) {
    biases.push({
      type: BiasType.OBSERVATION_GAP,
      description: `数据覆盖不完整 (completeness=${view.completeness.toFixed(2)})，每个实体平均 ${view.signalDensity.toFixed(1)} 条信号`,
      severity: 1 - view.completeness,
      affectedSources: view.sourceCoverage.map(s => s.source),
    })
  }

  return biases
}
