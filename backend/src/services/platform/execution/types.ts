// ============================================================
// Execution Types — Plan, Step, Strategy, Context, Result
// KMKI-PLAT-007: Execution Runtime data structures
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context'

// ─── Schema Version for Backward Compatibility ───

export const EXECUTION_SCHEMA_VERSION = '1.0.0'

// ─── Step Type Enum ───

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

// ─── Execution Strategy Enum ───

export enum ExecutionStrategy {
  QualityFirst = 'QualityFirst',
  LatencyFirst = 'LatencyFirst',
  CostFirst = 'CostFirst',
  Balanced = 'Balanced',
  Custom = 'Custom',
}

// ─── Execution Step ───

export interface ExecutionStep {
  id: string
  type: StepType
  name: string
  inputs?: Record<string, any>
  outputs?: Record<string, string> // stepId → outputKey mappings for result routing
  dependencies?: string[]          // step IDs this step depends on
  executorType?: string            // plugin executor type, defaults to step type name
  timeout?: number                 // ms
  retry?: RetryPolicy
  condition?: string               // optional condition expression
  metadata?: Record<string, any>
}

// ─── Retry Policy ───

export interface RetryPolicy {
  maxAttempts: number
  backoffMs: number
  backoffMultiplier?: number
  maxBackoffMs?: number
  retryableErrors?: string[]
}

// ─── Rollback Policy ───

export interface RollbackPolicy {
  enabled: boolean
  rollbackSteps?: string[] // step IDs to execute on rollback
  timeout?: number
}

// ─── Quality / Budget / Timeout Profiles ───

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
  stepTimeout: number       // ms
  planTimeout: number       // ms
  executionTimeout: number  // ms
}

// ─── Execution Plan ───

export interface ExecutionPlan {
  id: string
  capabilityId: string
  version: string
  context?: PlatformContext
  qualityProfile?: QualityProfile
  budgetProfile?: BudgetProfile
  timeoutProfile?: TimeoutProfile
  steps: ExecutionStep[]
  dependencies?: Record<string, string[]> // stepId → [dependencyStepIds]
  parallelGroups?: string[][]             // groups of step IDs that can run in parallel
  retryPolicy?: RetryPolicy
  rollbackPolicy?: RollbackPolicy
  metadata?: Record<string, any>
  schemaVersion: string
}

// ─── Execution Result ───

export interface StepResult {
  stepId: string
  stepType: StepType
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  output?: any
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  retryCount?: number
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
  error?: {
    code: string
    message: string
    details?: Record<string, any>
  }
  metrics: ExecutionMetrics
  context?: PlatformContext
  schemaVersion: string
  metadata?: Record<string, any>
}

// ─── Execution Metrics ───

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

// ─── Execution Context ───

export interface ExecutionContext {
  planId: string
  capabilityId: string
  context: PlatformContext
  state: 'idle' | 'initialized' | 'planning' | 'compiling' | 'validating' | 'scheduling' | 'executing' | 'completed' | 'failed' | 'cancelled'
  startedAt?: string
  completedAt?: string
  stepStates: Map<string, StepStatus>
  intermediateResults: Map<string, any>
  stepOrder: string[]
  parallelGroups: string[][]
  abortController: AbortController
  errors: Array<{ stepId: string; error: Error }>
}

export interface StepStatus {
  stepId: string
  state: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled'
  startedAt?: string
  completedAt?: string
  retryCount: number
  error?: string
}

// ─── Capability Contract Input ───

export interface CapabilityContractInput {
  id: string
  name: string
  displayName: string
  description: string | null
  category: string
  version: string
  status: string
  metadata?: Record<string, any>
  steps?: ExecutionStep[]
  qualityProfile?: QualityProfile
  budgetProfile?: BudgetProfile
  timeoutProfile?: TimeoutProfile
  retryPolicy?: RetryPolicy
  rollbackPolicy?: RollbackPolicy
}

// ─── Execution Plan Query ───

export interface ExecutionPlanQuery {
  capabilityId?: string
  status?: string
  version?: string
  fromDate?: string
  toDate?: string
  page?: number
  pageSize?: number
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
