// ============================================================================
// 盘古斧 AI OS — Phase 7A-STABILIZE Replay Determinism Engine
// 回放确定性引擎：校验 replay 是否 100% 一致于原始执行
// ============================================================================

import { createHash } from 'crypto'
import { logicalClock, eventOrderingLock, hashEventSequence, type AnchoredEvent } from '../events/event-order-lock.js'

// ── Snapshot Anchor（每个 DAG run 的快照锚点） ─────────────────────────

export interface SnapshotAnchor {
  runId: string
  dagId: string
  eventCount: number
  eventHashChain: string      // SHA256 of all events in order
  finalStateHash: string
  nodeExecutionMap: Record<string, { status: string; hash: string }>
  logicalTickStart: number
  logicalTickEnd: number
  timestamp: string
}

// ── Replay 比较结果 ─────────────────────────────────────────────────────

export interface ReplayComparisonResult {
  dagId: string
  originalRunId: string
  replayRunId: string
  match: boolean
  eventSequenceMatch: boolean
  finalStateMatch: boolean
  mismatches: Array<{
    position: number
    expectedHash: string
    actualHash: string
    eventType?: string
  }>
  driftRate: number
  timestamp: string
}

// ── 回放确定性引擎 ──────────────────────────────────────────────────────

export class ReplayDeterminismEngine {
  private snapshots = new Map<string, SnapshotAnchor>()  // runId → snapshot
  private replayResults = new Map<string, ReplayComparisonResult[]>()

  /** 创建 DAG run 的快照 */
  captureSnapshot(
    runId: string,
    dagId: string,
    events: AnchoredEvent[],
    nodeExecutionMap: Record<string, { status: string; hash: string }>,
    finalStateHash?: string
  ): SnapshotAnchor {
    const eventHashChain = hashEventSequence(events)
    const tickStart = events.length > 0 ? events[0].tick : 0
    const tickEnd = events.length > 0 ? events[events.length - 1].tick : 0

    const snapshot: SnapshotAnchor = {
      runId,
      dagId,
      eventCount: events.length,
      eventHashChain,
      finalStateHash: finalStateHash || eventHashChain,
      nodeExecutionMap,
      logicalTickStart: tickStart,
      logicalTickEnd: tickEnd,
      timestamp: new Date().toISOString()
    }

    this.snapshots.set(runId, snapshot)
    return snapshot
  }

  /** 获取快照 */
  getSnapshot(runId: string): SnapshotAnchor | undefined {
    return this.snapshots.get(runId)
  }

  /** 比较 replay 与原始执行 */
  compareReplay(
    originalRunId: string,
    replayRunId: string,
    replayEvents: AnchoredEvent[]
  ): ReplayComparisonResult {
    const originalSnapshot = this.snapshots.get(originalRunId)
    const replaySnapshot = this.captureSnapshot(
      replayRunId,
      originalSnapshot?.dagId || 'unknown',
      replayEvents,
      {}
    )

    if (!originalSnapshot) {
      return {
        dagId: originalSnapshot?.dagId || 'unknown',
        originalRunId,
        replayRunId,
        match: false,
        eventSequenceMatch: false,
        finalStateMatch: false,
        mismatches: [{ position: 0, expectedHash: 'SNAPSHOT_NOT_FOUND', actualHash: replaySnapshot.eventHashChain }],
        driftRate: 1.0,
        timestamp: new Date().toISOString()
      }
    }

    const mismatches: ReplayComparisonResult['mismatches'] = []

    // 比较事件序列 hash
    const eventSequenceMatch = originalSnapshot.eventHashChain === replaySnapshot.eventHashChain

    // 比较最终状态 hash
    const finalStateMatch = originalSnapshot.finalStateHash === replaySnapshot.finalStateHash

    // 找到具体不匹配的事件
    if (!eventSequenceMatch) {
      const originalSequence = eventOrderingLock.getDAGSequence(originalRunId)
      const maxLen = Math.max(originalSequence.length, replayEvents.length)
      for (let i = 0; i < maxLen; i++) {
        const origHash = originalSequence[i]?.hash || 'MISSING'
        const replayHash = replayEvents[i]?.hash || 'MISSING'
        if (origHash !== replayHash) {
          mismatches.push({
            position: i,
            expectedHash: origHash,
            actualHash: replayHash,
            eventType: originalSequence[i]?.type || replayEvents[i]?.type
          })
        }
      }
    }

    const match = eventSequenceMatch && finalStateMatch

    // 计算漂移率
    const driftRate = match ? 0 : (mismatches.length / Math.max(originalSnapshot.eventCount, 1))

    const result: ReplayComparisonResult = {
      dagId: originalSnapshot.dagId,
      originalRunId,
      replayRunId,
      match,
      eventSequenceMatch,
      finalStateMatch,
      mismatches,
      driftRate,
      timestamp: new Date().toISOString()
    }

    this.replayResults.set(replayRunId, (this.replayResults.get(replayRunId) || []).concat(result))

    return result
  }

  /** 检查 replay 是否通过确定性校验 */
  isDeterministic(originalRunId: string, replayRunId: string): boolean {
    const snap = this.snapshots.get(originalRunId)
    const replaySnap = this.snapshots.get(replayRunId)
    if (!snap || !replaySnap) return false
    return snap.eventHashChain === replaySnap.eventHashChain
  }

  /** 清理旧快照 */
  clearBefore(runId: string): void {
    const keys = Array.from(this.snapshots.keys())
    const idx = keys.indexOf(runId)
    if (idx > 0) {
      for (const key of keys.slice(0, idx)) {
        this.snapshots.delete(key)
        this.replayResults.delete(key)
      }
    }
  }
}

export const replayDeterminismEngine = new ReplayDeterminismEngine()
