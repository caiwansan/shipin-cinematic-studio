// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE Snapshot Anchor System
// 每个 DAG run 必须生成不可篡改的快照锚点
// Snapshot 是唯一 truth source — replay 必须 bind，repair 必须 fork
// ============================================================================

import { createHash } from 'crypto'
import { type AnchoredEvent, hashEventSequence } from '../events/event-order-lock.js'
import { replayDeterminismEngine, type SnapshotAnchor } from './replay-determinism-engine.js'
import { runtimeEventBus } from '../events/runtime-event-bus.js'

// ── 节点执行记录 ────────────────────────────────────────────────────────

interface NodeExecutionRecord {
  status: 'ok' | 'warn' | 'error'
  hash: string
  durationMs: number
  outputHash: string
}

// ── 快照锚定器 ──────────────────────────────────────────────────────────

export class SnapshotAnchorSystem {
  private anchors = new Map<string, SnapshotAnchor>()
  private forkRegistry = new Map<string, string>()  // forkRunId → originalRunId

  /** 创建 DAG run 的完整快照锚点 */
  createAnchor(
    runId: string,
    dagId: string,
    events: AnchoredEvent[],
    nodeExecutions: Record<string, NodeExecutionRecord>,
    outputState: Record<string, unknown>
  ): SnapshotAnchor {
    // 计算每个节点的 hash 映射
    const nodeExecutionMap: Record<string, { status: string; hash: string }> = {}
    for (const [nodeId, record] of Object.entries(nodeExecutions)) {
      nodeExecutionMap[nodeId] = {
        status: record.status,
        hash: record.hash
      }
    }

    // 计算最终状态 hash
    const finalStateHash = createHash('sha256')
      .update(JSON.stringify({ events: hashEventSequence(events), output: outputState }))
      .digest('hex')

    // 交由 ReplayDeterminismEngine 创建规范化快照
    const snapshot = replayDeterminismEngine.captureSnapshot(
      runId, dagId, events, nodeExecutionMap, finalStateHash
    )

    this.anchors.set(runId, snapshot)

    // 发布快照事件
    runtimeEventBus.emit('snapshot.anchor', {
      runId,
      dagId,
      eventCount: snapshot.eventCount,
      eventHashChain: snapshot.eventHashChain,
      finalStateHash,
      nodeCount: Object.keys(nodeExecutions).length
    })

    return snapshot
  }

  /** 根据快照 fork 新的 repair run */
  forkSnapshot(originalRunId: string, forkRunId: string, repairPatch: Record<string, unknown>): SnapshotAnchor | null {
    const original = this.anchors.get(originalRunId)
    if (!original) return null

    // fork 时，基于原快照创建新锚点（但标记为 fork）
    const forkAnchor: SnapshotAnchor = {
      ...original,
      runId: forkRunId,
      timestamp: new Date().toISOString()
    }

    this.anchors.set(forkRunId, forkAnchor)
    this.forkRegistry.set(forkRunId, originalRunId)

    // 发布 fork 事件
    runtimeEventBus.emit('snapshot.fork', {
      forkRunId,
      originalRunId,
      dagId: original.dagId,
      eventHashChain: original.eventHashChain
    })

    return forkAnchor
  }

  /** 验证快照完整性 */
  verifyIntegrity(runId: string): { valid: boolean; issues: string[] } {
    const snapshot = this.anchors.get(runId)
    if (!snapshot) {
      return { valid: false, issues: ['SNAPSHOT_NOT_FOUND'] }
    }

    const issues: string[] = []

    // 验证 logical clock 范围
    if (snapshot.logicalTickEnd < snapshot.logicalTickStart) {
      issues.push('INVALID_LOGICAL_CLOCK_RANGE')
    }

    // 验证 event hash chain 非空
    if (!snapshot.eventHashChain || snapshot.eventHashChain.length !== 64) {
      issues.push('INVALID_EVENT_HASH_CHAIN')
    }

    // 验证 final state hash 非空
    if (!snapshot.finalStateHash || snapshot.finalStateHash.length !== 64) {
      issues.push('INVALID_FINAL_STATE_HASH')
    }

    // 验证节点执行映射
    if (Object.keys(snapshot.nodeExecutionMap).length === 0) {
      issues.push('EMPTY_NODE_EXECUTION_MAP')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /** 获取快照 */
  getAnchor(runId: string): SnapshotAnchor | undefined {
    return this.anchors.get(runId)
  }

  /** 获取原 run 的 fork 列表 */
  getForks(originalRunId: string): string[] {
    return Array.from(this.forkRegistry.entries())
      .filter(([, original]) => original === originalRunId)
      .map(([fork]) => fork)
  }

  /** 清理 */
  clear(): void {
    this.anchors.clear()
    this.forkRegistry.clear()
  }
}

export const snapshotAnchorSystem = new SnapshotAnchorSystem()
