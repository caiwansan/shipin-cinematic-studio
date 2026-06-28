/**
 * P3 — GraphExecutor（图执行引擎）
 *
 * 按拓扑排序执行 Agent DAG。
 * 支持 parallel / sequential / conditional 三种执行策略。
 * 所有 Agent 执行通过 executionCutover → ControlPlane（不绕过 P2）。
 *
 * ═══ 宪法 ═══
 * Agent 执行必须经过 executionCutover。
 * 禁止 Agent 直接调 Provider / Adapter / Dispatcher。
 */

import { AgentGraph } from './agent-graph.js'
import { AgentNode, AgentStrategy } from './agent-node.js'
import { executionCutover } from '../control-plane/cutover/execution-cutover.js'

interface ExecutionResult {
  nodeId: string
  success: boolean
  data?: any
  latency: number
  error?: string
}

interface ExecutionContext {
  graph: AgentGraph
  results: Map<string, ExecutionResult>
  shared: Map<string, any>
  startedAt: number
}

export class GraphExecutor {
  /**
   * 执行完整的 Agent DAG
   *
   * ═══ P3 API FREEZE ═══
   * 此方法签名在 P4 之前冻结，不得修改。
   * graphExecutor.executeGraph() 是 Agent Graph 执行的唯一入口。
   * 新增能力应通过 AgentNode 策略扩展实现，不改变此签名。
   */
  async executeGraph(graph: AgentGraph, initialInput?: any): Promise<{
    success: boolean
    results: Map<string, ExecutionResult>
    totalLatency: number
    topology: string[]
  }> {
    const start = Date.now()
    const ctx: ExecutionContext = {
      graph,
      results: new Map(),
      shared: new Map(),
      startedAt: start,
    }

    if (initialInput) {
      ctx.shared.set('__input__', initialInput)
    }

    const sorted = graph.topologicalSort()
    console.log(`[GraphExecutor] 🚀 执行图 "${graph.name}" (${sorted.length} 个节点, 拓扑顺序: ${sorted.join(' → ')})`)

    for (const nodeId of sorted) {
      const node = graph.nodes.get(nodeId)!
      const nodeStart = Date.now()

      try {
        const result = await this.executeNode(node, ctx)
        ctx.results.set(nodeId, {
          nodeId,
          success: true,
          data: result,
          latency: Date.now() - nodeStart,
        })
        ctx.shared.set(nodeId, result)
        console.log(`[GraphExecutor] ✅ 节点 "${node.id}" (${node.name}) 完成 (${Date.now() - nodeStart}ms)`)
      } catch (err: any) {
        const errorResult: ExecutionResult = {
          nodeId,
          success: false,
          error: err.message || 'unknown',
          latency: Date.now() - nodeStart,
        }
        ctx.results.set(nodeId, errorResult)
        console.error(`[GraphExecutor] ❌ 节点 "${node.id}" (${node.name}) 失败:`, err.message)
      }
    }

    return {
      success: true,
      results: ctx.results,
      totalLatency: Date.now() - start,
      topology: sorted,
    }
  }

  /**
   * 执行单个 Agent 节点
   */
  private async executeNode(node: AgentNode, ctx: ExecutionContext): Promise<any> {
    // 1. 计算输入
    let input = node.inputTransform
      ? node.inputTransform(ctx.shared)
      : ctx.shared.get('__input__')

    // 2. 条件判断
    if (node.strategy === 'conditional') {
      const shouldExecute = node.condition
        ? node.condition(ctx.shared)
        : true
      if (!shouldExecute) {
        console.log(`[GraphExecutor] ⏭️ 节点 "${node.id}" 条件不满足，跳过`)
        return { skipped: true }
      }
    }

    // 3. 通过 Cutover → ControlPlane 执行
    const result = await executionCutover.execute({
      capability: node.capability,
      userId: ctx.shared.get('__userId__') || 'system',
      payload: {
        systemPrompt: input?.systemPrompt || '',
        userMessage: input?.userMessage || (typeof input === 'string' ? input : JSON.stringify(input)),
        maxTokens: node.metadata?.timeout ? Math.min(node.metadata.timeout * 100, 4096) : 4096,
      },
    })

    return result
  }

  /**
   * 并行执行一组节点
   */
  async executeParallel(nodes: AgentNode[], ctx: ExecutionContext): Promise<Map<string, any>> {
    const promises = nodes.map(async node => {
      const result = await this.executeNode(node, ctx)
      return { id: node.id, result }
    })

    const results = await Promise.all(promises)
    const resultMap = new Map<string, any>()
    for (const { id, result } of results) {
      resultMap.set(id, result)
    }
    return resultMap
  }
}

export const graphExecutor = new GraphExecutor()
