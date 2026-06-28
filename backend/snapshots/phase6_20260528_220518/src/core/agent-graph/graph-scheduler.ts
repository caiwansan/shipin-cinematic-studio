/**
 * P3 — GraphScheduler（图调度器）
 *
 * 调度 DAG 的执行节奏：优先级排序、公平调度、并行控制。
 * 与 P2 ControlPlane 的 Scheduler 配合，但运行在 Agent Graph 层。
 */

import { AgentGraph } from './agent-graph.js'

export interface SchedulingStrategy {
  /** 并行执行的最大节点数 */
  maxParallel: number
  /** 是否启用优先级排序 */
  enablePriority: boolean
}

export class GraphScheduler {
  private defaultStrategy: SchedulingStrategy = {
    maxParallel: 5,
    enablePriority: true,
  }

  /**
   * 获取图的可并行层（同层无依赖关系的节点）
   */
  getParallelLayers(graph: AgentGraph): string[][] {
    const sorted = graph.topologicalSort()
    const layers: string[][] = []
    const processed = new Set<string>()

    for (const nodeId of sorted) {
      const deps = graph.getDependencies(nodeId)
      const depsAllProcessed = deps.every(d => processed.has(d.id))

      if (depsAllProcessed) {
        processed.add(nodeId)
        // 找同层
        const lastLayer = layers[layers.length - 1] || []
        if (lastLayer.length === 0 || lastLayer.every(id => {
          const depsOfLayerNode = graph.getDependencies(id)
          return depsOfLayerNode.every(d => processed.has(d.id))
        })) {
          lastLayer.push(nodeId)
        } else {
          layers.push([nodeId])
        }
      }
    }

    return layers.filter(l => l.length > 0)
  }

  /**
   * 获取调度策略
   */
  getStrategy(custom?: Partial<SchedulingStrategy>): SchedulingStrategy {
    return { ...this.defaultStrategy, ...custom }
  }
}
