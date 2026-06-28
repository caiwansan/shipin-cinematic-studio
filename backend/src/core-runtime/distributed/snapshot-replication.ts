// ============================================================================
// 盘古斧 AI OS — Phase 8.3: Snapshot Replication (快照复制层)
//
// 职责：
//   1. 将每个 DAG 完成时的执行状态保存为 RuntimeSnapshot
//   2. 提供按 dagId 获取最新 snapshot 的能力
//   3. 作为分布式 "状态真相" (State Truth) 的锚点
//   4. 与 replay-sync-engine 配合：replay 后比对 snapshot 验证一致性
// ============================================================================

export interface RuntimeSnapshot {
  snapshotId: string
  tenantId: string
  dagId: string
  state: unknown
  version: number
  createdAt: number
}

/** 按 dagId 索引的快照存储（仅保存每个 dag 的最新 snapshot） */
const snapshots: Map<string, RuntimeSnapshot> = new Map()

/** 全量快照历史（用于回溯）*/
const snapshotHistory: RuntimeSnapshot[] = []
const MAX_SNAPSHOT_HISTORY = 500

/**
 * 创建一个新的运行时快照
 * 如果同 dagId 已有旧 snapshot，自动覆盖（只保留最新）
 */
export function createSnapshot(snapshot: RuntimeSnapshot): void {
  snapshots.set(snapshot.dagId, snapshot)
  snapshotHistory.push(snapshot)
  while (snapshotHistory.length > MAX_SNAPSHOT_HISTORY) snapshotHistory.shift()
}

/**
 * 获取指定 dag 的最新 snapshot
 */
export function getLatestSnapshot(dagId: string): RuntimeSnapshot | undefined {
  return snapshots.get(dagId)
}

/**
 * 获取指定 dag 的指定版本 snapshot（从历史中查找）
 */
export function getSnapshotByVersion(dagId: string, version: number): RuntimeSnapshot | undefined {
  return snapshotHistory.find(s => s.dagId === dagId && s.version === version)
}

/**
 * 获取所有最新 snapshot（全系统视图）
 */
export function getAllSnapshots(): RuntimeSnapshot[] {
  return Array.from(snapshots.values())
}

/**
 * 获取快照历史总数
 */
export function getSnapshotCount(): number {
  return snapshotHistory.length
}

/**
 * 清空所有快照
 */
export function clearSnapshots(): void {
  snapshots.clear()
  snapshotHistory.length = 0
}
