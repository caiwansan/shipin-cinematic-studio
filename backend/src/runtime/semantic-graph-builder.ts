/**
 * Semantic Graph Builder — FilmLanguageIR → Graph Runtime
 *
 * ═══════════════════════════════════════════════════════════════
 * S2: Semantic Graph Builder
 *
 *   FilmLanguageIR（Canonical AST — 保存数据）
 *   │
 *   └── buildFromFilmIR() ── 纯函数、确定性
 *       │
 *       ▼
 *   GraphRuntime（Canonical Graph — 表达关系）
 *
 * 原则：
 *   - Graph 不重复存储 FilmIR 的数据，只存储关系
 *   - 所有节点和边使用稳定 ID（Stable Identifier Principle）
 *   - 从 AST 推导关系（不依赖外部信息）
 *   - 支持四视图投影
 *
 * ═══════════════════════════════════════════════════════════════
 */

import type { FilmLanguageIR, FilmIRCharacter, FilmIRAction } from './film-language-ir.js'
import type { GraphRuntime, GraphNode, GraphEdge } from './graph-runtime.js'
import { generateNodeId, generateEdgeId, validateGraph } from './graph-runtime.js'
import type { SceneGraphView, EventGraphView, TimelineView, DependencyView } from './graph-runtime.js'
import type { GraphValidationReport } from './graph-runtime.js'

// ─── 主构建函数 ────────────────────────────────────────

/**
 * 从 FilmLanguageIR 构建 Semantic Graph Runtime。
 *
 * @param ir - 冻结的 Canonical FilmLanguageIR
 * @returns GraphRuntime + 验证报告
 */
export function buildFromFilmIR(ir: FilmLanguageIR): {
  graph: GraphRuntime
  validation: GraphValidationReport
} {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  // 1. 创建场景节点
  const sceneNode = createNode('location', ir.scene.location || '未命名场景')
  nodes.set(sceneNode.id, sceneNode)

  // 2. 创建角色节点 + 角色 ↔ 场景关系
  const charNodes: GraphNode[] = []
  for (const char of ir.characters) {
    const node = createNode('character', char.name)
    charNodes.push(node)
    nodes.set(node.id, node)

    // 角色位于场景中
    edges.push(createEdge(node.id, sceneNode.id, 'stands-in', { position: char.position }))
  }

  // 3. 为每个 action 创建事件节点 + 事件关系
  const eventNodes: GraphNode[] = []
  for (const action of ir.action) {
    const eventNode = createNode('event', action.type || '动作')
    eventNodes.push(eventNode)
    nodes.set(eventNode.id, eventNode)

    // 事件由角色执行
    const actorNode = [...nodes.values()].find(n => n.type === 'character' && n.label === action.subject)
    if (actorNode) {
      edges.push(createEdge(eventNode.id, actorNode.id, 'interacts-with', {}))
    }

    // 事件之间有跟随关系（按 action 数组顺序）
    if (eventNodes.length > 1) {
      const prevEvent = eventNodes[eventNodes.length - 2]
      edges.push(createEdge(prevEvent.id, eventNode.id, 'follows', {}))
    }
  }

  // 4. 相机作为节点
  const cameraNode = createNode('camera', '相机', { shotType: ir.camera.shotType, movement: ir.camera.movement })
  nodes.set(cameraNode.id, cameraNode)

  // 场景使用相机
  edges.push(createEdge(sceneNode.id, cameraNode.id, 'constrains', { type: 'camera' }))

  // 5. 光照作为节点
  const lightNode = createNode('lighting', '光照', { keyLight: ir.lighting.keyLight, mood: ir.lighting.mood })
  nodes.set(lightNode.id, lightNode)
  edges.push(createEdge(sceneNode.id, lightNode.id, 'constrains', { type: 'lighting' }))

  // 6. 如果有 action.target（道具），创建 prop 节点
  for (const action of ir.action) {
    if (action.target && ![...nodes.values()].some(n => n.type === 'prop' && n.label === action.target)) {
      const propNode = createNode('prop', action.target)
      nodes.set(propNode.id, propNode)
      edges.push(createEdge(sceneNode.id, propNode.id, 'part-of', {}))
      // 角色持有道具
      const actorNode = [...nodes.values()].find(n => n.type === 'character' && n.label === action.subject)
      if (actorNode) {
        edges.push(createEdge(actorNode.id, propNode.id, 'holds', {}))
      }
    }
  }

  const graph: GraphRuntime = {
    metadata: {
      createdAt: new Date().toISOString(),
      sourceIrId: ir.metadata.id,
      sourceIrVersion: ir.metadata.version,
      nodeCount: nodes.size,
      edgeCount: edges.length,
    },
    nodes: new Map(nodes),
    edges,
  }

  const validation = validateGraph(graph)

  return { graph, validation }
}

