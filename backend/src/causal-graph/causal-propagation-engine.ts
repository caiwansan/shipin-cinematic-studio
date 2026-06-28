/**
 * Causal Propagation Engine
 * 因果传播引擎 — 编辑一个节点后，自动传播影响
 *
 * 核心规则：
 *   FORWARD: 修改上游 → 所有下游重算（depth-limited）
 *   BACKWARD: 修改情感弧线 → 反推镜头类型
 *   CONSTRAINT: 图深度最多 5 hop，防止循环
 *
 * 编辑即传播：
 *   user edits node[N]
 *   → mark node[N] as dirty
 *   → forwardPropagate(node[N], newState)
 *   → mark affected nodes as dirty
 *   → return affected node list for shot-recompiler
 */

import {
  DirectorCausalGraph,
  CausalNode,
  CausalEdge,
  CausalPatch,
} from './causal-graph-types'

export interface PropagationResult {
  affectedNodeIds: string[]
  patches: CausalPatch[]
  propagatedHops: number
  terminatedBy: 'max_depth' | 'stable' | 'cycle_detected'
}

export interface PropagationConfig {
  maxForwardDepth: number  // 默认 5
  maxBackwardDepth: number // 默认 3
  enableBackward: boolean  // 是否允许反向传播
}

const DEFAULT_CONFIG: PropagationConfig = {
  maxForwardDepth: 5,
  maxBackwardDepth: 3,
  enableBackward: true,
}

/**
 * 编辑节点 → 传播影响
 */
export function propagateChange(
  graph: DirectorCausalGraph,
  nodeId: string,
  newState: Record<string, any>,
  config: PropagationConfig = DEFAULT_CONFIG,
): PropagationResult {
  const node = graph.nodes.get(nodeId)
  if (!node) {
    return {
      affectedNodeIds: [],
      patches: [],
      propagatedHops: 0,
      terminatedBy: 'stable',
    }
  }

  const oldState = { ...node.state }
  node.state = { ...node.state, ...newState }
  node.meta.dirty = true
  graph.version++

  const patches: CausalPatch[] = [
    {
      type: 'UPDATE_NODE',
      nodeId,
      oldState,
      newState: node.state,
    },
  ]

  // 前向传播
  const forwardResult = forwardPropagate(graph, nodeId, patches, 0, new Set(), config)

  // 后向传播（可选）
  const backwardPatches: CausalPatch[] = []
  if (config.enableBackward) {
    backwardPropagate(graph, nodeId, backwardPatches, 0, new Set(), config)
  }

  const allPatches = [...patches, ...forwardResult.patches, ...backwardPatches]
  const affectedIds = [...new Set(allPatches.map(p => p.nodeId).filter(Boolean) as string[])]

  return {
    affectedNodeIds: affectedIds,
    patches: allPatches,
    propagatedHops: forwardResult.hops,
    terminatedBy: forwardResult.terminatedBy,
  }
}

/**
 * 前向传播：从 nodeId 出发，沿出边传播
 */
function forwardPropagate(
  graph: DirectorCausalGraph,
  nodeId: string,
  patches: CausalPatch[],
  depth: number,
  visited: Set<string>,
  config: PropagationConfig,
): { patches: CausalPatch[]; hops: number; terminatedBy: 'max_depth' | 'stable' | 'cycle_detected' } {
  if (depth >= config.maxForwardDepth) {
    return { patches, hops: depth, terminatedBy: 'max_depth' }
  }
  if (visited.has(nodeId)) {
    return { patches, hops: depth, terminatedBy: 'cycle_detected' }
  }
  visited.add(nodeId)

  const currentNode = graph.nodes.get(nodeId)
  if (!currentNode) {
    return { patches, hops: depth, terminatedBy: 'stable' }
  }

  // 找到所有出边目标
  const outEdges = graph.edges.filter(e => e.from === nodeId)
  let maxHops = depth

  for (const edge of outEdges) {
    const targetNode = graph.nodes.get(edge.to)
    if (!targetNode) continue

    // 根据关系和层类型推导新状态
    const newTargetState = deriveTargetState(
      currentNode,
      targetNode,
      edge,
    )

    if (newTargetState) {
      const oldState = { ...targetNode.state }
      targetNode.state = { ...targetNode.state, ...newTargetState }
      targetNode.meta.dirty = true

      patches.push({
        type: 'UPDATE_NODE',
        nodeId: targetNode.id,
        oldState,
        newState: targetNode.state,
      })

      // 递归传播
      const sub = forwardPropagate(graph, targetNode.id, patches, depth + 1, visited, config)
      maxHops = Math.max(maxHops, sub.hops)
    }
  }

  return { patches, hops: maxHops, terminatedBy: 'stable' }
}

/**
 * 后向传播：从 nodeId 出发，沿入边反向传播
 */
