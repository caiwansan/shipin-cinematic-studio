// ============================================================
// ExecutionGraph 辅助函数
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import type {
  ExecutionGraph,
  ExecutionNode,
  ExecutionNode as ExecNode,
  ExecutionEdge,
  ExecutionContext,
  NodeType,
  ProviderPolicy,
  RetryConfig,
  NodeStatus,
} from './types'
import { DEFAULT_RETRY_CONFIG } from './types'

// ─── 工厂函数 ───

export function createExecutionGraph(params: {
  context: ExecutionContext
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
}): ExecutionGraph {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    nodes: params.nodes.map((n) => ({ ...n })),
    edges: params.edges.map((e) => ({ ...e })),
    status: 'pending',
    context: { ...params.context },
    createdAt: now,
    updatedAt: now,
  }
}

export function createExecutionNode(params: {
  label: string
  type: NodeType
  capability: string
  providerPolicy?: ProviderPolicy
  config?: Record<string, unknown>
  retryConfig?: RetryConfig
  timeout?: number
  dependencies?: string[]
  status?: NodeStatus
}): ExecutionNode {
  return {
    id: uuidv4(),
    label: params.label,
    type: params.type,
    capability: params.capability,
    providerPolicy: params.providerPolicy ?? 'FASTEST',
    config: params.config ?? {},
    status: params.status ?? 'pending',
    retryConfig: params.retryConfig ?? { ...DEFAULT_RETRY_CONFIG },
    timeout: params.timeout ?? 30000,
    dependencies: params.dependencies ?? [],
    artifact: null,
    error: null,
    startedAt: null,
    completedAt: null,
  }
}

// ─── 图操作 ───

export function addEdge(
  graph: ExecutionGraph,
  from: string,
  to: string,
  condition?: string,
): ExecutionGraph {
  const edge: ExecutionEdge = { from, to }
  if (condition !== undefined) {
    edge.condition = condition
  }
  // 更新目标节点的 dependencies
  const targetNode = graph.nodes.find((n) => n.id === to)
  if (targetNode && !targetNode.dependencies.includes(from)) {
    targetNode.dependencies.push(from)
  }
  return {
    ...graph,
    edges: [...graph.edges, edge],
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 返回所有依赖都已满足的 queued 节点。
 * 依赖满足条件：依赖列表为空，或所有依赖节点的 status 为 'completed'。
 */
export function getReadyNodes(graph: ExecutionGraph): ExecutionNode[] {
  return graph.nodes.filter((node) => {
    if (node.status !== 'queued') return false
    if (node.dependencies.length === 0) return true
    return node.dependencies.every((depId) => {
      const depNode = graph.nodes.find((n) => n.id === depId)
      return depNode?.status === 'completed'
    })
  })
}

/**
 * 返回依赖于指定节点的所有下游节点。
 */
export function getDependents(
  graph: ExecutionGraph,
  nodeId: string,
): ExecutionNode[] {
  return graph.nodes.filter((n) => n.dependencies.includes(nodeId))
}
