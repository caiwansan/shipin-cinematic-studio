/**
 * llm-execution-graph-v2/executor.ts
 *
 * 执行器 — 执行图 → LLM 调用 + trace 写入
 * ❗ 只接受 ExecutionGraph 作为输入（禁止直接走 provider）
 */

import { ExecutionGraph, GraphNode } from './types'
import { assertGraphIntegrity } from './graph-builder'

/**
 * 执行 LLM 调用
 * 接收已构建的 graph + prompt，执行并写入 trace
 */
export async function executeGraph(
  graph: ExecutionGraph,
  prompt: string,
  options?: {
    model?: string
    systemPrompt?: string
    maxTokens?: number
    temperature?: number
  },
): Promise<{ content: string; graph: ExecutionGraph }> {
  const t0 = Date.now()

  // 1. 完整性检查
  assertGraphIntegrity(graph)

  const final = graph.final!
  graph.status = 'executing'

  // 2. 执行 LLM 调用
  // 注：实际调用走现有的 narrativeGateway.execute（避免复制 provider 调用逻辑）
  // 这里我们不直接调 provider，而是记录到 trace
  const execNode: GraphNode = {
    id: `execute_llm_${Date.now()}`,
    type: 'EXECUTE_LLM',
    input: { promptLen: prompt.length, model: options?.model || final.model },
    provider: final.provider,
    model: options?.model || final.model,
    meta: { maxTokens: options?.maxTokens, temperature: options?.temperature },
  }

  // 实际执行由外部调用方负责
  // executor 只做 graph 状态管理 + trace 写入
  // executeGraph 返回 graph，调用方拿到后调实际 provider 并调用 finalizeGraph()

  execNode.output = { delegated: true, note: 'execution delegated to narrativeGateway.execute()' }
  graph.nodes.push(execNode)

  graph.totalLatencyMs += Date.now() - t0

  return { content: '', graph }
}

/**
 * 最终化 — 写入 trace 节点，标记完成
 */
export function finalizeGraph(
  graph: ExecutionGraph,
  result: { content?: string; error?: string },
): ExecutionGraph {
  const traceNode: GraphNode = {
    id: `trace_write_${Date.now()}`,
    type: 'TRACE_WRITE',
    output: {
      contentLength: result.content?.length || 0,
      error: result.error || null,
    },
    meta: {
      timestamp: new Date().toISOString(),
      totalNodes: graph.nodes.length,
      totalLatencyMs: Date.now(),
    },
  }
  graph.nodes.push(traceNode)
  graph.status = result.error ? 'failed' : 'executed'
  graph.totalLatencyMs = Date.now()
  return graph
}
