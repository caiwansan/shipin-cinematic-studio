/**
 * Execution Kernel — Barrel Export
 *
 * 这是 execution 模块的唯一入口点。
 * 外部代码必须通过此 barrel 导入，不得直接导入子模块。
 *
 * @package @studio/platform/execution
 */

// Core types
export type {
  ExecutionRequest,
  ExecutionTask,
  ExecutionStatus,
  ExecutionResult,
  ExecutionError,
} from './types';

// Execution Context
export type { ExecutionContext } from './execution-context';

// Pipeline
export {
  ExecutionPipeline,
  DefaultExecutionPipeline,
  DefaultValidateHandler,
  DefaultExecuteHandler,
  PIPELINE_STAGES,
} from './execution-pipeline';
export type {
  ExecutionPipelineStage,
  PipelineHandler,
} from './execution-pipeline';

// Engine
export { ExecutionEngine } from './execution-engine';
export type { ExecutionEngineOptions } from './execution-engine';

// Scheduler interface
export type { ExecutionScheduler } from './execution-scheduler';

// InMemoryScheduler
export { InMemoryScheduler } from './in-memory-scheduler';

// Worker
export type { ExecutionWorker, WorkerParams, WorkerRegistry } from './execution-worker';

// Lock
export type { ExecutionLockManager } from './execution-lock';
export { InMemoryLockManager } from './execution-lock';

// Events
export { ExecutionEventTypes } from './execution-events';
export type {
  ExecutionEvent,
  ExecutionSubmittedEvent,
  ExecutionStageStartedEvent,
  ExecutionStageCompletedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
  ExecutionCancelledEvent,
  ExecutionRetryingEvent,
  ExecutionProgressEvent,
} from './execution-events';

// Capability Handler
export { ExecutionCapabilityHandler, ExecutionCapabilityError } from './execution-capability-handler';
