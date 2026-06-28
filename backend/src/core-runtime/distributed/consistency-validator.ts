// ============================================================================
// 盘古斧 AI OS — Phase 8.3: Consistency Validator (一致性验证器)
//
// 职责：
//   1. 比对 snapshot 与 journal 的版本号，验证一致性
//   2. 验证 replay 后的状态与 snapshot 是否匹配
//   3. 输出验证指标（供 sla-metrics 消费）
// ============================================================================

import { getJournal, getMaxVersion } from './runtime-state-journal.js'
import { getLatestSnapshot } from './snapshot-replication.js'

export interface ConsistencyResult {
  dagId: string
  valid: boolean
  journalVersion: number
  snapshotVersion: number
  journalEventCount: number
  issues: string[]
}

/**
 * 验证指定 dag 的运行时状态一致性
 *
 * 验证策略：
 *   1. 获取 journal 中该 dag 的最高版本号
 *   2. 获取 snapshot 中该 dag 的版本号
 *   3. 如果 snapshot.version >= journal.maxVersion → 一致
 *   4. 如果 snapshot 缺失或版本落后 → 不一致
 */
export function validateConsistency(dagId: string): ConsistencyResult {
  const issues: string[] = []

  const journalMaxVersion = getMaxVersion(dagId)
  const latestSnapshot = getLatestSnapshot(dagId)

  const journalVersion = journalMaxVersion
  const snapshotVersion = latestSnapshot?.version ?? 0

  // 验证 1: snapshot 不能落后于 journal
  if (snapshotVersion < journalVersion) {
    issues.push(
      `Snapshot 落后于 Journal: snapshot=v${snapshotVersion}, journal=v${journalVersion}`
    )
  }

  // 验证 2: snapshot 必须存在
  if (!latestSnapshot) {
    issues.push('该 DAG 没有任何 snapshot')
  }

  // 验证 3: journal 不能为空
  const journalEvents = getJournal(dagId)
  if (journalEvents.length === 0) {
    issues.push('该 DAG 没有任何 journal 事件')
  }

  return {
    dagId,
    valid: issues.length === 0,
    journalVersion,
    snapshotVersion,
    journalEventCount: journalEvents.length,
    issues,
  }
}

/**
 * 批量验证所有 dag 的一致性
 */
export function validateAllConsistency(): ConsistencyResult[] {
  // 从 journal 中提取所有唯一的 dagId
  const allEvents = getJournal()
  const dagIds = new Set<string>()
  for (const e of allEvents) {
    dagIds.add(e.dagId)
  }

  return Array.from(dagIds).map(validateConsistency)
}
