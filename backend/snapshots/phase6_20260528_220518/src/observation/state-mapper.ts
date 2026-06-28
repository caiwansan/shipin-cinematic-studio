/**
 * observation/state-mapper.ts — 执行状态 → 可视化图映射
 *
 * 纯投影：将 ExecutionTrace 的状态注入到 VisualGraph，不修改执行。
 *
 * 所属层：Observation Layer
 */

import type { VisualGraph, VisualNode, VisualNodeStatus } from './types.js'
import { ExecutionTracker, type ExecutionTrace } from './execution-tracker.js'

const tracker = new ExecutionTracker()

/** 将 trace 状态映射到可视化图 */
export function mapExecutionToGraph(
  graph: VisualGraph,
  trace: ExecutionTrace | null,
): VisualGraph {
  const nodeIds = graph.nodes.map(n => n.id)
  const statuses = tracker.getAllNodeStatuses(nodeIds, trace)

  const mappedNodes: VisualNode[] = graph.nodes.map(n => {
    const details = tracker.getNodeDetails(n.id, trace)
    return {
      ...n,
      status: statuses[n.id] || 'pending',
      durationMs: details?.durationMs,
      error: details?.error,
    }
  })

  return { ...graph, nodes: mappedNodes }
}

/** 简洁模式状态列表（用于轮询） */
export function mapExecutionToStatusList(
  graph: VisualGraph,
  trace: ExecutionTrace | null,
): { id: string; status: VisualNodeStatus; durationMs?: number; error?: string }[] {
  const nodeIds = graph.nodes.map(n => n.id)
  const statuses = tracker.getAllNodeStatuses(nodeIds, trace)

  return graph.nodes.map(n => {
    const details = tracker.getNodeDetails(n.id, trace)
    return {
      id: n.id,
      status: statuses[n.id] || 'pending',
      durationMs: details?.durationMs,
      error: details?.error,
    }
  })
}
