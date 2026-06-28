/**
 * RuntimeRun — Execution run state model
 */

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type NodeRunState = {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: number
  finishedAt?: number
  durationMs?: number
  error?: string
  output?: any
}

export type RuntimeRun = {
  id: string
  pipelineId: string
  graphSnapshot: any  // frozen graph at execution time
  status: RunStatus
  startedAt: number
  finishedAt?: number
  nodeStates: Record<string, NodeRunState>
  totalSteps: number
  completedSteps: number
  failedSteps: number
}

export type RuntimeRunEvent = {
  runId: string
  type: 'run:pending' | 'run:start' | 'run:complete' | 'run:failed'
      | 'phase:start' | 'phase:complete'
      | 'node:start' | 'node:complete' | 'node:failed' | 'node:skipped'
  timestamp: number
  nodeId?: string
  nodeType?: string
  phase?: number
  durationMs?: number
  error?: string
  progress?: { completed: number; total: number }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

