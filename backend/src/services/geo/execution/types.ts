// ============================================================
// Execution Runtime — Core Types (RFC2 / RC1)
// ============================================================
// 接口冻结 v1.0 — 不允许修改现有字段定义

// ─── Status Enums ───

export type NodeStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting_dependency'
  | 'retrying'
  | 'fallback'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'timeout'

export type GraphStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type NodeType =
  | 'discovery'
  | 'knowledge'
  | 'recommendation'
  | 'mission'
  | 'verification'
  | 'publishing'
  | 'custom'

export type ProviderPolicy =
  | 'FASTEST'
  | 'CHEAPEST'
  | 'MOST_RELIABLE'
  | 'LOCAL_ONLY'
  | 'CN_PROVIDER_FIRST'

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitter: boolean
  useExponentialBackoff: boolean
}

// ─── ExecutionContext （平台对象 1）───

export interface ExecutionContext {
  executionId: string
  brandId: string
  tenantId: string
  sourceType: string   // 'mission' | 'verification' | 'manual' 等
  sourceId: string     // 来源业务 ID
  variables: Record<string, unknown>
  providerPolicy: ProviderPolicy
  metadata: Record<string, unknown>
}

// ─── ExecutionArtifact （平台对象 2）───

export interface ExecutionArtifact {
  id: string
  type: string           // 'discovery_signal' | 'knowledge_object' | 等
  payload: unknown
  metadata: {
    nodeId: string
    graphId: string
    provider: string
    duration: number     // ms
    cost: number         // token/credits
    retryCount: number
  }
  createdAt: string
}

// ─── ExecutionEvent （平台对象 3）───

export type ExecutionEventType =
  | 'graph_created'
  | 'graph_completed'
  | 'graph_failed'
  | 'graph_cancelled'
  | 'node_queued'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'node_retry'
  | 'node_timeout'
  | 'node_fallback'
  | 'node_cancelled'
  | 'dependency_met'
  | 'circuit_breaker_open'
  | 'circuit_breaker_half_open'
  | 'circuit_breaker_closed'

export interface ExecutionEvent {
  id: string
  executionId: string
  graphId: string
  type: ExecutionEventType
  nodeId?: string
  timestamp: string
  data?: Record<string, unknown>
}

// ─── Graph 结构 ───

export interface ExecutionEdge {
  from: string
  to: string
  condition?: string  // 条件表达式；空表示无条件
}

export interface ExecutionNode {
  id: string
  label: string
  type: NodeType
  capability: string           // 所需能力（如 'reasoning', 'search', 'summary'）
  providerPolicy: ProviderPolicy
  config: Record<string, unknown>
  status: NodeStatus
  retryConfig: RetryConfig
  timeout: number              // ms
  dependencies: string[]       // 上游 node id
  artifact?: ExecutionArtifact | null
  error?: string | null
  startedAt?: string | null
  completedAt?: string | null
}

export interface ExecutionGraph {
  id: string
  nodes: ExecutionNode[]
  edges: ExecutionEdge[]
  status: GraphStatus
  context: ExecutionContext
  createdAt: string
  updatedAt: string
  completedAt?: string
}

// ─── Interfaces ───

export interface IDAGScheduler {
  execute(graph: ExecutionGraph): Promise<ExecutionGraph>
  cancel(executionId: string): Promise<void>
  getStatus(executionId: string): Promise<ExecutionGraph | null>
}

export interface INodeStateMachine {
  transition(node: ExecutionNode, event: ExecutionEventType): NodeStatus
  canTransition(from: NodeStatus, to: NodeStatus): boolean
}

export interface ExecutionTraceRepository {
  saveEvent(event: ExecutionEvent): Promise<void>
  getEvents(executionId: string): Promise<ExecutionEvent[]>
  getGraph(executionId: string): Promise<ExecutionGraph | null>
}

// ─── 默认 RetryConfig ───

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitter: true,
  useExponentialBackoff: true,
}
