/**
 * P3 — AgentGraph（Agent 执行图）
 *
 * ═══ P3 API FREEZE ═══
 * AgentGraph 的公共方法签名在 P4 之前冻结。
 * 新增能力应通过扩展 AgentNode 实现，不改变 Graph API。
 *
 * 定义完整的 Agent DAG（有向无环图）。
 * 包含节点列表、边列表、拓扑排序和执行上下文。
 *
 * ═══ 宪法 ═══
 * Agent Graph 必须是无环的（DAG）。
 * 执行路径由拓扑排序决定，禁止运行时修改图结构。
 */

import type { AgentNode } from './agent-node.js'
import type { AgentEdge } from './agent-edge.js'

export class AgentGraph {
  readonly nodes: Map<string, AgentNode> = new Map()
  readonly edges: AgentEdge[] = []
  private sorted: string[] | null = null

  constructor(
    public readonly name: string,
    public readonly description?: string,
  ) {}

  /**
   * 添加节点
   */
  addNode(node: AgentNode): this {
    if (this.nodes.has(node.id)) {
      throw new Error(`[AgentGraph] 节点 "${node.id}" 已存在`)
    }
    this.nodes.set(node.id, node)
    this.sorted = null
    return this
  }

  /**
   * 添加边（from → to）
   */
  addEdge(from: string, to: string, label?: string): this {
    if (!this.nodes.has(from)) throw new Error(`[AgentGraph] 源节点 "${from}" 不存在`)
    if (!this.nodes.has(to)) throw new Error(`[AgentGraph] 目标节点 "${to}" 不存在`)
    this.edges.push({ from, to, label })
    this.sorted = null
    return this
  }

  /**
   * 获取节点的直接上游（依赖）
   */
  getDependencies(nodeId: string): AgentNode[] {
    return this.edges
      .filter(e => e.to === nodeId)
      .map(e => this.nodes.get(e.from)!)
      .filter(Boolean)
  }

  /**
   * 获取节点的直接下游
   */
  getDependents(nodeId: string): AgentNode[] {
    return this.edges
      .filter(e => e.from === nodeId)
      .map(e => this.nodes.get(e.to)!)
      .filter(Boolean)
  }

  /**
   * 拓扑排序（Kahn 算法）
   * 返回按执行顺序排列的节点 ID 列表。
   * 先执行依赖，后执行依赖者。
   */
  topologicalSort(): string[] {
    if (this.sorted) return this.sorted

    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>()

    for (const [id] of this.nodes) {
      inDegree.set(id, 0)
      adjList.set(id, [])
    }

    for (const edge of this.edges) {
      adjList.get(edge.from)!.push(edge.to)
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
    }

    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    const sorted: string[] = []
    while (queue.length > 0) {
      const node = queue.shift()!
      sorted.push(node)
      for (const neighbor of adjList.get(node) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) queue.push(neighbor)
      }
    }

    if (sorted.length !== this.nodes.size) {
      throw new Error('[AgentGraph] ⚠️ 检测到环！拓扑排序失败')
    }

    this.sorted = sorted
    return sorted
  }
}
