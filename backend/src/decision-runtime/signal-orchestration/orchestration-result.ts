/**
 * orchestration-result.ts — Phase A-3.3 Signal Orchestration Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * OrchestrationResult — 信号编排结果类型
 * ═══════════════════════════════════════════════════════════════
 *
 * 编排流程经过三个核心步骤：
 *   Step 1: Trust Weight Filter — 丢弃权重 = 0 的信号
 *   Step 2: Priority Ranking   — 按优先级得分排序
 *   Step 3: Conflict Resolution — 解决冲突组
 *
 * 最终产出 "经过编排的稳定信号集"(OrchestratedSignals)，用于给
 * Reality Adjustment Engine 作为输入。
 *
 * @phase decision-runtime
 */

import type { GroundingSignal } from '../grounding/grounding-signal.js'
import type { PriorityRankedSignal } from './signal-priority-engine.js'
import type { ConflictGroup } from './conflict-resolver.js'

// ============================================================
// 1. 编排阶段枚举
// ============================================================

export enum OrchestrationStage {
  RAW = 'RAW',
  FILTERED = 'FILTERED',
  RANKED = 'RANKED',
  RESOLVED = 'RESOLVED',
}

// ============================================================
// 2. 编排结果
// ============================================================

export interface OrchestrationResult {
  /** 编排的领域 */
  domain: string

  /** 各阶段数据 */
  stages: {
    /** 原始信号数量 */
    rawCount: number

    /** 过滤后（权重 > 0）信号数量 */
    filteredCount: number

    /** 排序后的信号（前 N 个） */
    rankedSignals: PriorityRankedSignal[]

    /** 冲突解决后的最终信号数量 */
    resolvedCount: number
  }

  /** 最终稳定的信号集（用于 Reality Adjustment Engine） */
  finalSignals: GroundingSignal[]

  /** 冲突解决记录 */
  conflictGroups: ConflictGroup[]

  /** 被过滤掉的信号（权重 = 0 的） */
  filteredSignals: GroundingSignal[]

  /** 是否经过编排（若无冲突且所有信号权重 > 0，false） */
  wasOrchestrated: boolean

  /** 编排原因 */
  reasons: string[]
}

// ============================================================
// 3. 构建辅助
// ============================================================

export function createOrchestrationResult(params: {
  domain: string
  rawCount: number
  filteredCount: number
  rankedSignals: PriorityRankedSignal[]
  resolvedCount: number
  finalSignals: GroundingSignal[]
  conflictGroups: ConflictGroup[]
  filteredSignals: GroundingSignal[]
}): OrchestrationResult {
  const wasOrchestrated =
    params.filteredCount < params.rawCount ||
    params.conflictGroups.length > 0

  const reasons: string[] = []

  if (params.filteredCount < params.rawCount) {
    reasons.push(`过滤掉 ${params.rawCount - params.filteredCount} 个低信任信号`)
  }

  if (params.conflictGroups.length > 0) {
    reasons.push(`解决 ${params.conflictGroups.length} 组冲突信号`)
  }

  return {
    domain: params.domain,
    stages: {
      rawCount: params.rawCount,
      filteredCount: params.filteredCount,
      rankedSignals: params.rankedSignals,
      resolvedCount: params.resolvedCount,
    },
    finalSignals: params.finalSignals,
    conflictGroups: params.conflictGroups,
    filteredSignals: params.filteredSignals,
    wasOrchestrated,
    reasons,
  }
}
