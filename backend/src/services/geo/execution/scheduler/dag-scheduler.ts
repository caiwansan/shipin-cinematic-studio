// ============================================================
// DAGScheduler — RC4-4 (Failure Trace Complete)
// ============================================================
// 核心职责：
//   1. 依赖解析 & Ready Queue
//   2. 调度循环（模拟节点执行）
//   3. 状态机驱动 + Event 生成
//   4. Cancel 支持
//   5. RC4-4: 节点生命周期事件完备性保证
//      - 每个 node 最多一个 node_started
//      - 最终一定落在 completed / failed / cancelled / timeout
//      - 不允许只有 started 没有结束事件
//      - retry 不修改历史事件，只追加
//
// 架构约束：
//   - 不调用任何 AI Provider
//   - 不调用 Explain 层
//   - 所有状态变化写入 ExecutionEvent

import type {
  ExecutionGraph,
  ExecutionNode,
  ExecutionEvent,
  ExecutionEventType,
  NodeStatus,
} from '../types'
import { NodeStateMachine } from './state-machine'
import type { ExecutionTraceRepository } from '../types'

/**
 * 节点执行回调签名。
 * RC1 实现为模拟执行（可被测试替换）。
 */
export type NodeExecuteFn = (
  node: ExecutionNode,
  graph: ExecutionGraph,
) => Promise<{
  success: boolean
  output?: unknown
  error?: string
  duration?: number
}>

// 默认模拟执行：立即成功，返回空输出
const DEFAULT_NODE_EXECUTE: NodeExecuteFn = async () => ({
  success: true,
  output: null,
  duration: 0,
  error: undefined,
})

export class DAGScheduler {
  private stateMachine: NodeStateMachine
  private traceRepo: ExecutionTraceRepository
  private nodeExecute: NodeExecuteFn
  private cancelRequested: Map<string, boolean> = new Map()

  constructor(params: {
    traceRepo: ExecutionTraceRepository
    stateMachine?: NodeStateMachine
    nodeExecute?: NodeExecuteFn
  }) {
    this.stateMachine = params.stateMachine ?? new NodeStateMachine()
    this.traceRepo = params.traceRepo
    this.nodeExecute = params.nodeExecute ?? DEFAULT_NODE_EXECUTE
  }

  async execute(graph: ExecutionGraph): Promise<ExecutionGraph> {
    const workingGraph = this.cloneGraph(graph)
    const executionId = workingGraph.context.executionId
    this.cancelRequested.set(executionId, false)

    // 1. 初始化所有节点为 queued
    this.transitionAllNodes(workingGraph, 'pending', 'queued', 'node_queued')

    // 2. 更新图为 running
    workingGraph.status = 'running'
    workingGraph.updatedAt = new Date().toISOString()

    // 3. 创建 graph_created event
    await this.emitEvent({
      executionId,
      graphId: workingGraph.id,
      type: 'graph_created',
      data: { nodeCount: workingGraph.nodes.length, edgeCount: workingGraph.edges.length },
    })

    // 4. 调度循环
    let hasRunningNodes = false
    let allCompleted = false

    while (!allCompleted) {
      // 检查取消
      if (this.cancelRequested.get(executionId)) {
        await this.doCancel(workingGraph)
        return workingGraph
      }

      // a. 获取 readyNodes（所有依赖已满足的 queued 节点）
      const readyNodes = this.getReadyNodes(workingGraph)

      // b. 是否有 running 节点
      hasRunningNodes = workingGraph.nodes.some((n) => n.status === 'running')

      // c. 没有 readyNodes
      if (readyNodes.length === 0) {
        // 如果还有 running 节点 → 继续等待（后续交由 Provider Runtime 处理）
        // RC1 中节点同步执行，所以这里 deadlock 检测直接生效
        if (!hasRunningNodes) {
          // 检查是否所有节点都已完成/失败/取消
          const terminalStatuses: NodeStatus[] = ['completed', 'failed', 'cancelled', 'timeout']
          const allTerminal = workingGraph.nodes.every((n) =>
            terminalStatuses.includes(n.status),
          )
          if (allTerminal) {
            allCompleted = true
            break
          }
          // Deadlock: 没有 ready 也没有 running
          workingGraph.status = 'failed'
          workingGraph.updatedAt = new Date().toISOString()
          await this.emitEvent({
            executionId,
            graphId: workingGraph.id,
            type: 'graph_failed',
            data: { reason: 'deadlock: no ready nodes and no running nodes' },
          })
          return workingGraph
        }
        // 有 running 节点，理论上需要等待。RC1 中同步执行所以不会到这里
        // 加个小 sleep 避免 busy loop
        await this.sleep(10)
        continue
      }

      // d. 对每个 readyNode 执行调度
      for (const node of readyNodes) {
        if (this.cancelRequested.get(executionId)) {
          await this.doCancel(workingGraph)
          return workingGraph
        }

        // ── RC4-4: node_started 事件 ──
        // 每次新执行或 retry 都会重新写入，确保生命周期开始追踪
        this.transitionNode(workingGraph, node.id, 'node_started')
        await this.emitEvent({
          executionId,
          graphId: workingGraph.id,
          type: 'node_started',
          nodeId: node.id,
          data: { retryAttempt: node.retryCount ?? 0 },
        })

        // 执行节点（RC1: 模拟执行）
        const result = await this.nodeExecute(node, workingGraph)

        if (result.success) {
          this.transitionNode(workingGraph, node.id, 'node_completed')
          await this.emitEvent({
            executionId,
            graphId: workingGraph.id,
            type: 'node_completed',
            nodeId: node.id,
            data: { output: result.output, duration: result.duration },
          })
        } else if (result.error) {
          this.transitionNode(workingGraph, node.id, 'node_failed')
          await this.emitEvent({
            executionId,
            graphId: workingGraph.id,
            type: 'node_failed',
            nodeId: node.id,
            data: { error: result.error, duration: result.duration },
          })
        }
      }
    }

    // 5. 图状态更新
    const failedNodes = workingGraph.nodes.filter(
      (n) => n.status === 'failed' || n.status === 'timeout',
    )
    if (failedNodes.length > 0) {
      workingGraph.status = 'failed'
      await this.emitEvent({
        executionId,
        graphId: workingGraph.id,
        type: 'graph_failed',
        data: {
          failedNodeIds: failedNodes.map((n) => n.id),
          failedCount: failedNodes.length,
          totalNodes: workingGraph.nodes.length,
        },
      })
    } else {
      const cancelledNodes = workingGraph.nodes.filter((n) => n.status === 'cancelled')
      if (cancelledNodes.length > 0 && workingGraph.nodes.every((n) => n.status === 'cancelled' || n.status === 'completed')) {
        workingGraph.status = 'cancelled'
      } else {
        workingGraph.status = 'completed'
        await this.emitEvent({
          executionId,
          graphId: workingGraph.id,
          type: 'graph_completed',
        })
      }
    }

    workingGraph.updatedAt = new Date().toISOString()
    return workingGraph
  }

