/**
 * P7-GOV — RollbackManager（回滚管理器）
 *
 * 保存系统快照，支持将 scheduler 权重、集群规模、路由策略回滚到上一次稳定状态。
 *
 * ═══ 宪法 ═══
 * 回滚是系统安全网的最后一道防线。
 * 每次进化应用前必须保存快照。
 */

import { learningAuditLog } from './learning-audit-log.js'

export interface SystemSnapshot {
  snapshotId: string
  timestamp: number
  label: string
  weights: Record<string, number>
  clusterSize: number
  routingPolicies: Record<string, any>
}

class RollbackManager {
  private snapshots: SystemSnapshot[] = []
  private maxSnapshots = 50

  /**
   * 保存系统快照
   */
  async saveSnapshot(label: string, weights: Record<string, number>, clusterSize: number): Promise<SystemSnapshot> {
    const snapshot: SystemSnapshot = {
      snapshotId: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label,
      weights,
      clusterSize,
      routingPolicies: {},
    }

    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.maxSnapshots) this.snapshots.shift()

    console.log(`[RollbackManager] 💾 快照已保存: "${label}" (id: ${snapshot.snapshotId.substring(0, 16)})`)
    return snapshot
  }

  /**
   * 回滚到指定快照
   */
  async rollback(snapshotId: string): Promise<SystemSnapshot | null> {
    const snapshot = this.snapshots.find(s => s.snapshotId === snapshotId)
    if (!snapshot) {
      console.error(`[RollbackManager] ❌ 快照 "${snapshotId.substring(0, 16)}" 不存在`)
      return null
    }

    // 记录回滚操作
    await learningAuditLog.record({
      timestamp: Date.now(),
      type: 'routing_policy',
      previousValue: 'current state',
      proposedValue: snapshot.label,
      reason: `rollback to snapshot "${snapshot.label}"`,
      approved: true,
      violations: [],
    })

    console.log(`[RollbackManager] 🔙 回滚到快照 "${snapshot.label}" (${snapshot.snapshotId.substring(0, 16)})`)
    return snapshot
  }

  /**
   * 回滚到上一次稳定版本
   */
  async rollbackToStable(): Promise<SystemSnapshot | null> {
    if (this.snapshots.length < 2) {
      console.warn('[RollbackManager] ⚠️ 无可用稳定快照')
      return null
    }

    // 回滚到倒数第二个快照
    const stableSnapshot = this.snapshots[this.snapshots.length - 2]
    return this.rollback(stableSnapshot.snapshotId)
  }

  /**
   * 获取快照列表
   */
  getSnapshots(): SystemSnapshot[] {
    return [...this.snapshots]
  }
}

export const rollbackManager = new RollbackManager()
