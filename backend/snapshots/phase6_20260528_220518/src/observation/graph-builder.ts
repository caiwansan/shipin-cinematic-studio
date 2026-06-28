/**
 * observation/graph-builder.ts — DAG → 可视化图
 *
 * 纯函数：WorkflowGraph → VisualGraph
 * 不涉及任何 runtime 状态。
 *
 * 所属层：Observation Layer
 */

import type { WorkflowGraph } from '../workflow/types.js'
import type { VisualGraph, VisualNode } from './types.js'

const TYPE_LABELS: Record<string, string> = {
  'llm.optimize': 'LLM 优化',
  'image.generate': '图片生成',
  'video.generate': '视频生成',
  'tts.generate': '语音合成',
  'manual.confirm': '人工确认',
}

/** 从 WorkflowGraph 构建可视化图（所有节点初始 pending） */
export function buildVisualGraph(workflowGraph: WorkflowGraph): VisualGraph {
  const nodes: VisualNode[] = workflowGraph.nodes.map(n => ({
    id: n.id,
    type: n.type,
    label: TYPE_LABELS[n.type] || n.type,
    status: 'pending',
  }))

  const edges: { from: string; to: string }[] = workflowGraph.nodes.flatMap(n =>
    (n.dependsOn || []).map(dep => ({
      from: dep,
      to: n.id,
    }))
  )

  return {
    id: workflowGraph.id,
    nodes,
    edges,
  }
}

/** 拓扑排序（层编号——用于前端渲染布局） */
export function buildNodeLayout(graph: VisualGraph): Map<string, number> {
  const inDegree = new Map<string, number>()
  const depth = new Map<string, number>()

  for (const n of graph.nodes) {
    inDegree.set(n.id, 0)
    depth.set(n.id, 0)
  }

  for (const e of graph.edges) {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  let idx = 0
  while (idx < queue.length) {
    const current = queue[idx++]
    for (const e of graph.edges) {
      if (e.from !== current) continue
      const newDepth = (depth.get(current) || 0) + 1
      if (newDepth > (depth.get(e.to) || 0)) {
        depth.set(e.to, newDepth)
      }
      inDegree.set(e.to, (inDegree.get(e.to) || 1) - 1)
      if (inDegree.get(e.to) === 0) {
        queue.push(e.to)
      }
    }
  }

  return depth
}
