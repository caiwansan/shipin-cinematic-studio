/**
 * llm-execution-graph-v2/types.ts
 *
 * Execution Graph IR — 配置 + 路由 + 执行 + trace 一体化
 */

export type NodeType =
  | 'CONFIG_RESOLVE'
  | 'ROUTE_SELECT'
  | 'EXECUTE_LLM'
  | 'TRACE_WRITE'

export interface GraphNode {
  id: string
  type: NodeType
  input?: any
  output?: any
  provider?: string
  model?: string
  meta?: Record<string, any>
  error?: string
}

export interface ExecutionGraph {
  requestId: string
  userId: string
  projectId?: string
  nodes: GraphNode[]
  final: {
    provider: string
    model: string
    apiKey: string
  } | null
  traceId: string
  status: 'building' | 'executed' | 'failed'
  totalLatencyMs: number
}
