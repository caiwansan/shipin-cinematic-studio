/**
 * @studio/platform — Barrel Export
 *
 * This is the ONLY entry point for all workspace imports.
 * Workspace code MUST NOT import from subdirectories directly.
 *
 * @package @studio/platform
 * @see PLATFORM-SDK.md
 */

// API types (layer 0 — no dependencies)
export type {
  ApiResponse,
  ApiError,
  ErrorCode,
  PaginatedResponse,
  CursorPagination,
  PagePagination,
  ValidationDetail,
} from './api/types';

// Auth
export { AuthService } from './auth/auth-service';
export type { AuthMiddleware, AuthUser, AuthConfig } from './auth/auth-service';

// Project
export { ProjectService } from './project/project-service';
export type {
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectFilter,
  WorkspaceType,
  ProjectStatus,
} from './project/project-service';

// Workspace
export type {
  WorkspaceAdapter,
  WorkspaceContext,
  WorkspaceRoute,
  WorkspaceMenu,
  WorkspaceType as WorkspaceTypeEnum,
  CapabilityRequirement,
  AssetType,
  CommandDefinition,
} from './workspace/workspace-adapter';

export { WorkspaceRegistry } from './workspace/workspace-registry';

// Repository
export { BaseRepository } from './repository/base-repository';
export type { ORMAdapter } from './repository/base-repository';

// C1.5: Real implementations
export { PrismaAdapter } from './repository/prisma-adapter';
export { GEOProjectRepository } from './repository/geo-project-repository';
export type { GEOProjectRecord, PlatformProject } from './repository/geo-project-repository';

// Capability
export { CapabilityRuntime } from './capability/capability-runtime';
export type {
  ProviderRegistration,
  AgentRegistration,
  CapabilityResult,
  CapabilityInvokeOptions,
} from './capability/capability-runtime';

// C1.5: Real Provider
export { OpenAIProvider } from './capability/openai-provider';
export type { Provider } from './capability/openai-provider';

// C2.1: Capability Orchestrator
export { CapabilityOrchestrator } from './capability/capability-orchestrator';
export { CapabilityRegistry } from './capability/registries/capability-registry';
export { ProviderRegistry } from './capability/registries/provider-registry';
export { ModelRegistry } from './capability/registries/model-registry';
export type { ModelEntry, ModelStatus } from './capability/registries/model-registry';
export { PolicyEngine } from './capability/policy/policy-engine';
export type { Policy, PolicyRule, PolicyResolution, PolicyContext } from './capability/policy/policy-engine';
export { CapabilityRouter } from './capability/router/capability-router';
export type { RouteResult } from './capability/router/capability-router';
export { HealthManager } from './capability/health-manager';
export type { HealthStatus, ProviderHealth } from './capability/health-manager';
export { CostManager } from './capability/cost-manager';
export type { UsageRecord, UsageFilter, CostFilter, CostAggregation } from './capability/cost-manager';
export { FallbackManager } from './capability/fallback-manager';

// Runtime
export { PlatformRuntime } from './runtime/platform-runtime';
export type {
  ExecutionRuntime,
  WorkflowRuntime,
} from './runtime/platform-runtime';

// Event
export { EventBus } from './event/event-bus';
export type {
  StudioEvent,
  EventMetadata,
  EventHandler,
  UnsubscribeFn,
} from './event/event-bus';

// State
export { StateRuntime } from './state/state-runtime';
export type {
  StateScope,
  SetStateOptions,
  WorkspaceState,
  UIState,
} from './state/state-runtime';

// Bootstrap
export { bootstrapPlatform, createCapabilityOrchestrator } from './bootstrap/platform-bootstrap';
export type { BootConfig, BootResult } from './bootstrap/platform-bootstrap';

// C2: Execution Kernel
export type {
  ExecutionRequest,
  ExecutionTask,
  ExecutionStatus,
  ExecutionResult,
  ExecutionError,
  ExecutionContext,
  ExecutionPipelineStage,
  PipelineHandler,
  ExecutionScheduler,
  ExecutionWorker,
  WorkerParams,
  WorkerRegistry,
  ExecutionLockManager,
  ExecutionEngineOptions,
  ExecutionEvent,
  ExecutionSubmittedEvent,
  ExecutionStageStartedEvent,
  ExecutionStageCompletedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  ExecutionCancelledEvent,
  ExecutionRetryingEvent,
  ExecutionProgressEvent,
} from './execution';

export {
  ExecutionEngine,
  ExecutionPipeline,
  DefaultExecutionPipeline,
  DefaultValidateHandler,
  DefaultExecuteHandler,
  InMemoryScheduler,
  InMemoryLockManager,
  ExecutionEventTypes,
  PIPELINE_STAGES,
} from './execution';
