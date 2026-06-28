/**
 * Execution Version Store
 * Phase 6 — Execution Memory Layer
 *
 * DAG 版本化存储：每次 blueprint 变更记录一个版本快照。
 * 支持按 traceId 检索完整版本链。
 */

export interface ExecutionVersion {
  versionId: string
  traceId: string
  blueprintHash: string
  timestamp: number
  reason: string
  /** 可选：本次变更的节点 ID 和影响范围 */
  changedNodes?: string[]
  invalidatedNodes?: string[]
  /** 可选：上游版本 ID */
  parentVersionId?: string
}

export class ExecutionVersionStore {
  private versions = new Map<string, ExecutionVersion[]>()
  private allVersions = new Map<string, ExecutionVersion>()

  /**
   * 记录一个新版本
   */
  record(version: ExecutionVersion): void {
    this.allVersions.set(version.versionId, version)

    if (!this.versions.has(version.traceId)) {
      this.versions.set(version.traceId, [])
    }
    this.versions.get(version.traceId)!.push(version)
  }

  /**
   * 获取 traceId 的完整版本链（按时间正序）
   */
  getChain(traceId: string): ExecutionVersion[] {
    return (this.versions.get(traceId) || []).sort(
      (a, b) => a.timestamp - b.timestamp,
    )
  }

  /**
   * 获取单个版本快照
   */
  getVersion(versionId: string): ExecutionVersion | undefined {
    return this.allVersions.get(versionId)
  }

  /**
   * 获取所有 trace 的版本链（用于管理层）
   */
  getAllChains(): Map<string, ExecutionVersion[]> {
    return new Map(this.versions)
  }

  /**
   * 获取最新版本（给定 traceId）
   */
  getLatest(traceId: string): ExecutionVersion | undefined {
    const chain = this.getChain(traceId)
    return chain.length > 0 ? chain[chain.length - 1] : undefined
  }
}

// 进程内全局实例
export const globalVersionStore = new ExecutionVersionStore()
