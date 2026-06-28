/**
 * P4 — AsyncExecutor（异步执行器）
 *
 * 事件驱动执行的核心引擎。
 * 接收 EventBus 事件 → 调度 Agent Node 执行 → 保存 Checkpoint → 发射完成事件。
 *
 * ═══ 宪法 ═══
 * 异步执行必须是事件驱动的，非阻塞的。
 * 执行完成后自动保存 checkpoint，支持 resume。
 *
 * ═══ 不绕过 P2 ═══
 * Async Executor 内部调用 executionCutover → ControlPlane。
 */

import { Capability } from '../runtime/capabilities.js'
import { eventBus } from './event-bus.js'
import { executionStateStore, GraphState, GraphStatus } from './execution-state-store.js'
import { checkpointManager } from './checkpoint-manager.js'
import { executionCutover } from '../control-plane/cutover/execution-cutover.js'
import { createExecutionEvent } from './events/execution-event.js'

export class AsyncExecutor {
  /**
   * 启动异步图执行
   * 非阻塞——事件发布后立即返回。
   */
  async startGraphExecution(
    graphId: string,
    graphName: string,
    topology: string[],
    context: Map<string, any>,
  ): Promise<void> {
    // 1. 创建图状态
    const graph = executionStateStore.createGraph(graphId, graphName, topology)
    for (const key of topology) {
      graph.nodes.set(key, { nodeId: key, status: 'pending', retryCount: 0 })
    }
    for (const [key, value] of context) {
      graph.context.set(key, value)
    }

    // 2. 发射图开始事件
    await eventBus.emitSimple('graph_started', graphId, {
      payload: { name: graphName, nodeCount: topology.length },
    })

    // 3. 异步执行第一个节点
    executionStateStore.updateGraphStatus(graphId, 'running')
    await this.executeNextNodes(graphId)
  }

  /**
   * 执行下一个就绪的节点
   */
  private async executeNextNodes(graphId: string): Promise<void> {
    const graph = executionStateStore.getGraph(graphId)
    if (!graph) return

    // 找到所有 pending 且依赖已完成的节点
    const readyNodes = graph.topology.filter(nodeId => {
      const node = graph.nodes.get(nodeId)
      if (!node || node.status !== 'pending') return false

      // 检查依赖（前置节点必须已完成）
      const deps = this.getDependencies(nodeId, graph)
      return deps.every(depId => graph.nodes.get(depId)?.status === 'completed')
    })

    if (readyNodes.length === 0) {
      // 检查是否全部完成
      const allDone = graph.topology.every(nodeId => {
        const status = graph.nodes.get(nodeId)?.status
        return status === 'completed' || status === 'failed' || status === 'skipped'
      })
      if (allDone) {
        await this.completeGraph(graphId)
      }
      return
    }

    // 并行执行就绪节点
    await Promise.all(readyNodes.map(nodeId => this.executeNode(graphId, nodeId)))
  }

  /**
   * 执行单个节点（非阻塞）
   */
  private async executeNode(graphId: string, nodeId: string): Promise<void> {
    const graph = executionStateStore.getGraph(graphId)
    if (!graph) return

    const nodeState = graph.nodes.get(nodeId)
    if (!nodeState) return

    // 标记为 running
    executionStateStore.updateNodeStatus(graphId, nodeId, 'running')
    const nodeInfo = graph.context.get(`__node__${nodeId}`) as any || {}

    await eventBus.emitSimple('node_started', graphId, { nodeId })

    try {
      const result = await executionCutover.execute({
        capability: (nodeInfo.capability as Capability) || Capability.SCRIPT_ANALYSIS,
        userId: graph.context.get('__userId__') || 'system',
        payload: {
          systemPrompt: nodeInfo.systemPrompt || '',
          userMessage: nodeInfo.userMessage || '',
        },
      })

      // 标记为 completed
      executionStateStore.updateNodeStatus(graphId, nodeId, 'completed', { result })

      await eventBus.emitSimple('node_completed', graphId, {
        nodeId,
        payload: { success: result.success, contentLength: result.content?.length },
      })

      // 保存 checkpoint
      await checkpointManager.save(graphId, nodeId)

      // 继续执行下一层
      await this.executeNextNodes(graphId)
    } catch (err: any) {
      executionStateStore.updateNodeStatus(graphId, nodeId, 'failed', { error: err.message })

      await eventBus.emitSimple('node_failed', graphId, {
        nodeId,
        error: err.message,
      })

      // 保存 checkpoint（包括失败状态）
      await checkpointManager.save(graphId, nodeId)
    }
  }

  /**
   * 完成图执行
   */
  private async completeGraph(graphId: string): Promise<void> {
    const graph = executionStateStore.getGraph(graphId)
    if (!graph) return

    const hasAllCompleted = graph.topology.every(
      nodeId => graph.nodes.get(nodeId)?.status === 'completed',
    )

    if (hasAllCompleted) {
      executionStateStore.updateGraphStatus(graphId, 'completed')
      await eventBus.emitSimple('graph_completed', graphId, {
        payload: { elapsed: Date.now() - graph.startedAt },
      })
      console.log(`[AsyncExecutor] ✅ 图 "${graph.name}" (${graphId.substring(0, 8)}) 执行完成 (${Date.now() - graph.startedAt}ms)`)
    } else {
      executionStateStore.updateGraphStatus(graphId, 'failed')
      await eventBus.emitSimple('graph_failed', graphId, {
        payload: { elapsed: Date.now() - graph.startedAt },
      })
      console.warn(`[AsyncExecutor] ⚠️ 图 "${graph.name}" (${graphId.substring(0, 8)}) 执行失败 (${Date.now() - graph.startedAt}ms)`)
    }
  }

  /**
   * 获取节点依赖（拓扑中前置节点）
   */
  private getDependencies(nodeId: string, graph: GraphState): string[] {
    const index = graph.topology.indexOf(nodeId)
    if (index <= 0) return []
    return graph.topology.slice(0, index)
  }

  /**
   * 从上一个 checkpoint 恢复图执行
   */
  async resumeGraph(graphId: string): Promise<void> {
    const checkpoint = await checkpointManager.resume(graphId)
    if (!checkpoint) {
      console.error(`[AsyncExecutor] ❌ 图 "${graphId}" 无 checkpoint 可恢复`)
      return
    }

    executionStateStore.updateGraphStatus(graphId, 'running')
    await this.executeNextNodes(graphId)
  }
}

export const asyncExecutor = new AsyncExecutor()
