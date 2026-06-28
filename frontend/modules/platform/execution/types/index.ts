// ============================================================
// Frontend Execution Types — mirrors backend types
// ============================================================

export enum StepType {
  LOAD_ASSET = 'LOAD_ASSET',
  LOAD_SEMANTIC = 'LOAD_SEMANTIC',
  LOAD_GRAPH = 'LOAD_GRAPH',
  BUILD_CONTEXT = 'BUILD_CONTEXT',
  BUILD_PROMPT = 'BUILD_PROMPT',
  CALL_PROVIDER = 'CALL_PROVIDER',
  VALIDATE_OUTPUT = 'VALIDATE_OUTPUT',
  STORE_ASSET = 'STORE_ASSET',
  UPDATE_GRAPH = 'UPDATE_GRAPH',
  EMIT_EVENT = 'EMIT_EVENT',
}

export enum ExecutionStrategy {
  QualityFirst = 'QualityFirst',
  LatencyFirst = 'LatencyFirst',
  CostFirst = 'CostFirst',
  Balanced = 'Balanced',
  Custom = 'Custom',
}

export const EXECUTION_SCHEMA_VERSION = '1.0.0'

export interface ExecutionStep {
  id: string
  type: StepType
  name: string
  inputs?: Record<string, any>
  outputs?: Record<string, string>
  dependencies?: string[]
  executorType?: string
  timeout?: number
  retry?: RetryPolicy
  condition?: string
  metadata?: Record<string, any>
}

export interface RetryPolicy {
  maxAttempts: number
  backoffMs: number
  backoffMultiplier?: number
  maxBackoffMs?: number
  retryableErrors?: string[]
}

export interface QualityProfile {
  maxTokens?: number
  temperature?: number
  topP?: number
  modelPreference?: string[]
  validationThreshold?: number
  metadata?: Record<string, any>
}

export interface BudgetProfile {
  maxCost?: number
  currency?: string
  maxSteps?: number
  metadata?: Record<string, any>
}

export interface TimeoutProfile {
  stepTimeout: number
  planTimeout: number
  executionTimeout: number
}

export interface ExecutionPlan {
  id: string
  capabilityId: string
  version: string
  context?: Record<string, any>
  qualityProfile?: QualityProfile
  budgetProfile?: BudgetProfile
  timeoutProfile?: TimeoutProfile
  steps: ExecutionStep[]
  dependencies?: Record<string, string[]>
  parallelGroups?: string[][]
  retryPolicy?: RetryPolicy
  rollbackPolicy?: { enabled: boolean; rollbackSteps?: string[]; timeout?: number }
  metadata?: Record<string, any>
  schemaVersion: string
}

export interface StepResult {
  stepId: string
  stepType: StepType
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  output?: any
  error?: { code: string; message: string; details?: Record<string, any> }
  retryCount?: number
}

export interface ExecutionMetrics {
  totalSteps: number
  completedSteps: number
  failedSteps: number
  skippedSteps: number
  totalDurationMs: number
  totalCost?: number
  retryCount: number
  strategyUsed: ExecutionStrategy
}

export interface ExecutionResult {
  planId: string
  capabilityId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  durationMs?: number
  stepResults: StepResult[]
  finalOutput?: any
  error?: { code: string; message: string; details?: Record<string, any> }
  metrics: ExecutionMetrics
  schemaVersion: string
}

export interface ExecutionHistoryRecord {
  id: string
  planId: string
  capabilityId: string
  status: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  totalSteps: number
  completedSteps: number
  failedSteps: number
  strategyUsed: ExecutionStrategy
  error?: string
  metadata?: Record<string, any>
}

export interface ExecutionDashboard {
  globalMetrics: {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    cancelledExecutions: number
    averageDurationMs: number
    totalCost: number
    totalRetries: number
  }
  strategyMetrics: Record<string, { count: number; failures: number; averageDurationMs: number }>
  recentExecutions: ExecutionHistoryRecord[]
  totalPlans: number
}
