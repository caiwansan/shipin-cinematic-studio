/**
 * P4 — ResumeEngine（恢复引擎）
 *
 * 从失败/中断状态恢复图执行。
 * 结合 CheckpointManager 和 AsyncExecutor 实现。
 *
 * ═══ 宪法 ═══
 * 所有长时间运行的 Graph 必须可恢复。
 * Resume 必须从上一个 checkpoint 之后恢复，不重复执行已完成节点。
 */

import { executionStateStore } from './execution-state-store.js'
import { checkpointManager } from './checkpoint-manager.js'
import { asyncExecutor } from './async-executor.js'
import { eventBus } from './event-bus.js'

export class ResumeEngine {
  /**
   * 恢复图执行
   * 自动跳过已完成的节点，只执行 pending 和 failed 节点。
   */
  async resume(graphId: string): Promise<boolean> {
    const graph = executionStateStore.getGraph(graphId)
    if (!graph) {
      console.error(`[ResumeEngine] ❌ 图 "${graphId}" 不存在`)
      return false
    }

    if (graph.status === 'completed') {
      console.log(`[ResumeEngine] ℹ️ 图 "${graphId}" 已全部完成，无需恢复`)
      return true
    }

    console.log(`[ResumeEngine] 🔄 恢复图 "${graph.name}" (${graphId.substring(0, 8)})`)

    // 加载 checkpoint 恢复上下文
    await checkpointManager.resume(graphId)

    // 重置 failed/pending 节点
    for (const [, node] of graph.nodes) {
      if (node.status === 'failed') {
        node.status = 'pending'
        node.error = undefined
      }
    }

    // 继续执行
    await asyncExecutor.resumeGraph(graphId)
    return true
  }

  /**
   * 列出所有可恢复的图
   */
  listResumable(): Array<{
    graphId: string
    name: string
    failed: number
    completed: number
  }> {
    const result: Array<{ graphId: string; name: string; failed: number; completed: number }> = []

    for (const graph of executionStateStore.listGraphs()) {
      if (graph.status === 'completed' || graph.status === 'pending') continue

      const state = executionStateStore.getGraph(graph.graphId)
      if (!state) continue

      let failed = 0
      let completed = 0
      for (const [, node] of state.nodes) {
        if (node.status === 'failed') failed++
        if (node.status === 'completed') completed++
      }

      result.push({
        graphId: graph.graphId,
        name: graph.name,
        failed,
        completed,
      })
    }

    return result
  }
}

export const resumeEngine = new ResumeEngine()
