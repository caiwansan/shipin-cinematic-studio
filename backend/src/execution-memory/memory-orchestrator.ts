/**
 * Execution Memory Layer — Full Orchestrator
 * Phase 6 — Execution Memory Layer
 *
 * 总控编排层：将版本存储、执行谱系、回放引擎、因果解释、差异可视化
 * 编织为一个完整的执行记忆服务。
 *
 * 典型调用链路：
 *   recordVersion(...)
 *     → 写入 VersionStore
 *     → 记录 Lineage（父子关系）
 *
 *   getHistory(traceId)
 *     → VersionStore.getChain → ReplayEngine.replay → StoryGenerator.explainHistory
 */

import { ExecutionVersionStore, ExecutionVersion, globalVersionStore } from './version-store'
import { ExecutionLineage, globalLineage } from './lineage-graph'
import { ExecutionReplayEngine, ReplayFrame } from './replay-engine'
import { CausalStoryGenerator, CausalStory } from './story-generator'
import { CausalDiffViewer, DiffViewerReport } from './diff-viewer'
import { DiffResult } from '../causal-engine/causal-diff-engine'
import crypto from 'crypto'

export interface MemoryRecordInput {
  traceId: string
  reason: string
  parentVersionId?: string
  changedNodes?: string[]
  invalidatedNodes?: string[]
  blueprint: any
}

export class ExecutionMemoryLayer {
  constructor(
    private store: ExecutionVersionStore = globalVersionStore,
    private lineage: ExecutionLineage = globalLineage,
    private replayEngine: ExecutionReplayEngine = new ExecutionReplayEngine(globalVersionStore),
    private storyGen: CausalStoryGenerator = new CausalStoryGenerator(),
    private diffViewer: CausalDiffViewer = new CausalDiffViewer(),
  ) {}

  /**
   * 记录一次版本变更
   */
  recordVersion(input: MemoryRecordInput): ExecutionVersion {
    const raw = input.blueprint?.data ?? input.blueprint
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(raw))
      .digest('hex')

    const version: ExecutionVersion = {
      versionId: crypto.randomUUID(),
      traceId: input.traceId,
      blueprintHash: hash,
      timestamp: Date.now(),
      reason: input.reason,
      changedNodes: input.changedNodes,
      invalidatedNodes: input.invalidatedNodes,
      parentVersionId: input.parentVersionId,
    }

    this.store.record(version)

    if (input.parentVersionId) {
      this.lineage.link(input.parentVersionId, version.versionId)
    }

    return version
  }

  /**
   * 获取执行历史（回放帧列表）
   */
  getHistory(traceId: string): ReplayFrame[] {
    const frames = this.replayEngine.replay(traceId)
    return frames
  }

  /**
   * 获取历史摘要
   */
  getHistorySummary(traceId: string): CausalStory {
    const chain = this.store.getChain(traceId)
    const changeCount = chain.filter(v => (v.changedNodes?.length || 0) > 0).length
    return this.storyGen.explainHistory(traceId, chain.length, changeCount)
  }

  /**
   * 获取版本之间的差异说明
   */
  explainVersionDiff(
    versionId1: string,
    versionId2: string,
  ): { report: DiffViewerReport; story: CausalStory } | null {
    const v1 = this.store.getVersion(versionId1)
    const v2 = this.store.getVersion(versionId2)
    if (!v1 || !v2) return null

    const diffResult: DiffResult = {
      changed: [
        ...(v1.changedNodes || []),
        ...(v2.changedNodes || []),
      ].filter((id, i, arr) => arr.indexOf(id) === i && !v1.changedNodes?.includes(id) === !v2.changedNodes?.includes(id)),
      added: [],
      removed: [],
    }

    const report = this.diffViewer.view(diffResult)
    const story = this.storyGen.explainDiff(versionId2, v2.changedNodes || [], v2.invalidatedNodes || [])

    return { report, story }
  }

  /**
   * 获取版本谱系（Lineage 快照）
   */
  getLineage(): { allVersionIds: string[]; children: Record<string, string[]>; parents: Record<string, string[]> } {
    const ids = this.lineage.getAllVersionIds()
    const children: Record<string, string[]> = {}
    const parents: Record<string, string[]> = {}

    for (const id of ids) {
      children[id] = this.lineage.getChildren(id)
      parents[id] = this.lineage.getParents(id)
    }

    return { allVersionIds: ids, children, parents }
  }

  /**
   * 获取版本存储统计
   */
  getStats(): { totalVersions: number; totalTraces: number } {
    const chains = this.store.getAllChains()
    let total = 0
    for (const versions of chains.values()) {
      total += versions.length
    }
    return { totalVersions: total, totalTraces: chains.size }
  }
}

// 进程内全局实例
export const globalExecutionMemory = new ExecutionMemoryLayer()
