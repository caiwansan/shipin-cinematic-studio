/**
 * P5 — ConsistencyManager（一致性管理器）
 *
 * 处理分布式执行中的状态一致性。
 * 当前使用最终一致性模型（eventual consistency）。
 *
 * ═══ 宪法 ═══
 * 分布式执行必须保证最终一致性。
 * 节点间的状态差异必须被检测和修复。
 * 禁止状态的无限分歧。
 */

import { nodeRegistry } from './node-registry.js'
import { executionStateStore } from '../async-runtime/execution-state-store.js'

export interface ConsistencyReport {
  timestamp: number
  totalGraphs: number
  totalNodes: number
  deviations: number
  reconciled: boolean
}

class ConsistencyManager {
  private reports: ConsistencyReport[] = []

  /**
   * 执行一致性检查
   */
  async reconcile(): Promise<ConsistencyReport> {
    const timestamp = Date.now()

    // 获取所有图状态
    const graphs = executionStateStore.listGraphs()
    const clusterSummary = nodeRegistry.getSummary()

    // 检查一致性问题
    let deviations = 0
    for (const graph of graphs) {
      const state = executionStateStore.getGraph(graph.graphId)
      if (!state) continue

      // 检查是否 pending 状态但节点已停止
      if (state.status === 'running') {
        // 在分布式环境中，应检查节点是否还活着
        // 如果运行节点已经 dead，标记为 failed
        if (clusterSummary.alive === 0 && clusterSummary.dead > 0) {
          executionStateStore.updateGraphStatus(graph.graphId, 'failed')
          deviations++
          console.log(`[ConsistencyManager] 🔧 修复: 图 "${graph.graphId.substring(0, 8)}" 标记为 failed (节点全部死亡)`)
        }
      }
    }

    const report: ConsistencyReport = {
      timestamp,
      totalGraphs: graphs.length,
      totalNodes: clusterSummary.total,
      deviations,
      reconciled: deviations === 0,
    }

    this.reports.push(report)
    console.log(`[ConsistencyManager] ✅ 一致性检查完成: ${deviations} 处偏差`)

    return report
  }

  /**
   * 获取历史报告
   */
  getReports(): ConsistencyReport[] {
    return [...this.reports]
  }
}

export const consistencyManager = new ConsistencyManager()
