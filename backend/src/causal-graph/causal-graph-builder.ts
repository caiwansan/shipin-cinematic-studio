/**
 * Causal Graph Builder
 * 因果图构建器 — 从 DirectorTraceEvent[] 反推因果 DAG
 *
 * 核心原则：
 *   trace 是线性的"日志"
 *   causal graph 是结构化的"因果网"
 *   构建器负责从日志反推结构
 *
 * 构建规则（宪法级）：
 *   1. SEQUENTIAL CAUSALITY: trace[i] → trace[i+1] = default edge (causes)
 *   2. CROSS-LAYER BINDING: shot → grammar → motion → emotion → temporal
 *   3. STATE DERIVATION: motion depends on grammar intensity, emotion depends on shot type
 *   4. SAME-SHOT MERGE: 同镜头的同层事件 collapse 为一个 node
 */

import {
  DirectorTraceEvent,
  DirectorCausalGraph,
  CausalNode,
  CausalEdge,
  CausalLayer,
  NodeType,
  createEmptyGraph,
} from './causal-graph-types'

// ─── 事件类型 → NodeType 映射 ────────────────

const EVENT_TO_NODE_TYPE: Record<string, NodeType> = {
  SHOT_COMPILED: 'shot',
  SHOT_COMPILE_START: 'shot',
  BATCH_COMPILE_START: 'shot',

  GRAMMAR_INIT: 'grammar_type',
  SHOT_GRAMMAR_RESOLVED: 'grammar_type',
  EMOTION_COMPUTED: 'emotion_state',
  TRANSITION_MATCHED: 'grammar_type',

  MOTION_INIT: 'motion_intent',
  MOTION_INTENT_COMPUTED: 'motion_intent',
  PHYSICS_VALIDATED: 'motion_intent',

  CHARACTER_IDENTITY_LOADED: 'character_state',
  DRIFT_CHECKED: 'character_state',
  STABILIZATION_APPLIED: 'character_state',
  PERSISTENCE_INIT: 'character_state',

  TEMPORAL_INIT: 'temporal_state',
  SHOT_COMPILED: 'temporal_state',
  CONTINUITY_RESOLVED: 'temporal_state',
}

const EVENT_TO_LAYER: Record<string, CausalLayer> = {
  SHOT_COMPILED: 'shot',
  SHOT_COMPILE_START: 'shot',
  BATCH_COMPILE_START: 'shot',

  GRAMMAR_INIT: 'grammar',
  SHOT_GRAMMAR_RESOLVED: 'grammar',
  EMOTION_COMPUTED: 'emotion',
  TRANSITION_MATCHED: 'grammar',

  MOTION_INIT: 'motion',
  MOTION_INTENT_COMPUTED: 'motion',
  PHYSICS_VALIDATED: 'motion',

  CHARACTER_IDENTITY_LOADED: 'character',
  DRIFT_CHECKED: 'character',
  STABILIZATION_APPLIED: 'character',
  PERSISTENCE_INIT: 'character',

  TEMPORAL_INIT: 'temporal',
  SHOT_COMPILED: 'temporal',
  CONTINUITY_RESOLVED: 'temporal',
}

/**
 * 从 trace 事件列表构建因果图
 */
export function buildFromTrace(
  traceId: string,
  events: DirectorTraceEvent[],
): DirectorCausalGraph {
  const graph = createEmptyGraph()
  const seenNodeKey = new Set<string>()
  const lastNodePerShot: Map<number, string> = new Map()
  let prevNodeId: string | null = null

  for (const event of events) {
    const nodeType = EVENT_TO_NODE_TYPE[event.type]
    const layer = EVENT_TO_LAYER[event.type]
    if (!nodeType || !layer) {
      // 用默认映射
      continue
    }

    // 推断 shotIndex
    const shotIndex = event.shotIndex ?? event.payload?.shotIndex ?? event.payload?.index ?? event.payload?.shot ?? 0

    // 构造节点 key（同镜头同层 node 合并）
    const nodeKey = `${shotIndex}_${layer}`

    let node: CausalNode

    if (seenNodeKey.has(nodeKey)) {
      // 同 node 更新状态（same-shot merge）
      node = graph.nodes.get(nodeKey)!
      node.state = { ...node.state, ...buildNodeState(event) }
      node.meta.dirty = true
    } else {
      // 新建 node
      node = {
        id: nodeKey,
        layer,
        type: nodeType,
        shotIndex,
        state: buildNodeState(event),
        meta: {
          createdAt: event.timestamp,
          traceSeq: event.seq,
          mutable: layer !== 'temporal', // temporal 不可编辑
          dirty: false,
        },
      }
      graph.nodes.set(nodeKey, node)
      seenNodeKey.add(nodeKey)

      // 更新 shotIndex
      if (!graph.shotIndex.has(shotIndex)) {
        graph.shotIndex.set(shotIndex, [])
      }
      graph.shotIndex.get(shotIndex)!.push(nodeKey)
    }

    // ── 构建边 ──

    // 规则1：时序因果性 trace[i] → trace[i+1]
    if (prevNodeId) {
      addEdge(graph, prevNodeId, node.id, 'causes', 0.3)
    }
    prevNodeId = node.id

    // 规则2：同镜头 intra-layer 连接（shot → grammar → motion → emotion）
    const prevLayerNode = lastNodePerShot.get(shotIndex)
    if (prevLayerNode && prevLayerNode !== node.id) {
      addEdge(graph, prevLayerNode, node.id, 'refines', 0.5)
    }
    lastNodePerShot.set(shotIndex, node.id)

    // 规则3：跨镜头相邻连接（shot_i 影响 shot_i+1）
    if (shotIndex > 0) {
      const prevShotNodes = graph.shotIndex.get(shotIndex - 1) ?? []
      for (const prevNodeId of prevShotNodes) {
        const prevLayer = graph.nodes.get(prevNodeId)?.layer
        // 跨镜头同层连接（连续性）
        if (prevLayer === layer && prevNodeId !== node.id) {
          addEdge(graph, prevNodeId, node.id, 'constrains', 0.4)
        }
      }
    }
  }

  // 规则4：跨层绑定 — shot × grammar × motion × emotion
  bindCrossLayer(graph)

  return graph
}

