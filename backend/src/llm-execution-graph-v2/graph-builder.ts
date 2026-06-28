/**
 * llm-execution-graph-v2/graph-builder.ts
 *
 * 核心编排 — 构建执行图
 * 配置 → 路由 → 执行入口
 *
 * ❗ 只兼容 config-runtime（V2 ONLY）
 */

import { ExecutionGraph, GraphNode } from './types'
import { getRuntimeConfig } from '../config-runtime'

export async function buildExecutionGraph(params: {
  userId: string
  projectId?: string
  requestId?: string
}): Promise<ExecutionGraph> {
  const requestId = params.requestId || `eg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const graph: ExecutionGraph = {
    requestId,
    userId: params.userId,
    projectId: params.projectId,
    nodes: [],
    final: null,
    traceId: `trace_${requestId}`,
    status: 'building',
    totalLatencyMs: 0,
  }

  const t0 = Date.now()

  // ===== 1. CONFIG RESOLVE NODE =====
  try {
    const config = await getRuntimeConfig({
      userId: params.userId,
      requestId,
    })

    const configNode: GraphNode = {
      id: 'config_resolve',
      type: 'CONFIG_RESOLVE',
      output: {
        provider: config.user?.provider || 'unset',
        model: config.user?.model || 'unset',
        hasKey: !!config.user?.apiKey,
        source: config.user?.source || 'NONE',
      },
      meta: { systemFrozen: config.system.frozen },
    }
    graph.nodes.push(configNode)

    if (!config.user) {
      graph.status = 'failed'
      configNode.error = '用户无有效 LLM 配置（V2 空或未启用）'
      return graph
    }

    // ===== 2. ROUTE SELECT NODE =====
    const routeNode: GraphNode = {
      id: 'route_select',
      type: 'ROUTE_SELECT',
      input: { provider: config.user.provider, model: config.user.model },
      output: {
        provider: config.user.provider,
        model: config.user.model,
        resolvedFrom: config.user.source,
      },
    }
    graph.nodes.push(routeNode)

    // ===== 3. FINAL =====
    graph.final = {
      provider: config.user.provider,
      model: config.user.model,
      apiKey: config.user.apiKey,
    }
  } catch (err: any) {
    graph.status = 'failed'
    graph.nodes.push({
      id: 'config_resolve',
      type: 'CONFIG_RESOLVE',
      error: err.message,
    })
  }

  graph.totalLatencyMs = Date.now() - t0
  return graph
}

/**
 * assertConfigIntegrity — 基于 graph 的完整性断言
 * 替换 guard.ts
 */
export function assertGraphIntegrity(graph: ExecutionGraph): true {
  if (graph.status === 'failed') {
    const errNode = graph.nodes.find(n => n.error)
    throw new Error(`[GRAPH_INTEGRITY] 执行图构建失败: ${errNode?.error || graph.nodes.map(n => n.error).filter(Boolean).join('; ')}`)
  }
  if (!graph.final?.apiKey) {
    throw new Error('[GRAPH_INTEGRITY] 执行图缺少 final 目标（无 API Key）')
  }
  if (!graph.final?.model) {
    throw new Error('[GRAPH_INTEGRITY] 执行图缺少模型配置')
  }
  return true
}
