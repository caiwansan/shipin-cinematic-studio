// ============================================================
// Execution Types — Plan, Step, Strategy, Context, Result
// KMKI-KERNEL-001: Platform Intermediate Representation (IR)
// Provider-agnostic, fully versioned, explainable, replayable
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context'

// ─── Schema Version ───

export const EXECUTION_SCHEMA_VERSION = '2.0.0'
export const EXECUTION_PLANNER_VERSION = '2.0.0'
export const EXECUTION_COMPILER_VERSION = '2.0.0'
export const EXECUTION_CONTRACT_VERSION = '1.0.0'
export const EXECUTION_STRATEGY_VERSION = '1.0.0'

// ─── Step Category ───
// Steps are categorized by action type (platform IR), NOT by provider name.

export type StepCategory =
  | 'Acquire'    // Fetch data from external sources (assets, semantic, graph, vector search)
  | 'Transform'  // Transform or enrich data (context building, prompt rendering)
  | 'Reason'     // AI/LLM reasoning (provider calls, inference)
  | 'Execute'    // Execute business logic (scripts, tools, MCP)
  | 'Persist'    // Store data (assets, results, state)
  | 'Notify'     // Emit events, notifications
  | 'Wait'       // Wait for event, human approval, condition
  | 'Control'    // Flow control (condition, validation, routing)

// ─── Step Type Enum ───
// GENERIC step types categorized by StepCategory.
// No provider-specific types (no CALL_PROVIDER, BUILD_PROMPT, etc.)

export enum StepType {
  // Acquire
  LOAD_ASSET = 'LOAD_ASSET',
  LOAD_SEMANTIC = 'LOAD_SEMANTIC',
  LOAD_GRAPH = 'LOAD_GRAPH',
  VECTOR_SEARCH = 'VECTOR_SEARCH',

  // Transform
  BUILD_CONTEXT = 'BUILD_CONTEXT',
  TRANSFORM = 'TRANSFORM',

  // Reason
  REASON = 'REASON',

  // Execute
  CALL_TOOL = 'CALL_TOOL',
  CALL_MCP = 'CALL_MCP',
  RUN_SCRIPT = 'RUN_SCRIPT',

  // Persist
  STORE_ASSET = 'STORE_ASSET',
  UPDATE_GRAPH = 'UPDATE_GRAPH',
  CACHE = 'CACHE',

  // Notify
  EMIT_EVENT = 'EMIT_EVENT',

  // Wait
  CALL_HUMAN = 'CALL_HUMAN',
  WAIT_EVENT = 'WAIT_EVENT',

  // Control
  VALIDATE_OUTPUT = 'VALIDATE_OUTPUT',
  CONDITION = 'CONDITION',
  TRANSFORM_CONTROL = 'TRANSFORM_CONTROL',
}

/** Map StepType → StepCategory */
export const STEP_CATEGORY: Record<StepType, StepCategory> = {
  [StepType.LOAD_ASSET]: 'Acquire',
  [StepType.LOAD_SEMANTIC]: 'Acquire',
  [StepType.LOAD_GRAPH]: 'Acquire',
  [StepType.VECTOR_SEARCH]: 'Acquire',
  [StepType.BUILD_CONTEXT]: 'Transform',
  [StepType.TRANSFORM]: 'Transform',
  [StepType.REASON]: 'Reason',
  [StepType.CALL_TOOL]: 'Execute',
  [StepType.CALL_MCP]: 'Execute',
  [StepType.RUN_SCRIPT]: 'Execute',
  [StepType.STORE_ASSET]: 'Persist',
  [StepType.UPDATE_GRAPH]: 'Persist',
  [StepType.CACHE]: 'Persist',
  [StepType.EMIT_EVENT]: 'Notify',
  [StepType.CALL_HUMAN]: 'Wait',
  [StepType.WAIT_EVENT]: 'Wait',
  [StepType.VALIDATE_OUTPUT]: 'Control',
  [StepType.CONDITION]: 'Control',
  [StepType.TRANSFORM_CONTROL]: 'Control',
}

