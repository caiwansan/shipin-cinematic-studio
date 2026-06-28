/**
 * signal-orchestrator.ts — Phase A-3.3 Signal Orchestration Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * SignalOrchestrator — 顶层信号编排器
 * ═══════════════════════════════════════════════════════════════
 *
 * 职责：
 *   将原始信号集经过三个编排阶段转化为"经过编排的稳定信号集"。
 *
 * 流程：
 *   RAW → [1]信任过滤 → FILTERED → [2]优先级排序 → RANKED → [3]冲突解决 → RESOLVED
 *
 * 宪法约束：
 *   1. 编排是确定性的——相同输入永远相同输出
 *   2. 编排不修改原始信号数据结构（只标记、排序、化简）
 *   3. 编排后的信号不丢失信息——原始信号全部保留在 Trace 中
 *   4. 编排后的 finalSignals 是去重、解决冲突后的稳定信号
 *
 * @phase decision-runtime
 */

import type { GroundingSignal } from '../grounding/grounding-signal.js'
import type { DomainType } from '../business-intelligence/domain-classifier.js'
import type { TrustWeightRegistry } from './trust-weight-registry.js'
import type { SignalPriorityEngine, PriorityRankedSignal, PriorityConfig } from './signal-priority-engine.js'
import type { ConflictResolver, ConflictDetectionConfig } from './conflict-resolver.js'
import type { OrchestrationResult } from './orchestration-result.js'
import { trustWeightRegistry as defaultTrustRegistry } from './trust-weight-registry.js'
import { signalPriorityEngine as defaultPriorityEngine } from './signal-priority-engine.js'
import { conflictResolver as defaultConflictResolver } from './conflict-resolver.js'
import { createOrchestrationResult } from './orchestration-result.js'

// ============================================================
// 1. 编排器配置
// ============================================================

export interface OrchestratorConfig {
  /** 最低信任权重阈值（低于此值丢弃，默认 0.01） */
  minimumTrustWeight: number

  /** 优先级排序配置 */
  priorityConfig?: Partial<PriorityConfig>

  /** 冲突检测配置 */
  conflictConfig?: Partial<ConflictDetectionConfig>
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  minimumTrustWeight: 0.01,
}

// ============================================================
// 2. 信号编排器
// ============================================================

export interface SignalOrchestrator {
  /**
   * 编排一组原始信号
   *
   * 输入：
   *   - rawSignals: A-4 数据接入层收集的原始信号
   *   - domain: 当前决策领域
   *
   * 输出：
   *   - OrchestrationResult（包含编排后的稳定信号集）
   *
   * 约束：
   *   - 若 rawSignals 为空，返回空编排结果（非 null）
   *   - 若所有信号被过滤，finalSignals 为空数组
   */
  orchestrate(
    rawSignals: GroundingSignal[],
    domain: DomainType,
    config?: Partial<OrchestratorConfig>,
  ): OrchestrationResult
}

// ============================================================
// 3. 默认实现
// ============================================================

export function createSignalOrchestrator(
  trustRegistry?: TrustWeightRegistry,
  priorityEngine?: SignalPriorityEngine,
  resolver?: ConflictResolver,
): SignalOrchestrator {
  const registry = trustRegistry ?? defaultTrustRegistry
  const engine = priorityEngine ?? defaultPriorityEngine
  const resolver_ = resolver ?? defaultConflictResolver

  function orchestrate(
    rawSignals: GroundingSignal[],
    domain: DomainType,
    config?: Partial<OrchestratorConfig>,
  ): OrchestrationResult {
    const mergedConfig = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config }

    // 记录原始数量
    const rawCount = rawSignals.length

    // ═══════════════════════════════════
    // Step 1: Trust Weight Filtering
    // ═══════════════════════════════════
    const filtered: GroundingSignal[] = []
    const discarded: GroundingSignal[] = []

    for (const s of rawSignals) {
      const weight = registry.getWeight(s.source, domain)
      if (weight >= mergedConfig.minimumTrustWeight) {
        filtered.push(s)
      } else {
        discarded.push(s)
      }
    }

    const filteredCount = filtered.length

    // ═══════════════════════════════════
    // Step 2: Priority Ranking
    // ═══════════════════════════════════
    const ranked = engine.rank(filtered, domain, mergedConfig.priorityConfig)

    // 筛选出权重 > 0 的信号 finalSignals
    const rankedSignals = ranked
    const rankedSignalsList = ranked.map(r => r.signal)

    // ═══════════════════════════════════
    // Step 3: Conflict Resolution
    // ═══════════════════════════════════
    const { resolvedSignals, conflictGroups } = resolver_.resolve(
      rankedSignalsList,
      domain,
      mergedConfig.conflictConfig,
    )

    const resolvedCount = resolvedSignals.length

    // 构建最终结果
    return createOrchestrationResult({
      domain,
      rawCount,
      filteredCount,
      rankedSignals,
      resolvedCount,
      finalSignals: resolvedSignals,
      conflictGroups,
      filteredSignals: discarded,
    })
  }

  return { orchestrate }
}

/** 单例 */
export const signalOrchestrator = createSignalOrchestrator()
