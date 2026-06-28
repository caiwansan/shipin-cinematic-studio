/**
 * P4 — ExecutionStateStore（执行状态存储）
 *
 * 持久化 Graph 执行状态，支持 pause / resume / partial execution。
 * 内存实现（生产环境替换为 Redis / PostgreSQL）。
 *
 * ═══ 宪法 ═══
 * 所有 Graph 执行必须可被状态跟踪。
 * 禁止 execution without state tracking。
 */

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
export type GraphStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'

export interface NodeState {
  nodeId: string
  status: NodeStatus
  startedAt?: number
  completedAt?: number
  result?: any
  error?: string
  retryCount: number
}

export interface GraphState {
  graphId: string
  name: string
  status: GraphStatus
  nodes: Map<string, NodeState>
  topology: string[]
  context: Map<string, any>
  startedAt: number
  completedAt?: number
  checkpointCount: number
}

class ExecutionStateStore {
  private graphs: Map<string, GraphState> = new Map()

  /**
   * 创建新的图状态
   */
  createGraph(graphId: string, name: string, topology: string[]): GraphState {
    const state: GraphState = {
      graphId,
      name,
      status: 'pending',
      nodes: new Map(),
      topology,
      context: new Map(),
      startedAt: Date.now(),
      checkpointCount: 0,
    }
    this.graphs.set(graphId, state)
    return state
  }

  /**
   * 获取图状态
   */
  getGraph(graphId: string): GraphState | undefined {
    return this.graphs.get(graphId)
  }

  /**
   * 更新图状态
   */
  updateGraphStatus(graphId: string, status: GraphStatus): void {
    const graph = this.graphs.get(graphId)
    if (!graph) return
    graph.status = status
    if (status === 'completed' || status === 'failed') {
      graph.completedAt = Date.now()
    }
  }

  /**
   * 创建节点状态
   */
  initNode(graphId: string, nodeId: string): void {
    const graph = this.graphs.get(graphId)
    if (!graph) return
    graph.nodes.set(nodeId, {
      nodeId,
      status: 'pending',
      retryCount: 0,
    })
  }

  /**
   * 更新节点状态
   */
  updateNodeStatus(
    graphId: string,
    nodeId: string,
    status: NodeStatus,
    extra?: { result?: any; error?: string },
  ): void {
    const graph = this.graphs.get(graphId)
    const node = graph?.nodes.get(nodeId)
    if (!node) return

    node.status = status
    if (status === 'running') node.startedAt = Date.now()
    if (status === 'completed' || status === 'failed') node.completedAt = Date.now()
    if (extra?.result) node.result = extra.result
    if (extra?.error) node.error = extra.error
  }

  /**
   * 获取所有图状态概要
   */
  listGraphs(): Array<{ graphId: string; name: string; status: GraphStatus; startedAt: number }> {
    return Array.from(this.graphs.values()).map(g => ({
      graphId: g.graphId,
      name: g.name,
      status: g.status,
      startedAt: g.startedAt,
    }))
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.graphs.clear()
  }
}

export const executionStateStore = new ExecutionStateStore()
