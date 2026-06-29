/**
 * Execution Events — 执行事件类型定义
 *
 * 所有执行生命周期事件通过 EventBus 发布。
 * 没有任何 execution 组件直接调用另一个组件的方法。
 *
 * 事件命名空间: execution.*
 *
 * @package @studio/platform/execution
 * @see EVENT-SPEC.md §2
 */

import type { ExecutionRequest, ExecutionResult, ExecutionError } from './types';
import type { ExecutionPipelineStage } from './execution-pipeline';

/**
 * 执行事件类型常量
 */
export const ExecutionEventTypes = {
  /** 任务已提交 */
  SUBMITTED: 'execution.submitted',
  /** 阶段开始 */
  STAGE_STARTED: 'execution.stage.started',
  /** 阶段完成 */
  STAGE_COMPLETED: 'execution.stage.completed',
  /** 执行完成 */
  COMPLETED: 'execution.completed',
  /** 执行失败 */
  FAILED: 'execution.failed',
  /** 执行取消 */
  CANCELLED: 'execution.cancelled',
  /** 重试中 */
  RETRYING: 'execution.retrying',
  /** 进度更新 */
  PROGRESS: 'execution.progress',
} as const;

// ============ 事件 payload 类型 ============

/**
 * 任务已提交事件
 */
export interface ExecutionSubmittedEvent {
  type: typeof ExecutionEventTypes.SUBMITTED;
  taskId: string;
  request: ExecutionRequest;
  timestamp: number;
  traceId: string;
}

/**
 * 阶段开始事件
 */
export interface ExecutionStageStartedEvent {
  type: typeof ExecutionEventTypes.STAGE_STARTED;
  taskId: string;
  stage: ExecutionPipelineStage;
  status: string;
  timestamp: number;
  traceId: string;
}

/**
 * 阶段完成事件
 */
export interface ExecutionStageCompletedEvent {
  type: typeof ExecutionEventTypes.STAGE_COMPLETED;
  taskId: string;
  stage: ExecutionPipelineStage;
  status: string;
  timestamp: number;
  traceId: string;
}

/**
 * 执行完成事件
 */
export interface ExecutionCompletedEvent {
  type: typeof ExecutionEventTypes.COMPLETED;
  taskId: string;
  result: ExecutionResult;
  duration: number;
  timestamp: number;
  traceId: string;
}

/**
 * 执行失败事件
 */
export interface ExecutionFailedEvent {
  type: typeof ExecutionEventTypes.FAILED;
  taskId: string;
  error: ExecutionError;
  stage?: ExecutionPipelineStage;
  timestamp: number;
  traceId: string;
}

/**
 * 执行取消事件
 */
export interface ExecutionCancelledEvent {
  type: typeof ExecutionEventTypes.CANCELLED;
  taskId: string;
  reason?: string;
  timestamp: number;
  traceId: string;
}

/**
 * 重试事件
 */
export interface ExecutionRetryingEvent {
  type: typeof ExecutionEventTypes.RETRYING;
  taskId: string;
  attempt: number;
  maxRetries: number;
  delay: number;
  error: ExecutionError;
  timestamp: number;
  traceId: string;
}

/**
 * 进度更新事件
 */
export interface ExecutionProgressEvent {
  type: typeof ExecutionEventTypes.PROGRESS;
  taskId: string;
  progress: number;
  message?: string;
  timestamp: number;
  traceId: string;
}

/**
 * 所有执行事件的联合类型
 */
export type ExecutionEvent =
  | ExecutionSubmittedEvent
  | ExecutionStageStartedEvent
  | ExecutionStageCompletedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | ExecutionCancelledEvent
  | ExecutionRetryingEvent
  | ExecutionProgressEvent;