// ─── Executor Type ───
// Specifies HOW a step is executed, independent of WHAT it does.

export type ExecutorType =
  | 'provider'   // AI/LLM provider
  | 'tool'       // System/business tool
  | 'mcp'        // Model Context Protocol
  | 'human'      // Human-in-the-loop
  | 'script'     // Execute script
  | 'cache'      // Cache lookup
  | 'wait'       // Wait for condition/event
  | 'default'    // Default executor

// ─── Execution Strategy Enum ───

export enum ExecutionStrategy {
  QualityFirst = 'QualityFirst',
  LatencyFirst = 'LatencyFirst',
  CostFirst = 'CostFirst',
  Balanced = 'Balanced',
  Custom = 'Custom',
}

// ─── Execution Decision ───
// Explainability: every decision records reasoning, alternatives, tradeoffs.

export interface ExecutionDecision {
  id: string
  stepId: string
  reason: string
  decision: string
  alternatives: string[]
  rejectedAlternatives: string[]
  chosenStrategy: string
  qualityTradeoff: string
  costTradeoff: string
  latencyTradeoff?: string
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
  rollbackSteps?: string[]
  compensation?: string
  timeout?: number
}

// ─── Execution Step (Platform IR) ───

export interface ExecutionStep {
  id: string
  name: string
  phase: number                        // Execution phase (topological order)
  category: StepCategory               // Abstract category (IR)
  type: StepType                       // Plugin type for registry
  executorType: ExecutorType           // How to execute ('provider' | 'tool' | 'human' | 'mcp' | 'script' | 'cache' | 'wait')
  inputs: Record<string, any>          // Step inputs
  outputs: Record<string, string>      // stepId → outputKey mappings for result routing
  dependencies: string[]               // Step IDs this step depends on
  timeout: number                      // ms
  retry: RetryPolicy
  condition?: string                   // Optional condition expression for Conditional step
  decisions: ExecutionDecision[]       // Explainability records
  metadata: Record<string, any>
}

// ─── Execution Plan (Platform IR) ───

export interface ExecutionPlan {
  id: string
  capabilityId: string
  version: string

  // Version fields (fully versioned for replay compatibility)
  schemaVersion: string                // IR schema version
  plannerVersion: string               // Planner version
  compilerVersion: string              // Compiler version
  contractVersion: string              // Originating contract version
  strategyVersion: string              // Strategy version

  // Structure
  steps: ExecutionStep[]
  dependencies: Record<string, string[]>   // stepId → [dependencyStepIds]
  parallelGroups: string[][]               // groups of step IDs that can run in parallel

  // Policies
  retryPolicy: RetryPolicy
  rollbackPolicy: RollbackPolicy

  // Context
  context: PlatformContext

  // Explainability
  decisions: ExecutionDecision[]

  // Metadata
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
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
  decisions?: ExecutionDecision[]
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
  decisions?: ExecutionDecision[]
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

// ─── Execution Context (runtime, not persisted) ───

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

// ─── Logical Plan (Planner output) ───
// The planner outputs a LogicalPlan — step order + dependencies only.
// The compiler fills in parameters (timeout, budget, strategy, executorType).

export interface LogicalPlan {
  id: string
  capabilityId: string
  version: string
  plannerVersion: string
  contractVersion: string
  steps: LogicalStep[]
  dependencies: Record<string, string[]>
  parallelGroups: string[][]
  decisions: ExecutionDecision[]
  metadata: Record<string, any>
  createdAt: Date
}

export interface LogicalStep {
  id: string
  name: string
  phase: number
  category: StepCategory
  type: StepType
  dependencies: string[]
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

// ─── Quality / Budget / Timeout Profiles ───
// These are COMPILER concerns, not part of the IR.
// Kept for contract input compatibility; compiled into step-level params.

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