/**
 * 构建单事件节点状态
 */
function buildNodeState(event: DirectorTraceEvent): Record<string, any> {
  const payload = event.payload ?? {}
  return {
    type: event.type,
    ...payload,
  }
}

/**
 * 添加去重边
 */
function addEdge(
  graph: DirectorCausalGraph,
  from: string,
  to: string,
  relation: CausalEdge['relation'],
  weight: number,
): void {
  // 自引用跳过
  if (from === to) return

  // 去重
  const exists = graph.edges.some(
    e => e.from === from && e.to === to,
  )
  if (!exists) {
    graph.edges.push({
      id: `${from}→${to}`,
      from,
      to,
      relation,
      weight,
    })
  }
}

/**
 * 跨层绑定 — 建立 shot/grammar/motion/emotion 之间的因果边
 * 不增加新边，而是强化已有跨层边的权重
 */
function bindCrossLayer(graph: DirectorCausalGraph): void {
  for (const [, nodeIds] of graph.shotIndex) {
    // 找到该镜头的各层节点
    const layers: Record<string, string> = {}
    for (const nid of nodeIds) {
      const node = graph.nodes.get(nid)
      if (node) {
        layers[node.layer] = nid
      }
    }

    // 绑定 shot → grammar → motion → emotion
    const layerOrder: CausalLayer[] = ['shot', 'grammar', 'motion', 'emotion', 'character', 'temporal']
    for (let i = 0; i < layerOrder.length - 1; i++) {
      const from = layers[layerOrder[i]]
      const to = layers[layerOrder[i + 1]]
      if (from && to) {
        // 提升权重（跨层影响更强）
        const existing = graph.edges.find(e => e.from === from && e.to === to)
        if (existing) {
          existing.relation = 'causes'
          existing.weight = Math.max(existing.weight, 0.8)
        }
      }
    }
  }
}

/**
 * 从图获取特定 shot 的完整因果链
 */
export function getShotChain(
  graph: DirectorCausalGraph,
  shotIndex: number,
): CausalNode[] {
  const nodeIds = graph.shotIndex.get(shotIndex) ?? []
  return nodeIds
    .map(id => graph.nodes.get(id))
    .filter((n): n is CausalNode => n !== undefined)
    .sort((a, b) => a.meta.traceSeq - b.meta.traceSeq)
}

/**
 * 从图获取完整的有序节点列表（拓扑排序近似）
 */
export function getTopologicalNodes(graph: DirectorCausalGraph): CausalNode[] {
  const visited = new Set<string>()
  const result: CausalNode[] = []

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    // 先访问入边节点（前驱）
    for (const edge of graph.edges) {
      if (edge.to === nodeId) visit(edge.from)
    }

    const node = graph.nodes.get(nodeId)
    if (node) result.push(node)
  }

  for (const [nodeId] of graph.nodes) {
    visit(nodeId)
  }

  return result
}

export function graphToJSON(graph: DirectorCausalGraph): any {
  return {
    nodes: Array.from(graph.nodes.values()),
    edges: graph.edges,
    shotIndex: Array.from(graph.shotIndex.entries()).map(([k, v]) => ({ shotIndex: k, nodes: v })),
    createdAt: graph.createdAt,
    version: graph.version,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
  }
}
