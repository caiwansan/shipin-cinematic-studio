/**
 * conflict-resolver.ts — Phase A-3.3 Signal Orchestration Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * ConflictResolver — 冲突解决器
 * ═══════════════════════════════════════════════════════════════
 *
 * 冲突类型：
 *   1. VERTICAL — 同一类型信号的数值差异（如：链家 vs 贝壳 vs 安居客的房价）
 *   2. HORIZONTAL — 不同轴信号之间的语义冲突（如：医疗质量评分 vs 患者评价）
 *   3. TEMPORAL — 时间导致的冲突（如：2025 Q1 vs 2025 Q4 房价差异）
 *   4. AUTHORITY — 权威信号 vs 非权威信号（政府数据 vs 用户评论）
 *
 * 解决策略（按优先级）：
 *   WEIGHTED_AVERAGE — 加权平均（权重=信任权重×时效因子）
 *   AUTHORITY_OVERRIDE — 权威覆盖（政府数据覆盖所有非权威）
 *   MEDIAN — 中位数（剔除极端值后取中位数）
 *   LATEST — 取最新（时间优先）
 *   REJECT — 不采纳（冲突不可调和时全部舍弃）
 *
 * 宪法规则：
 *   1. 冲突解决后必须标注 resolvedBy 策略名
 *   2. 冲突解决后必须标注 confidence（可信度）
 *   3. 若使用 REJECT 策略，必须记录 reason
 *   4. 所有冲突信号仍保留在 Trace 中（不删除，只标记）
 *   5. 同一组信号未发生冲突时不做处理
 *
 * @phase decision-runtime
 */

import type { GroundingSignal } from '../grounding/grounding-signal.js'
import type { DomainType } from '../business-intelligence/domain-classifier.js'
import type { TrustWeightRegistry } from './trust-weight-registry.js'
import { trustWeightRegistry } from './trust-weight-registry.js'

// ============================================================
// 1. 冲突策略枚举
// ============================================================

export enum ConflictStrategy {
  /** 加权平均（默认） */
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
  /** 权威覆盖 */
  AUTHORITY_OVERRIDE = 'AUTHORITY_OVERRIDE',
  /** 中位数 */
  MEDIAN = 'MEDIAN',
  /** 取最新 */
  LATEST = 'LATEST',
  /** 不采纳 */
  REJECT = 'REJECT',
}

// ============================================================
// 2. 冲突检测条件
// ============================================================

export interface ConflictDetectionConfig {
  /**
   * 冲突触发阈值（相对偏差）
   * 例：0.15 表示两个信号值偏差超过 15% 视为冲突
   */
  threshold: number

  /**
   * 冲突归类维度
   * source_group: 同一数据源不同信号
   * value_group: 同一实体不同来源
   * temporal_group: 同一实体不同时间
   */
  groupBy: 'source_group' | 'value_group' | 'temporal_group'
}

export const DEFAULT_CONFLICT_CONFIG: ConflictDetectionConfig = {
  threshold: 0.15,
  groupBy: 'value_group',
}

// ============================================================
// 3. 冲突解决结果
// ============================================================

export interface ResolvedSignal {
  /** 解决后的信号值 */
  value: number
  /** 使用的策略 */
  strategy: ConflictStrategy
  /** 最终可信度 [0, 1] */
  confidence: number
  /** 参与解决的源信号 ID 列表 */
  sourceSignalIds: string[]
  /** 冲突描述 */
  conflictDescription: string
  /** 原始信号值列表 */
  originalValues: number[]
  /** 若使用了 REJECT 策略，记录原因 */
  rejectReason?: string
}

export interface ConflictGroup {
  /** 冲突组标识 */
  groupKey: string
  /** 冲突组中的信号 */
  signals: GroundingSignal[]
  /** 冲突组描述 */
  description: string
  /** 冲突解决方案 */
  resolution: ResolvedSignal
}

// ============================================================
// 4. 冲突解决器
// ============================================================

