/**
 * Graph Runtime v0.1
 * ==================
 * 昆仑镜第二个核心内核——Graph Kernel。
 *
 * 关系：
 *   FilmLanguageIR（Canonical AST）—— 表达电影语言
 *            │
 *            ▼
 *   Graph Runtime（Canonical Graph）—— 表达电影内部关系
 *            │
 *       ┌────┼────┐
 *       ▼    ▼    ▼
 *    Scene  Event Timeline
 *    View   View   View
 *
 * 原则：
 *   - SceneGraph / EventGraph / Timeline 只是一个图的不同投影视图
 *   - 修改一个节点，不需要同时更新多个结构
 *   - Constraint Engine 可以跨视图检查一致性
 *   - 所有节点和边使用永久稳定 ID（Stable Identifier Principle）
 *
 * 状态：
 *   A3.5：Contract 冻结（类型 + 接口 + ID 规则）
 *   A4：完整实现（Builder + View Projector + Consistency Checker）
 */

// ─── 节点类型 ───

export type GraphNodeType =
  | 'character'
  | 'location'
  | 'prop'
  | 'action'
  | 'event'
  | 'camera'
  | 'lighting'
  | 'transition'
  | 'audio'
  | 'effect'

/** Graph 节点（永久稳定 ID） */
export interface GraphNode {
  id: string                    // node_xxx（Stable Identifier）
  type: GraphNodeType
  label: string                 // 人类可读名称
  data: Record<string, any>    // 节点属性（灵活扩展，A4 实现时定义 Schema）
}

// ─── 边类型 ───

export type GraphEdgeType =
  | 'holds'               // 持有（角色握道具）
  | 'looks-at'            // 注视
  | 'stands-in'           // 站在...中
  | 'interacts-with'      // 交互
  | 'moves-to'            // 移动到
  | 'follows'             // 跟随（时间顺序）
  | 'causes'              // 导致（因果）
  | 'overlaps'            // 重叠（时间重叠）
  | 'constrains'          // 约束
  | 'attached-to'         // 附着
  | 'part-of'             // 部分关系

/** Graph 边（永久稳定 ID） */
export interface GraphEdge {
  id: string                    // edge_xxx（Stable Identifier）
  source: string                // 源节点 ID
  target: string                // 目标节点 ID
  type: GraphEdgeType
  data: Record<string, any>    // 边属性
}

// ─── 图元数据 ───

export interface GraphMetadata {
  createdAt: string              // ISO 8601
  sourceIrId: string             // 来源 FilmLanguageIR ID
  sourceIrVersion: string        // 来源 IR 版本
  nodeCount: number
  edgeCount: number
}

// ─── Graph 运行时（统一底层图数据） ───

export interface GraphRuntime {
  metadata: GraphMetadata
  nodes: Map<string, GraphNode>     // id → node（Map 保证唯一）
  edges: GraphEdge[]                // 有序边列表
}

// ─── 三种投影视图 ───

export interface SceneGraphView {
  type: 'scene-graph'
  metadata: GraphMetadata
  locations: GraphNode[]
  characters: GraphNode[]
  props: GraphNode[]
  spatialEdges: GraphEdge[]         // stands-in, holds, attached-to, constrains
}

export interface EventGraphView {
  type: 'event-graph'
  metadata: GraphMetadata
  events: GraphNode[]
  causalEdges: GraphEdge[]          // causes, follows
}

export interface TimelineView {
  type: 'timeline'
  metadata: GraphMetadata
  events: GraphNode[]
  timeOrder: string[]               // 节点 ID 按时间顺序排列
  overlaps: Array<{
    nodeA: string
    nodeB: string
    overlapType: 'partial' | 'full' | 'contains'
  }>
}

// ─── 第四种投影视图：执行依赖 ───

export interface DependencyView {
  type: 'dependency'
  metadata: GraphMetadata
  rootSteps: string[]                // 无依赖的入口步骤节点 ID
  dependencyEdges: GraphEdge[]       // depends-on 边
  parallelGroups: string[][]         // 可并行执行的节点 ID 分组
}

// ─── Graph Runtime 接口 ───

export interface GraphRuntimeAPI {
  /** 从 FilmLanguageIR 构建完整的图 */
  build(irId: string, irVersion: string): GraphRuntime
  
