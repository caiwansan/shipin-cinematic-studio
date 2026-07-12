// ============================================================
// Execution Runtime — RC1 模块入口
// ============================================================

// 类型
export type {
  NodeStatus,
  GraphStatus,
  NodeType,
  ProviderPolicy,
  RetryConfig,
  ExecutionContext,
  ExecutionArtifact,
  ExecutionEventType,
  ExecutionEvent,
  ExecutionEdge,
  ExecutionNode,
  ExecutionGraph,
  IDAGScheduler,
  INodeStateMachine,
  ExecutionTraceRepository,
} from './types'
export { DEFAULT_RETRY_CONFIG } from './types'

// 工厂函数
export { createExecutionContext } from './context'
export { createExecutionArtifact } from './artifact'
export { createExecutionEvent } from './event'

// Graph 辅助
export {
  createExecutionGraph,
  createExecutionNode,
  addEdge,
  getReadyNodes,
  getDependents,
} from './graph-helpers'

// Scheduler
export { NodeStateMachine, EVENT_TO_NEXT_STATUS } from './scheduler/state-machine'
export { DAGScheduler } from './scheduler/dag-scheduler'
export type { NodeExecuteFn } from './scheduler/dag-scheduler'

// Repository
export { InMemoryExecutionTraceRepository } from './repository/execution-trace.repository.impl'
export type { IExecutionTraceRepository } from './repository/execution-trace.repository'

// ─── RC2 — Provider Runtime ───

// Provider 类型
export type {
  ProviderCapability,
  ProviderRegistration,
  RouterContext,
} from './provider/types'

// Provider Registry
export { ProviderRegistry } from './provider/provider-registry'

// Provider Health
export type { ProviderHealth } from './provider/provider-health'
export { ProviderHealthService } from './provider/provider-health'

// Capability Router
export { CapabilityRouter } from './provider/capability-router'

// Provider Health Repository
export type { ProviderHealthRepository } from './repository/provider-health.repository'
export { InMemoryProviderHealthRepository } from './repository/provider-health.repository.impl'

// ─── RC2-2 — Retry Policy & Timeout ───

// RetryPolicy
export type { RetryPolicy, RetryConfig as RetryPolicyConfig } from './retry/retry-policy'
export {
  FixedRetryPolicy,
  ExponentialBackoffRetryPolicy,
  AdaptiveRetryPolicy,
  createRetryPolicy,
} from './retry/retry-policy'

// RetryScheduler
export { RetryScheduler } from './retry/retry-scheduler'
export type { RetrySchedule } from './retry/retry-scheduler'

// Timeout
export { TimeoutTracker } from './retry/timeout'
export type { TimeoutResult } from './retry/timeout'

// ─── RC2-3a — Circuit Breaker ───

// Circuit Breaker Types
export type {
  BreakerStatus,
  CircuitBreakerConfig,
  CircuitBreakerState,
  SlidingWindowRecord,
} from './circuit-breaker/circuit-breaker.types'
export {
  createDefaultBreakerState,
  createDefaultBreakerConfig,
} from './circuit-breaker/circuit-breaker.types'

// Circuit Breaker Service
export { CircuitBreakerService } from './circuit-breaker/circuit-breaker'
export type { ICircuitBreaker } from './circuit-breaker/circuit-breaker'

// Circuit Breaker Repository
export type { CircuitBreakerRepository } from './repository/circuit-breaker.repository'
export { InMemoryCircuitBreakerRepository } from './repository/circuit-breaker.repository.impl'

// ─── RC2-3b — Fallback Graph ───

// Fallback Types
export type {
  FallbackNode,
  FallbackGraph,
  FallbackConfig,
} from './fallback/fallback.types'

// Fallback Resolver
export {
  FallbackResolver,
  createDefaultFallbackConfig,
} from './fallback/fallback-resolver'
export type { IFallbackResolver } from './fallback/fallback-resolver'

// ─── RC2-3c — Dead Letter Queue ───

// DLQ Types
export type {
  DLQStatus,
  DLQReason,
  DLQRecord,
  DLQQuery,
} from './dlq/dlq.types'

// DLQ Service
export { DLQService } from './dlq/dlq.service'

// DLQ Repository
export type { IDLQRepository } from './repository/dlq.repository'
export { InMemoryDLQRepository } from './repository/dlq.repository.impl'

// DLQ Routes
export { createDLQRoutes } from './dlq/routes/dlq.route'

// ─── RC3-1 — Execution Planner Platform ───

// Planner Types
export type {
  PlanningRequest,
  PlanningStep,
  PlanningResult,
  PlanningNodeResult,
  PlanningEdgeResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './planner/planner.types'

// Dependency Builder
export { DependencyBuilder } from './planner/dependency-builder'

// Graph Validator
export { GraphValidator } from './planner/graph-validator'

// Execution Planner
export { ExecutionPlanner } from './planner/planner'
export type { IExecutionPlanner } from './planner/planner'

// Mission Adapter
export { MissionExecutionAdapter } from './adapters/mission-adapter'
export type { IMissionExecutionAdapter, Mission } from './adapters/mission-adapter'

// ─── RC3-2 — Resource Allocation ───

// Resource Types
export type {
  ResourceType,
  ExecutionAssignment,
  AllocationResult,
  AllocationWarning,
  AllocationDiagnostic,
} from './resource/resource.types'

// Resource Allocator
export { ResourceAllocator } from './resource/resource-allocator'

// Strategy Interface
export type { IAllocationStrategy, AllocationContext } from './resource/strategies/strategy.interface'

// Built-in Strategies
export { FastestStrategy } from './resource/strategies/fastest.strategy'
export { CheapestStrategy } from './resource/strategies/cheapest.strategy'
export { BalancedStrategy } from './resource/strategies/balanced.strategy'

// ─── RC3-3 — Prediction Layer ───

// Prediction Types
export type {
  EstimationResult,
  CriticalPathAnalysis,
  ResourceSummary,
  NodeEstimate,
  PredictionContext,
} from './prediction/prediction.types'

// Estimator Interface
export type { IEstimator } from './prediction/estimator.interface'

// Static Estimator
export { StaticEstimator } from './prediction/static-estimator'

// Prediction Service
export { PredictionService } from './prediction/prediction.service'