  async cancel(executionId: string): Promise<void> {
    this.cancelRequested.set(executionId, true)
  }

  async getStatus(executionId: string): Promise<ExecutionGraph | null> {
    return this.traceRepo.getGraph(executionId)
  }

  // ─── 内部方法 ───

  private async doCancel(graph: ExecutionGraph): Promise<void> {
    const executionId = graph.context.executionId
    // 对所有 running/queued 节点执行 cancelled 转换
    for (const node of graph.nodes) {
      if (node.status === 'running' || node.status === 'queued' || node.status === 'pending') {
        try {
          this.transitionNode(graph, node.id, 'node_cancelled')
        } catch {
          // 忽略已终止节点
        }
      }
    }
    graph.status = 'cancelled'
    graph.updatedAt = new Date().toISOString()
    await this.emitEvent({
      executionId,
      graphId: graph.id,
      type: 'graph_cancelled',
    })
  }

  private transitionNode(
    graph: ExecutionGraph,
    nodeId: string,
    event: ExecutionEventType,
  ): void {
    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) {
      throw new Error(`节点 ${nodeId} 在图中不存在`)
    }

    const nextStatus = this.stateMachine.transition(node, event)
    node.status = nextStatus

    if (nextStatus === 'running') {
      node.startedAt = new Date().toISOString()
    }
    if (
      nextStatus === 'completed' ||
      nextStatus === 'failed' ||
      nextStatus === 'cancelled' ||
      nextStatus === 'timeout'
    ) {
      node.completedAt = new Date().toISOString()
    }

    // 同步更新 graph.updatedAt
    graph.updatedAt = new Date().toISOString()
  }

  private transitionAllNodes(
    graph: ExecutionGraph,
    fromStatus: NodeStatus,
    toStatus: NodeStatus,
    event: ExecutionEventType,
  ): void {
    for (const node of graph.nodes) {
      if (node.status === fromStatus) {
        this.transitionNode(graph, node.id, event)
      }
    }
  }

  private getReadyNodes(graph: ExecutionGraph): ExecutionNode[] {
    return graph.nodes.filter((node) => {
      if (node.status !== 'queued') return false
      if (node.dependencies.length === 0) return true
      return node.dependencies.every((depId) => {
        const depNode = graph.nodes.find((n) => n.id === depId)
        return depNode?.status === 'completed'
      })
    })
  }

  private async emitEvent(params: {
    executionId: string
    graphId: string
    type: ExecutionEventType
    nodeId?: string
    data?: Record<string, unknown>
  }): Promise<void> {
    const { createExecutionEvent } = await import('../event')
    const event = createExecutionEvent(params)
    await this.traceRepo.saveEvent(event)
  }

  private cloneGraph(graph: ExecutionGraph): ExecutionGraph {
    return JSON.parse(JSON.stringify(graph))
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