export interface ConflictResolver {
  /**
   * 检测并解决一组信号中的冲突
   *
   * 输入：
   *   - signals: 待解决冲突的信号列表（已按优先级排序）
   *   - domain: 当前领域
   *
   * 输出：
   *   - resolvedSignals: 解决冲突后的稳定信号列表
   *   - conflictGroups: 检测到的冲突组及解决方案
   *
   * 约束：
   *   - 若无冲突，原样返回
   *   - 若有冲突但不触发 threshold，原样返回
   *   - 若有不可调和冲突，使用 REJECT 策略
   */
  resolve(
    signals: GroundingSignal[],
    domain: DomainType,
    config?: Partial<ConflictDetectionConfig>,
  ): {
    resolvedSignals: GroundingSignal[]
    conflictGroups: ConflictGroup[]
  }
}

// ============================================================
// 5. 默认实现
// ============================================================

export function createConflictResolver(
  trustRegistry?: TrustWeightRegistry,
): ConflictResolver {
  const registry = trustRegistry ?? trustWeightRegistry

  /**
   * 按信号名称分组（视为同一实体的不同来源信号）
   */
  function groupSignals(signals: GroundingSignal[]): Map<string, GroundingSignal[]> {
    const groups = new Map<string, GroundingSignal[]>()
    for (const s of signals) {
      const key = s.name
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    return groups
  }

  /**
   * 检测某个组内是否存在冲突
   */
  function detectConflict(group: GroundingSignal[], threshold: number): boolean {
    if (group.length < 2) return false

    // 按信任权重排序
    const sorted = [...group].sort(
      (a, b) => registry.getWeight(b.source, b.domain) - registry.getWeight(a.source, a.domain),
    )

    // 取权重最高的信号的 value 作为基准
    const baseline = sorted[0].value
    if (baseline === 0) return false

    // 检查是否有信号偏差超过阈值
    return sorted.some(s => Math.abs(s.value - baseline) / Math.abs(baseline) > threshold)
  }

  /**
   * 加权平均解决策略
   */
  function weightedAverage(
    group: GroundingSignal[],
    domain: DomainType,
  ): ResolvedSignal {
    let totalWeight = 0
    let weightedSum = 0

    for (const s of group) {
      const w = registry.getWeight(s.source, domain) * (1 - s.volatility)
      weightedSum += s.value * w
      totalWeight += w
    }

    const avgValue = totalWeight > 0 ? weightedSum / totalWeight : group[0].value
    const avgConfidence = totalWeight > 0
      ? Math.min(1, totalWeight / group.length)
      : 0.5

    return {
      value: avgValue,
      strategy: ConflictStrategy.WEIGHTED_AVERAGE,
      confidence: avgConfidence,
      sourceSignalIds: group.map(s => s.id),
      conflictDescription: `对 ${group.length} 个冲突信号加权平均（权重范围 ${Math.min(...group.map(s => registry.getWeight(s.source, domain))).toFixed(2)}-${Math.max(...group.map(s => registry.getWeight(s.source, domain))).toFixed(2)}）`,
      originalValues: group.map(s => s.value),
    }
  }

  /**
   * 权威覆盖策略
   */
  function authorityOverride(
    group: GroundingSignal[],
    domain: DomainType,
  ): ResolvedSignal {
    // 找到权重最高的信号
    const sorted = [...group].sort(
      (a, b) => registry.getWeight(b.source, b.domain) - registry.getWeight(a.source, a.domain),
    )
    const top = sorted[0]

    return {
      value: top.value,
      strategy: ConflictStrategy.AUTHORITY_OVERRIDE,
      confidence: registry.getWeight(top.source, domain),
      sourceSignalIds: [top.id],
      conflictDescription: `权威覆盖: 最高信任来源 "${top.source}"（权重 ${registry.getWeight(top.source, domain).toFixed(2)}）覆盖其他 ${group.length - 1} 个信号`,
      originalValues: group.map(s => s.value),
    }
  }

  /**
   * 中位数策略
   */
  function median(group: GroundingSignal[]): ResolvedSignal {
    const values = group.map(s => s.value).sort((a, b) => a - b)
    const mid = Math.floor(values.length / 2)
    const medianValue = values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid]

    return {
      value: medianValue,
      strategy: ConflictStrategy.MEDIAN,
      confidence: 0.5,
      sourceSignalIds: group.map(s => s.id),
      conflictDescription: `中位数: ${group.length} 个信号的中位值`,
      originalValues: group.map(s => s.value),
    }
  }

  /**
   * 拒绝策略
   */
  function reject(group: GroundingSignal[], reason: string): ResolvedSignal {
    return {
      value: 0,
      strategy: ConflictStrategy.REJECT,
      confidence: 0,
      sourceSignalIds: group.map(s => s.id),
      conflictDescription: `拒绝: ${reason}`,
      originalValues: group.map(s => s.value),
      rejectReason: reason,
    }
  }

  /**
   * 自动选择策略
   */
  function selectStrategy(
    group: GroundingSignal[],
    domain: DomainType,
  ): ConflictStrategy {
    // 若有政府/官方数据源 → 权威覆盖
    const hasGovernment = group.some(s =>
      registry.getWeight(s.source, domain) >= 0.9,
    )
    if (hasGovernment) return ConflictStrategy.AUTHORITY_OVERRIDE

    // 若有高权重信号较多 → 加权平均
    const highWeightCount = group.filter(
      s => registry.getWeight(s.source, domain) >= 0.6,
    ).length
    if (highWeightCount >= 2) return ConflictStrategy.WEIGHTED_AVERAGE

    // 信号数 >= 3 → 中位数
    if (group.length >= 3) return ConflictStrategy.MEDIAN

    // 默认拒绝
    return ConflictStrategy.REJECT
  }

  function resolve(
    signals: GroundingSignal[],
    domain: DomainType,
    config?: Partial<ConflictDetectionConfig>,
  ): { resolvedSignals: GroundingSignal[]; conflictGroups: ConflictGroup[] } {
    const mergedConfig = { ...DEFAULT_CONFLICT_CONFIG, ...config }
    const conflictGroups: ConflictGroup[] = []

    // 按信号名称分组
    const groups = groupSignals(signals)

    const consumedIds = new Set<string>()
    const resultSignals: GroundingSignal[] = []

    for (const [groupKey, group] of groups) {
      // 检查是否冲突
      if (detectConflict(group, mergedConfig.threshold)) {
        // 选择策略
        const strategy = selectStrategy(group, domain)
        let resolution: ResolvedSignal

        switch (strategy) {
          case ConflictStrategy.WEIGHTED_AVERAGE:
            resolution = weightedAverage(group, domain)
            break
          case ConflictStrategy.AUTHORITY_OVERRIDE:
            resolution = authorityOverride(group, domain)
            break
          case ConflictStrategy.MEDIAN:
            resolution = median(group)
            break
          case ConflictStrategy.REJECT:
          default:
            resolution = reject(group, `无法调和: ${group.length} 个信号在 "${groupKey}" 上偏差超过 ${(mergedConfig.threshold * 100).toFixed(0)}%`)
            break
        }

        // 标记所有信号已消费
        group.forEach(s => consumedIds.add(s.id))

        // 如果是拒绝策略，不输出结果信号
        if (resolution.strategy !== ConflictStrategy.REJECT) {
          resultSignals.push({
            ...group[0], // 保留第一个信号的结构
            id: `resolved_${groupKey}`,
            value: resolution.value,
            source: `conflict_resolved:${resolution.strategy}`,
            description: resolution.conflictDescription,
            reliability: resolution.confidence,
            relatedAxis: group[0].relatedAxis,
            geoScope: group[0].geoScope,
          })
        }

        conflictGroups.push({
          groupKey,
          signals: group,
          description: `${group.length} 个冲突信号`,
          resolution,
        })
      }
    }

    // 添加未冲突的信号
    for (const s of signals) {
      if (!consumedIds.has(s.id)) {
        resultSignals.push(s)
      }
    }

    return { resolvedSignals: resultSignals, conflictGroups }
  }

  return { resolve }
}

/** 单例 */
export const conflictResolver = createConflictResolver()
