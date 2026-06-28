/**
 * Graph Instance — 每个剧本的独立执行实例
 * 隔离的运行时上下文，不与其他 graph 共享 state
 */

export type GraphStatus = 'pending' | 'running' | 'degraded' | 'completed' | 'cancelled'
export type GraphPriority = 'high' | 'medium' | 'low'

export interface GraphInstance {
  graphId: string
  projectId: string
  userId: string
  status: GraphStatus
  priority: GraphPriority
  context: Record<string, any>
  resourceQuota: {
    llmTokens: number
    maxLatencyMs: number
    maxCostCredits: number
  }
  nodesCompleted: number
  nodesFailed: number
  startedAt: number | null
  completedAt: number | null
  traceId: string
  fallbackState: Record<string, any>
}

let _instanceCounter = 0

export function createGraphInstance(params: {
  projectId: string
  userId?: string
  priority?: GraphPriority
  context?: Record<string, any>
}): GraphInstance {
  _instanceCounter++
  const graphId = `graph_${Date.now()}_${_instanceCounter}`

  return {
    graphId,
    projectId: params.projectId,
    userId: params.userId || 'anonymous',
    status: 'pending',
    priority: params.priority || 'medium',
    context: params.context || {},
    resourceQuota: {
      llmTokens: 4000,
      maxLatencyMs: 60000,
      maxCostCredits: 100,
    },
    nodesCompleted: 0,
    nodesFailed: 0,
    startedAt: null,
    completedAt: null,
    traceId: `trace_${graphId}`,
    fallbackState: {},
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

