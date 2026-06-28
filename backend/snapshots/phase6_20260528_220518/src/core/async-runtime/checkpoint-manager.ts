/**
 * P4 — CheckpointManager（检查点管理器）
 *
 * 支持 Graph 执行 checkpoint 保存和 resume。
 * 每个 Node 完成后自动保存 checkpoint。
 *
 * ═══ 宪法 ═══
 * 所有 Async Graph 执行必须支持 checkpoint。
 * 检查点必须包含完整的执行状态，支持从任意节点 resume。
 */

import { executionStateStore } from './execution-state-store.js'
import { eventBus } from './event-bus.js'

export interface Checkpoint {
  graphId: string
  nodeId: string
  completedNodes: string[]
  failedNodes: string[]
  context: Record<string, any>
  timestamp: number
  version: number
}

class CheckpointManager {
  private checkpoints: Map<string, Checkpoint[]> = new Map()
  private versionCounter = 0

  /**
   * 为图中某个节点保存 checkpoint
   */
  async save(graphId: string, nodeId: string): Promise<Checkpoint> {
    const graph = executionStateStore.getGraph(graphId)
    if (!graph) throw new Error(`[CheckpointManager] 图 "${graphId}" 不存在`)

    const completedNodes: string[] = []
    const failedNodes: string[] = []

    for (const [nid, node] of graph.nodes) {
      if (node.status === 'completed') completedNodes.push(nid)
      if (node.status === 'failed') failedNodes.push(nid)
    }

    const context: Record<string, any> = {}
    for (const [key, value] of graph.context) {
      context[key] = value
    }

    this.versionCounter++
    const checkpoint: Checkpoint = {
      graphId,
      nodeId,
      completedNodes,
      failedNodes,
      context,
      timestamp: Date.now(),
      version: this.versionCounter,
    }

    const history = this.checkpoints.get(graphId) || []
    history.push(checkpoint)
    this.checkpoints.set(graphId, history)

    graph.checkpointCount++

    await eventBus.emitSimple('checkpoint_saved', graphId, {
      nodeId,
      payload: { version: checkpoint.version, completedCount: completedNodes.length },
    })

    console.log(`[CheckpointManager] 💾 checkpoint v${checkpoint.version}: 图="${graphId}" 节点="${nodeId}" 已完成 ${completedNodes.length}/${graph.topology.length} 个节点`)
    return checkpoint
  }

  /**
   * 加载最新 checkpoint
   */
  async load(graphId: string): Promise<Checkpoint | null> {
    const history = this.checkpoints.get(graphId)
    if (!history || history.length === 0) return null
    return history[history.length - 1]
  }

  /**
   * 从 checkpoint 恢复状态到 store
   */
  async resume(graphId: string): Promise<Checkpoint | null> {
    const checkpoint = await this.load(graphId)
    if (!checkpoint) return null

    const graph = executionStateStore.getGraph(graphId)
    if (graph) {
      // 恢复上下文
      for (const [key, value] of Object.entries(checkpoint.context)) {
        graph.context.set(key, value)
      }
    }

    await eventBus.emitSimple('checkpoint_loaded', graphId, {
      payload: { version: checkpoint.version },
    })

    console.log(`[CheckpointManager] 🔄 resume 图="${graphId}" 从 checkpoint v${checkpoint.version} (${checkpoint.completedNodes.length} 个已完成节点)`)
    return checkpoint
  }
}

export const checkpointManager = new CheckpointManager()
