// ============================================================
// Goal Runtime — Type Definitions
// Platform-level types for Goal, Strategy, Workflow, Task, Action, Execution, Review
// ============================================================

// ─── Status Enums ───

export enum GoalStatus {
  Draft = 'draft',
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum StrategyStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum WorkflowStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum WorkflowStageStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum TaskStatus {
  Pending = 'pending',
  Ready = 'ready',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum ExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum ReviewStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  NeedsRevision = 'needs_revision',
}

export enum ExecutionResultType {
  Created = 'created',
  Updated = 'updated',
  Deleted = 'deleted',
  Skipped = 'skipped',
  Error = 'error',
}

// ─── Data Interfaces ───

export interface GoalData {
  id?: string
  projectId: string
  title: string
  description?: string
  successCriteria?: string // JSON array of criteria
  targetMetric?: string
  deadline?: string
  priority?: number
  status?: string
  metadata?: string // JSON
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface StrategyData {
  id?: string
  goalId: string
  name: string
  description?: string
  type: string // content, entity, citation, authority, visibility, etc.
  status?: string
  priority?: number
  metadata?: string // JSON
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface WorkflowData {
  id?: string
  strategyId: string
  name: string
  description?: string
  status?: string
  metadata?: string // JSON
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface WorkflowStageData {
  id?: string
  workflowId: string
  name: string
  order: number
  status?: string
  metadata?: string // JSON
  schemaVersion?: number
  createdAt?: string
}

export interface TaskData {
  id?: string
  goalId?: string
  strategyId?: string
  workflowId?: string
  stageId?: string
  title: string
  description?: string
  actionType: string
  priority?: number
  dependencies?: string // JSON array of task IDs
  retryCount?: number
  maxRetries?: number
  deadline?: string
  status?: string
  metadata?: string // JSON
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface ActionData {
  id?: string
  name: string
  description?: string
  provider: string // internal, llm, api, webhook
  config?: string // JSON configuration schema
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface ExecutionData {
  id?: string
  taskId: string
  actionType: string
  status?: string
  input?: string // JSON
  output?: string // JSON
  error?: string
  durationMs?: number
  retryAttempt?: number
  metadata?: string // JSON
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface ExecutionResultData {
  id?: string
  executionId: string
  assetId?: string
  type: string // created, updated, deleted, skipped, error
  summary?: string
  details?: string // JSON
  schemaVersion?: number
  createdAt?: string
}

export interface ReviewData {
  id?: string
  executionId: string
  status?: string
  comments?: string
  score?: number
  metadata?: string // JSON
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

// ─── Action Registry Interface ───

export interface ActionHandler {
  /** Unique action name */
  name: string
  /** Human-readable description */
  description: string
  /** Provider type: internal, llm, api, webhook */
  provider: string
  /** Execute the action with given input */
  execute(input: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<ActionResult>
}

export interface ActionResult {
  success: boolean
  output?: Record<string, unknown>
  error?: string
  durationMs?: number
  assetId?: string
}

export interface ActionRegistryEntry {
  action: ActionHandler
  config?: Record<string, unknown>
  registeredAt: Date
}

// ─── Runtime Event Types ───

export type GoalEventType =
  | 'goal:created'
  | 'goal:updated'
  | 'goal:deleted'
  | 'goal:activated'
  | 'goal:completed'
  | 'goal:cancelled'
  | 'strategy:generated'
  | 'strategy:updated'
  | 'workflow:generated'
  | 'workflow:updated'
  | 'task:created'
  | 'task:completed'
  | 'task:failed'
  | 'execution:started'
  | 'execution:completed'
  | 'execution:failed'
  | 'review:created'
  | 'review:approved'
  | 'review:rejected'
  | 'goal:closed'

export interface GoalEvent {
  type: GoalEventType
  projectId: string
  goalId?: string
  strategyId?: string
  workflowId?: string
  taskId?: string
  executionId?: string
  reviewId?: string
  timestamp: Date
  data?: Record<string, unknown>
}

// ─── Filter Types ───

export interface GoalFilter {
  projectId: string
  status?: string
  priority?: number
  search?: string
  limit?: number
  offset?: number
}

export interface StrategyFilter {
  goalId?: string
  type?: string
  status?: string
  limit?: number
  offset?: number
}

export interface TaskFilter {
  goalId?: string
  strategyId?: string
  workflowId?: string
  stageId?: string
  status?: string
  actionType?: string
  limit?: number
  offset?: number
}

export interface ExecutionFilter {
  taskId?: string
  status?: string
  actionType?: string
  limit?: number
  offset?: number
}