function backwardPropagate(
  graph: DirectorCausalGraph,
  nodeId: string,
  patches: CausalPatch[],
  depth: number,
  visited: Set<string>,
  config: PropagationConfig,
): void {
  if (depth >= config.maxBackwardDepth) return
  if (visited.has(nodeId)) return
  visited.add(nodeId)

  const inEdges = graph.edges.filter(e => e.to === nodeId)

  for (const edge of inEdges) {
    const sourceNode = graph.nodes.get(edge.from)
    if (!sourceNode) continue

    // 反向推导
    const backState = deriveBackwardState(
      nodeId,
      graph,
    )

    if (backState) {
      const oldState = { ...sourceNode.state }
      sourceNode.state = { ...sourceNode.state, ...backState }
      sourceNode.meta.dirty = true

      patches.push({
        type: 'UPDATE_NODE',
        nodeId: sourceNode.id,
        oldState,
        newState: sourceNode.state,
      })

      backwardPropagate(graph, sourceNode.id, patches, depth + 1, visited, config)
    }
  }
}

/**
 * 推导目标节点的新状态
 * 从 source 节点状态 + 边关系 → target 节点应更新的字段
 */
function deriveTargetState(
  source: CausalNode,
  target: CausalNode,
  edge: CausalEdge,
): Record<string, any> | null {
  const s = source.state
  const t = target.state

  // shot → grammar: 根据 shot 类型推导 grammar 类型
  if (source.layer === 'shot' && target.layer === 'grammar') {
    const grammarMap: Record<string, string> = {
      wide: 'establishing',
      medium: 'build_up',
      close_up: 'peak',
      closeup: 'peak',
      'close-up': 'peak',
      tracking: 'build_up',
      aerial: 'establishing',
      push_in: 'build_up',
    }
    // 提取 shot 中的 camera 信息
    const cameraType = s.camera?.type ?? s.type ?? ''
    const newGrammar = grammarMap[cameraType.toLowerCase()] ?? t.grammarType
    if (newGrammar && newGrammar !== t.grammarType) {
      return { grammarType: newGrammar }
    }
  }

  // grammar → motion: 根据 grammar 类型推导运动风格
  if (source.layer === 'grammar' && target.layer === 'motion') {
    const motionMap: Record<string, any> = {
      establishing: { motionStyle: 'static_observant', pressure: 0.2 },
      build_up: { motionStyle: 'pressured_tracking', pressure: 0.5 },
      peak: { motionStyle: 'chaotic_handheld', pressure: 0.8, instability: 0.7 },
      release: { motionStyle: 'calm_retreat', pressure: 0.3 },
      reaction: { motionStyle: 'observant', pressure: 0.3 },
    }
    const gramType = s.grammarType ?? t.grammarType ?? ''
    return motionMap[gramType] ?? null
  }

  // grammar → emotion: grammar 类型对应情绪特征
  if (source.layer === 'grammar' && target.layer === 'emotion') {
    const emotionMap: Record<string, any> = {
      establishing: { mood: 'calm', tension: 0.3 },
      build_up: { mood: 'rising', tension: 0.6 },
      peak: { mood: 'explosive', tension: 0.9 },
      release: { mood: 'resolved', tension: 0.4 },
      reaction: { mood: 'calm', tension: 0.4 },
    }
    const gramType = s.grammarType ?? t.grammarType ?? ''
    return emotionMap[gramType] ?? null
  }

  // motion → emotion
  if (source.layer === 'motion' && target.layer === 'emotion') {
    if (s.pressure !== undefined && s.pressure > 0.6) {
      return { tension: Math.min((s.pressure + 0.2), 1) }
    }
    if (s.instability !== undefined && s.instability > 0.5) {
      return { mood: 'tensed' }
    }
  }

  // emotion → temporal: 情绪强度影响连续性
  if (source.layer === 'emotion' && target.layer === 'temporal') {
    const tension = s.tension ?? 0.5
    if (tension > 0.8) {
      // 高张力镜头连续性可能下降（因为动作剧烈）
      return { continuityScore: Math.max(0.3, (t.temporalContinuity ?? 0.7) - 0.2) }
    }
  }

  return null
}

/**
 * 反向推导：从目标节点状态反推源节点
 */
function deriveBackwardState(
  targetNodeId: string,
  graph: DirectorCausalGraph,
): Record<string, any> | null {
  const target = graph.nodes.get(targetNodeId)
  if (!target) return null

  // emotion → grammar: 如果 emotion 变强，push grammar 到更强的类型
  if (target.layer === 'emotion') {
    const tension = target.state.tension ?? 0.5
    if (tension > 0.7) {
      return { grammarType: 'peak' }
    }
    if (tension > 0.4 && tension <= 0.7) {
      return { grammarType: 'build_up' }
    }
    return { grammarType: 'release' }
  }

  // motion → grammar: 运动风格反推 grammar
  if (target.layer === 'motion') {
    const styleMap: Record<string, string> = {
      static_observant: 'establishing',
      pressured_tracking: 'build_up',
      chaotic_handheld: 'peak',
      calm_retreat: 'release',
    }
    const style = target.state.motionStyle ?? ''
    const grammar = styleMap[style]
    if (grammar) return { grammarType: grammar }
  }

  return null
}

/**
 * 清除所有脏标记（传播完成后调用）
 */
export function cleanDirtyFlags(graph: DirectorCausalGraph): void {
  for (const [, node] of graph.nodes) {
    node.meta.dirty = false
  }
}

/**
 * 获取所有脏节点
 */
export function getDirtyNodes(graph: DirectorCausalGraph): CausalNode[] {
  const dirty: CausalNode[] = []
  for (const [, node] of graph.nodes) {
    if (node.meta.dirty) dirty.push(node)
  }
  return dirty
}
