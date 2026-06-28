// ============================================================
// Execution Events — event definitions for execution lifecycle
// Uses Platform Event Bus (IEventBus) — not own EventEmitter
// ============================================================

import type { ExecutionPlan, ExecutionStep, ExecutionResult, ExecutionContext, StepResult } from '../types.js'
import type { IEventBus } from '@platform/events/event-bus'
import { platformEventBus } from '@platform/events/event-bus'

/**
 * Execution Event Service — emits execution lifecycle events.
 */
export const executionEventService = {
  _eventBus: platformEventBus as IEventBus,

  /**
   * Override the event bus (for testing).
   */
  setEventBus(bus: IEventBus): void {
    this._eventBus = bus
  },

  /**
   * Emitted when a plan is compiled.
   */
  async emitPlanCompiled(plan: ExecutionPlan): Promise<void> {
    this._eventBus.emit({
      type: 'capability:Validated',
      source: 'execution-runtime',
      timestamp: new Date().toISOString(),
      context: plan.context,
      traceId: plan.context?.traceId,
      entityId: plan.id,
      projectId: plan.context?.projectId,
      payload: {
        planId: plan.id,
        capabilityId: plan.capabilityId,
        stepCount: plan.steps.length,
        version: plan.version,
      },
    })
  },

  /**
   * Emitted when a plan starts execution.
   */
  async emitPlanStarted(plan: ExecutionPlan): Promise<void> {
    this._eventBus.emit({
      type: 'execution:Started',
      source: 'execution-runtime',
      timestamp: new Date().toISOString(),
      context: plan.context,
      traceId: plan.context?.traceId,
      entityId: plan.id,
      projectId: plan.context?.projectId,
      payload: {
        planId: plan.id,
        capabilityId: plan.capabilityId,
        stepCount: plan.steps.length,
        startedAt: new Date().toISOString(),
      },
    })
  },

  /**
   * Emitted when a step starts execution.
   */
  async emitStepStarted(step: ExecutionStep, execCtx: ExecutionContext): Promise<void> {
    this._eventBus.emit({
      type: 'task:Created',
      source: 'execution-runtime',
      timestamp: new Date().toISOString(),
      context: execCtx.context,
      traceId: execCtx.context?.traceId,
      entityId: step.id,
      projectId: execCtx.context?.projectId,
      payload: {
        planId: execCtx.planId,
        stepId: step.id,
        stepType: step.type,
        stepName: step.name,
        startedAt: new Date().toISOString(),
      },
    })
  },

  /**
   * Emitted when a step completes (success or failure).
   */
  async emitStepCompleted(stepResult: StepResult, execCtx: ExecutionContext): Promise<void> {
    const eventType = stepResult.status === 'completed' ? 'task:Completed' : 'task:Failed' as any

    this._eventBus.emit({
      type: eventType,
      source: 'execution-runtime',
      timestamp: new Date().toISOString(),
      context: execCtx.context,
      traceId: execCtx.context?.traceId,
      entityId: stepResult.stepId,
      projectId: execCtx.context?.projectId,
      payload: {
        planId: execCtx.planId,
        stepId: stepResult.stepId,
        stepType: stepResult.stepType,
        status: stepResult.status,
        durationMs: stepResult.durationMs,
        retryCount: stepResult.retryCount,
        error: stepResult.error,
        completedAt: new Date().toISOString(),
      },
      error: stepResult.error ? {
        code: stepResult.error.code,
        message: stepResult.error.message,
      } : undefined,
    })
  },

  /**
   * Emitted when a step is rolled back.
   */
  async emitStepRollback(step: ExecutionStep, execCtx: ExecutionContext): Promise<void> {
    this._eventBus.emit({
      type: 'goal:Cancelled',
      source: 'execution-runtime',
      timestamp: new Date().toISOString(),
      context: execCtx.context,
      traceId: execCtx.context?.traceId,
      entityId: step.id,
      projectId: execCtx.context?.projectId,
      payload: {
        planId: execCtx.planId,
        stepId: step.id,
        stepType: step.type,
        reason: 'rollback',
      },
    })
  },

  /**
   * Emitted when a plan completes successfully.
   */
  async emitPlanCompleted(result: ExecutionResult): Promise<void> {
    this._eventBus.emit({
      type: 'execution:Completed',
      source: 'execution-runtime',
      timestamp: new Date().toISOString(),
      context: result.context,
      traceId: result.context?.traceId,
      entityId: result.planId,
      projectId: result.context?.projectId,
      payload: {
        planId: result.planId,
        capabilityId: result.capabilityId,
        status: result.status,
        durationMs: result.durationMs,
        totalSteps: result.metrics.totalSteps,
        completedSteps: result.metrics.completedSteps,
        failedSteps: result.metrics.failedSteps,
        completedAt: new Date().toISOString(),
      },
    })
  },

  /**
   * Emitted when a plan fails.
   */
  async emitPlanFailed(result: ExecutionResult): Promise<void> {
    this._eventBus.emit({
      type: 'execution:Failed',
      source: 'execution-runtime',
      timestamp: new Date().toISOString(),
      context: result.context,
      traceId: result.context?.traceId,
      entityId: result.planId,
      projectId: result.context?.projectId,
      payload: {
        planId: result.planId,
        capabilityId: result.capabilityId,
        status: result.status,
        durationMs: result.durationMs,
        totalSteps: result.metrics.totalSteps,
        failedSteps: result.metrics.failedSteps,
        error: result.error,
      },
      error: result.error ? {
        code: result.error.code,
        message: result.error.message,
      } : undefined,
    })
  },
}
