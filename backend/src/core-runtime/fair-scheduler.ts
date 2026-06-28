// ============================================================================
// 盘古斧 AI OS — Phase 8.2c: Fair Scheduler (公平调度器)
//
// 职责：
//   1. 在多 tenant 队列分区中公平选择下一个取哪个 tenant
//   2. 按队列权重 + 等待时间 加权选择 (非简单轮询)
//   3. 防止 noisy neighbor 过度占用、低优先级租户饿死
//   4. 跨所有 SLA tier 统一调度
// ============================================================================

import type { ExecutionTask } from './execution-queue.js'

/** 队列分区快照 — 用于 fair scheduler 决策 */
export interface QueuePartitionSnapshot {
  tenantId: string
  /** 该 tenant 队列深度 */
  depth: number
  /** 该 tenant 调度权重 (来自 TenantRuntimeContext) */
  weight: number
  /** 队列中最老任务的等待时间 (ms) */
  oldestWaitTime: number
  /** 是否被标记为 noisy */
  isNoisy: boolean
}

/**
 * 在多个 tenant 队列中选择下一个应消费的 tenant
 *
 * 选择策略 (权重 + 饥饿补偿):
 *   1. 计算每个 tenant 的调度分数: depth * weight + waitBonus
 *   2. waitBonus: 最老任务超过 10s 没被调度 → 逐步加分 (抗饿死)
 *   3. noisy tenant 降权: score = score / 2
 *   4. 选择分数最高的 tenant
 *
 * @param partitions 所有非空队列分区的快照
 * @returns 被选中的 tenantId, 或 null (无可用队列)
 */
export function selectNextTenantQueue(
  partitions: QueuePartitionSnapshot[],
): string | null {
  if (partitions.length === 0) return null

  let bestTenant: string | null = null
  let bestScore = -1

  for (const p of partitions) {
    if (p.depth <= 0) continue

    // 基础分 = 队列深度 * 权重
    let score = p.depth * p.weight

    // 饥饿补偿: 等待超过 10s 的任务给予加分
    const WAIT_BONUS_MS = 10_000
    const waitBonusWeight = 0.5
    if (p.oldestWaitTime > WAIT_BONUS_MS) {
      score += Math.floor((p.oldestWaitTime - WAIT_BONUS_MS) / 1000) * waitBonusWeight * p.weight
    }

    // noisy 降权
    if (p.isNoisy) {
      score = Math.floor(score / 2)
    }

    if (score > bestScore) {
      bestScore = score
      bestTenant = p.tenantId
    }
  }

  return bestTenant
}