// ─── 视图投影函数 ──────────────────────────────────────

export function toSceneGraph(graph: GraphRuntime): SceneGraphView {
  const spatialTypes = new Set(['stands-in', 'holds', 'attached-to', 'constrains', 'part-of'])
  const spatialEdges = graph.edges.filter(e => spatialTypes.has(e.type))

  return {
    type: 'scene-graph',
    metadata: { ...graph.metadata },
    locations: [...graph.nodes.values()].filter(n => n.type === 'location'),
    characters: [...graph.nodes.values()].filter(n => n.type === 'character'),
    props: [...graph.nodes.values()].filter(n => n.type === 'prop'),
    spatialEdges,
  }
}

export function toEventGraph(graph: GraphRuntime): EventGraphView {
  const causalTypes = new Set(['causes', 'follows', 'interacts-with', 'triggers'])
  const causalEdges = graph.edges.filter(e => causalTypes.has(e.type))

  return {
    type: 'event-graph',
    metadata: { ...graph.metadata },
    events: [...graph.nodes.values()].filter(n => n.type === 'event'),
    causalEdges,
  }
}

export function toTimeline(graph: GraphRuntime): TimelineView {
  const events = [...graph.nodes.values()].filter(n => n.type === 'event')
  // 按 follows 边排序
  const followsMap = new Map<string, string>()
  for (const edge of graph.edges) {
    if (edge.type === 'follows') {
      followsMap.set(edge.source, edge.target)
    }
  }
  const timeOrder: string[] = []
  if (events.length > 0) {
    // 找到没有前驱的事件（起始点）
    const hasPredecessor = new Set([...followsMap.values()])
    let currentId = events.find(e => !hasPredecessor.has(e.id))?.id
    while (currentId && !timeOrder.includes(currentId)) {
      timeOrder.push(currentId)
      currentId = followsMap.get(currentId)
    }
  }

  return {
    type: 'timeline',
    metadata: { ...graph.metadata },
    events,
    timeOrder,
    overlaps: [],
  }
}

export function toDependency(graph: GraphRuntime): DependencyView {
  const depEdges = graph.edges.filter(e => e.type === 'depends-on' || e.type === 'follows')
  const dependsOnMap = new Map<string, string[]>()
  const dependedByMap = new Map<string, string[]>()
  for (const edge of depEdges) {
    if (!dependsOnMap.has(edge.target)) dependsOnMap.set(edge.target, [])
    dependsOnMap.get(edge.target)!.push(edge.source)
    if (!dependedByMap.has(edge.source)) dependedByMap.set(edge.source, [])
    dependedByMap.get(edge.source)!.push(edge.target)
  }
  const rootSteps = [...graph.nodes.keys()].filter(id => !dependsOnMap.has(id) || dependsOnMap.get(id)!.length === 0)

  // 简单的并行分组：level-based
  const parallelGroups: string[][] = []
  let currentLevel = [...rootSteps]
  const visited = new Set<string>()
  while (currentLevel.length > 0) {
    parallelGroups.push([...currentLevel])
    for (const id of currentLevel) visited.add(id)
    const nextLevel: string[] = []
    for (const id of currentLevel) {
      const dependents = dependedByMap.get(id) || []
      for (const dep of dependents) {
        if (!visited.has(dep) && !nextLevel.includes(dep)) {
          nextLevel.push(dep)
        }
      }
    }
    currentLevel = nextLevel
  }

  return {
    type: 'dependency',
    metadata: { ...graph.metadata },
    rootSteps: [...rootSteps],
    dependencyEdges: depEdges,
    parallelGroups,
  }
}

// ─── 辅助函数 ──────────────────────────────────────────

function createNode(
  type: GraphNode['type'],
  label: string,
  data: Record<string, any> = {},
): GraphNode {
  return { id: generateNodeId(), type, label, data }
}

function createEdge(
  source: string,
  target: string,
  type: GraphEdge['type'],
  data: Record<string, any> = {},
): GraphEdge {
  return { id: generateEdgeId(), source, target, type, data }
}
