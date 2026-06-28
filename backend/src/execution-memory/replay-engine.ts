/**
 * Execution Replay Engine
 * Phase 6 — Execution Memory Layer
 *
 * 历史回放引擎：按版本链顺序逐帧回放 blueprint 快照。
 * 支持正放、定位到特定版本、帧对比。
 */

import { ExecutionVersion, ExecutionVersionStore } from './version-store'

export interface ReplayFrame {
  versionId: string
  timestamp: string
  reason: string
  blueprintHash: string
  changedNodes?: string[]
  invalidatedNodes?: string[]
}

export class ExecutionReplayEngine {
  constructor(private store: ExecutionVersionStore) {}

  /**
   * 按顺序回放整个 trace 的版本链
   */
  replay(traceId: string): ReplayFrame[] {
    const chain = this.store.getChain(traceId)
    return chain.map(v => ({
      versionId: v.versionId,
      timestamp: new Date(v.timestamp).toISOString(),
      reason: v.reason,
      blueprintHash: v.blueprintHash,
      changedNodes: v.changedNodes,
      invalidatedNodes: v.invalidatedNodes,
    }))
  }

  /**
   * 定位到版本链中的特定位置（索引）
   */
  seek(traceId: string, index: number): ReplayFrame | null {
    const chain = this.store.getChain(traceId)
    if (index < 0 || index >= chain.length) return null

    const v = chain[index]
    return {
      versionId: v.versionId,
      timestamp: new Date(v.timestamp).toISOString(),
      reason: v.reason,
      blueprintHash: v.blueprintHash,
      changedNodes: v.changedNodes,
      invalidatedNodes: v.invalidatedNodes,
    }
  }

  /**
   * 对比两个版本之间的差异概览
   */
  diffVersions(
    v1: ExecutionVersion,
    v2: ExecutionVersion,
  ): {
    changed: boolean
    hashChanged: boolean
    changedNodes: string[]
    invalidatedNodes: string[]
  } {
    return {
      changed: v1.blueprintHash !== v2.blueprintHash,
      hashChanged: v1.blueprintHash !== v2.blueprintHash,
      changedNodes: [
        ...(v1.changedNodes || []),
        ...(v2.changedNodes || []),
      ].filter((id, i, arr) => arr.indexOf(id) === i),
      invalidatedNodes: [
        ...(v1.invalidatedNodes || []),
        ...(v2.invalidatedNodes || []),
      ].filter((id, i, arr) => arr.indexOf(id) === i),
    }
  }
}
