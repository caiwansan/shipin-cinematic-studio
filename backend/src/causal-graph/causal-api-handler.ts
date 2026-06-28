/**
 * Causal Graph API Handler
 * 因果图编辑 API — 编辑节点 + 传播 + 重编译 + 返回 patch
 */

import { traceCollector } from '../replay-engine/director-trace-collector.js'
import { buildFromTrace, graphToJSON, getShotChain, getTopologicalNodes } from './causal-graph-builder.js'
import { propagateChange, cleanDirtyFlags, getDirtyNodes } from './causal-propagation-engine.js'
import { recompileSubgraph } from './shot-recompiler.js'
import {
  DirectorCausalGraph,
  DirectorTraceEvent,
  CausalPatch,
  createEmptyGraph,
} from './causal-graph-types.js'

// ── 内存中的因果图缓存 ──

const graphCache = new Map<string, DirectorCausalGraph>()

/**
 * 从 trace 构建因果图
 */
export function handleBuildGraph(traceId: string) {
  const events = traceCollector.getEvents(traceId)
  if (events.length === 0) {
    return { success: false, error: 'Trace not found or empty' }
  }

  const graph = buildFromTrace(traceId, events)
  graphCache.set(traceId, graph)

  return {
    success: true,
    graph: graphToJSON(graph),
  }
}

/**
 * 编辑图中的一个节点
 */
export function handleEditNode(params: {
  traceId: string
  nodeId: string
  newState: Record<string, any>
}) {
  const { traceId, nodeId, newState } = params
  const graph = graphCache.get(traceId)
  if (!graph) {
    return { success: false, error: 'Graph not found. Build it first.' }
  }

  const node = graph.nodes.get(nodeId)
  if (!node) {
    return { success: false, error: `Node ${nodeId} not found` }
  }
  if (!node.meta.mutable) {
    return { success: false, error: `Node ${nodeId} is immutable` }
  }

  // 1. 传播影响
  const propagation = propagateChange(graph, nodeId, newState)

  // 2. 局部重编译
  const recompile = recompileSubgraph(graph, propagation)

  // 3. 清理脏标记
  cleanDirtyFlags(graph)

  // 4. 记录编辑 trace
  traceCollector.emit('shot', 'NODE_EDITED', {
    nodeId,
    traceId,
    newState,
    patches: recompile.patches.length,
    propagationHops: propagation.propagatedHops,
  }, traceId)

  return {
    success: true,
    editedNodeId: nodeId,
    patchCount: recompile.patches.length,
    affectedNodes: propagation.affectedNodeIds.length,
    patches: recompile.patches,
    propagationResult: {
      hops: propagation.propagatedHops,
      terminatedBy: propagation.terminatedBy,
    },
    dirtyNodes: getDirtyNodes(graph).length,
    newGraph: graphToJSON(graph),
  }
}

/**
 * 获取指定镜头的因果链
 */
export function handleGetShotChain(params: { traceId: string; shotIndex: number }) {
  const graph = graphCache.get(params.traceId)
  if (!graph) return { success: false, error: 'Graph not found' }

  const chain = getShotChain(graph, params.shotIndex)
  return {
    success: true,
    shotIndex: params.shotIndex,
    chain: chain.map(n => ({
      id: n.id,
      layer: n.layer,
      type: n.type,
      state: n.state,
      dirty: n.meta.dirty,
      mutable: n.meta.mutable,
    })),
  }
}

/**
 * 获取全图拓扑排序
 */
export function handleGetTopology(params: { traceId: string }) {
  const graph = graphCache.get(params.traceId)
  if (!graph) return { success: false, error: 'Graph not found' }

  const nodes = getTopologicalNodes(graph)
  return {
    success: true,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
    topologicalOrder: nodes.map(n => ({
      id: n.id,
      layer: n.layer,
      shotIndex: n.shotIndex,
    })),
  }
}

/**
 * 清空图缓存
 */
export function handleClearCache(traceId?: string) {
  if (traceId) {
    graphCache.delete(traceId)
    return { success: true, removed: traceId }
  }
  const count = graphCache.size
  graphCache.clear()
  return { success: true, removed: count }
}