  /** 添加节点（如果 ID 已存在则跳过） */
  addNode(node: GraphNode): boolean
  
  /** 添加边 */
  addEdge(edge: GraphEdge): boolean
  
  /** 批量添加 */
  import(nodes: GraphNode[], edges: GraphEdge[]): void
  
  /** 查询节点 */
  getNode(id: string): GraphNode | undefined
  
  /** 按类型查询节点 */
  getNodesByType(type: GraphNodeType): GraphNode[]
  
  /** 查询 Scene 视图 */
  toSceneGraph(): SceneGraphView
  
  /** 查询 Event 视图 */
  toEventGraph(): EventGraphView
  
  /** 查询 Timeline 视图 */
  toTimeline(): TimelineView
  
  /** 跨视图一致性检查 */
  checkConsistency(): string[]
  
  /** 查询执行依赖视图 */
  toDependency(): DependencyView
  
  /** 全量图验证：孤立节点 / 循环依赖 / 不存在引用 / 重复边 / 非法关系 */
  validate(): GraphValidationReport
  
  /** 导出完整图数据 */
  export(): GraphRuntime
}

// ─── 图验证报告 ───

export interface GraphValidationIssue {
  type: 'orphan-node' | 'duplicate-edge' | 'reference-not-found' | 'illegal-relation' | 'cycle'
  nodeId?: string
  edgeId?: string
  message: string
}

export interface GraphValidationReport {
  valid: boolean
  issues: GraphValidationIssue[]
  nodeCount: number
  edgeCount: number
}

/** 图验证器 — 检查图是否健康 */
export function validateGraph(graph: GraphRuntime): GraphValidationReport {
  const issues: GraphValidationIssue[] = []
  const nodeIds = new Set(graph.nodes.keys())
  const edgeSet = new Set<string>()
  const allEdges = graph.edges

  // 1. 孤立节点检查
  const connectedNodes = new Set<string>()
  for (const edge of allEdges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }
  for (const [id] of graph.nodes) {
    if (!connectedNodes.has(id)) {
      issues.push({ type: 'orphan-node', nodeId: id, message: '孤立节点：没有边连接到 ' + id })
    }
  }

  // 2. 重复边检查
  for (const edge of allEdges) {
    const key = edge.source + '|' + edge.target + '|' + edge.type
    if (edgeSet.has(key)) {
      issues.push({ type: 'duplicate-edge', edgeId: edge.id, message: '重复边：' + key })
    }
    edgeSet.add(key)
  }

  // 3. 不存在引用检查
  for (const edge of allEdges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({ type: 'reference-not-found', edgeId: edge.id, message: 'source 节点不存在：' + edge.source })
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({ type: 'reference-not-found', edgeId: edge.id, message: 'target 节点不存在：' + edge.target })
    }
  }

  // 4. 循环依赖检查（简单 DFS，仅检查 depends-on 边）
  const depEdges = allEdges.filter(e => e.type === 'depends-on')
  const adjList = new Map<string, string[]>()
  for (const edge of depEdges) {
    if (!adjList.has(edge.source)) adjList.set(edge.source, [])
    adjList.get(edge.source)!.push(edge.target)
  }
  const visited = new Set<string>()
  const inStack = new Set<string>()
  function dfs(node: string): boolean {
    if (inStack.has(node)) return true
    if (visited.has(node)) return false
    visited.add(node)
    inStack.add(node)
    const neighbors = adjList.get(node) || []
    for (const next of neighbors) {
      if (dfs(next)) return true
    }
    inStack.delete(node)
    return false
  }
  for (const [node] of graph.nodes) {
    visited.clear()
    inStack.clear()
    if (dfs(node)) {
      issues.push({ type: 'cycle', message: '检测到循环依赖（depends-on 边中存在环）' })
      break
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    nodeCount: graph.nodes.size,
    edgeCount: allEdges.length,
  }
}

// ─── ID 生成（Stable Identifier Principle） ───

// ─── ID 生成（Stable Identifier Principle） ───

/** 生成稳定的节点 ID（node_{timestamp_random}） */
export function generateNodeId(): string {
  return `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 生成稳定的边 ID（edge_{timestamp_random}） */
export function generateEdgeId(): string {
  return `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
