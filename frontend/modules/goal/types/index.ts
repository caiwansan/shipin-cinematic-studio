// ============================================================
// Goal Module — Type Definitions (Frontend)
// ============================================================

export type GoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'
export type StrategyStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type WorkflowStatus = 'draft' | 'active' | 'completed' | 'cancelled'
export type TaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision'

export interface Goal {
  id: string
  projectId: string
  title: string
  description: string | null
  successCriteria: string | null
  targetMetric: string | null
  deadline: string | null
  priority: number
  status: GoalStatus
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface Strategy {
  id: string
  goalId: string
  name: string
  description: string | null
  type: string
  status: StrategyStatus
  priority: number
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface Workflow {
  id: string
  strategyId: string
  name: string
  description: string | null
  status: WorkflowStatus
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
  stages?: WorkflowStage[]
}

export interface WorkflowStage {
  id: string
  workflowId: string
  name: string
  order: number
  status: string
  metadata: string | null
  schemaVersion: number
  createdAt: string
}

export interface Task {
  id: string
  goalId: string | null
  strategyId: string | null
  workflowId: string | null
  stageId: string | null
  title: string
  description: string | null
  actionType: string
  priority: number
  dependencies: string | null
  retryCount: number
  maxRetries: number
  deadline: string | null
  status: TaskStatus
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface Action {
  id: string
  name: string
  description: string | null
  provider: string
  config: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface Execution {
  id: string
  taskId: string
  actionType: string
  status: ExecutionStatus
  input: string | null
  output: string | null
  error: string | null
  durationMs: number | null
  retryAttempt: number
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface ExecutionResult {
  id: string
  executionId: string
  assetId: string | null
  type: string
  summary: string | null
  details: string | null
  schemaVersion: number
  createdAt: string
}

export interface Review {
  id: string
  executionId: string
  status: ReviewStatus
  comments: string | null
  score: number | null
  metadata: string | null
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface GoalStats {
  totalGoals: number
  activeGoals: number
  completedGoals: number
  totalStrategies: number
  totalTasks: number
  pendingTasks: number
  runningTasks: number
  completedTasks: number
  failedTasks: number
  totalExecutions: number
  pendingReviews: number
}

export interface GoalFilter {
  projectId: string
  status?: string
  priority?: number
  search?: string
  limit?: number
  offset?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
}
