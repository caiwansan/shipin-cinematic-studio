// ============================================================
// Execution Engine — executes ExecutionPlan
// STATELESS: All state lives in ExecutionContext or Repository.
// Engine methods accept ctx + plan; no private state.
// Flow: Load Plan → Resolve Dependencies → Schedule Steps → Execute Step → Collect Results → Validate → Emit Events
// ============================================================

import type { ExecutionPlan, ExecutionResult, StepResult, ExecutionContext } from '../types.js'
import { EXECUTION_SCHEMA_VERSION, ExecutionStrategy } from '../types.js'
import type { StepPlugin, StepPluginInput } from '../registry/step-plugin-registry.js'
import { stepPluginRegistry, resolveStepExecutor } from '../registry/step-plugin-registry.js'
import { executionScheduler } from '../scheduler/execution-scheduler.js'
import type { SchedulerStrategy } from '../scheduler/scheduler.strategies.js'
import { executionEventService } from '../events/execution-events.js'
import type { PlatformContext } from '@platform/context/platform-context'
import { ExecutionError, RuntimeError } from '@platform/errors/platform-errors'
import { IEventBus } from '@platform/events/event-bus'

/**
 * Timeout wrapper for step execution.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, stepId: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Step ${stepId} timed out after ${ms}ms`)), ms),
    ),
  ])
}

/**
 * Sleep helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate backoff delay in milliseconds.
 */
function calculateBackoff(step: import('../types.js').ExecutionStep, attempt: number): number {
  const baseBackoff = step.retry?.backoffMs || 1000
  const multiplier = step.retry?.backoffMultiplier || 2
  const maxBackoff = step.retry?.maxBackoffMs || 30000
  const delay = baseBackoff * Math.pow(multiplier, attempt - 1)
  return Math.min(delay, maxBackoff)
}

export interface EngineOptions {
  strategy?: SchedulerStrategy
  eventBus?: IEventBus
  signal?: AbortSignal
}

/**
 * Execute a single step within the given execution context.
 */
async function executeStep(
  step: import('../types.js').ExecutionStep,
  execCtx: ExecutionContext,
  plan: ExecutionPlan,
  signal: AbortSignal,
): Promise<StepResult> {
  const stepStartTime = Date.now()
  const stepResult: StepResult = {
    stepId: step.id,
    stepType: step.type,
    status: 'running',
    startedAt: new Date().toISOString(),
  }

  try {
    await executionEventService.emitStepStarted(step, execCtx)

    // Check if we should skip (dependencies failed)
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        const depStatus = execCtx.stepStates.get(depId)
        if (depStatus?.state === 'failed' || depStatus?.state === 'skipped') {
          stepResult.status = 'skipped'
          stepResult.completedAt = new Date().toISOString()
          stepResult.durationMs = Date.now() - stepStartTime
          await executionEventService.emitStepCompleted(stepResult, execCtx)
          return stepResult
        }
      }
    }

    const executor = resolveStepExecutor(step.type)
    let lastError: Error | null = null
    let attempts = 0
    const maxAttempts = step.retry?.maxAttempts || 1

    while (attempts < maxAttempts) {
      attempts++

      if (signal.aborted) {
        stepResult.status = 'cancelled'
        break
      }

      try {
        const input: StepPluginInput = {
          step,
          executionContext: execCtx,
          intermediateResults: execCtx.intermediateResults,
          signal,
        }

        const timeout = step.timeout || 60000
        const output = await withTimeout(
          executor.execute(input, execCtx.context),
          timeout,
          step.id,
        )

        if (output.success) {
          stepResult.status = 'completed'
          stepResult.output = output.output
          stepResult.retryCount = attempts - 1

          execCtx.stepStates.set(step.id, {
            stepId: step.id,
            state: 'completed',
            startedAt: stepResult.startedAt,
            completedAt: new Date().toISOString(),
            retryCount: attempts - 1,
          })

          // Store intermediate result
          execCtx.intermediateResults.set(step.id, output.output)

          break
        } else {
          lastError = new Error(output.error?.message || 'Step execution failed')
          if (attempts < maxAttempts) {
            const backoff = calculateBackoff(step, attempts)
            await sleep(backoff)
          }
        }
      } catch (err) {
        lastError = err as Error
        if (attempts < maxAttempts) {
          const backoff = calculateBackoff(step, attempts)
          await sleep(backoff)
        }
      }
    }

    if (stepResult.status === 'running') {
      if (lastError) {
        stepResult.status = 'failed'
        stepResult.error = {
          code: 'STEP_EXECUTION_ERROR',
          message: lastError.message,
        }
        execCtx.stepStates.set(step.id, {
          stepId: step.id,
          state: 'failed',
          startedAt: stepResult.startedAt,
          completedAt: new Date().toISOString(),
          retryCount: attempts - 1,
          error: lastError.message,
        })
        execCtx.errors.push({ stepId: step.id, error: lastError })
      } else {
        stepResult.status = 'failed'
        stepResult.error = {
          code: 'MAX_RETRIES_EXCEEDED',
          message: `Step exceeded max retries (${maxAttempts})`,
        }
      }
    }

    stepResult.completedAt = new Date().toISOString()
    stepResult.durationMs = Date.now() - stepStartTime

    await executionEventService.emitStepCompleted(stepResult, execCtx)
    return stepResult
  } catch (err) {
    stepResult.status = 'failed'
    stepResult.completedAt = new Date().toISOString()
    stepResult.durationMs = Date.now() - stepStartTime
    stepResult.error = {
      code: 'STEP_CRASH',
      message: (err as Error).message,
    }
    await executionEventService.emitStepCompleted(stepResult, execCtx)
    return stepResult
  }
}

/**
 * Rollback execution.
 */
async function rollback(
  plan: ExecutionPlan,
  execCtx: ExecutionContext,
  signal: AbortSignal,
): Promise<void> {
  const rollbackSteps = plan.rollbackPolicy?.rollbackSteps || []

  for (const stepId of rollbackSteps.reverse()) {
    if (signal.aborted) break
    const step = plan.steps.find(s => s.id === stepId)
    if (!step) continue

    try {
      await executionEventService.emitStepRollback(step, execCtx)
    } catch {
      // Silently continue rollback
    }
  }
}

/**
 * Build execution result.
 */
function buildResult(
  plan: ExecutionPlan,
  execCtx: ExecutionContext,
  stepResults: StepResult[],
  startTime: number,
): ExecutionResult {
  const completedSteps = stepResults.filter(r => r.status === 'completed').length
  const failedSteps = stepResults.filter(r => r.status === 'failed').length
  const skippedSteps = stepResults.filter(r => r.status === 'skipped').length

  return {
    planId: plan.id,
    capabilityId: plan.capabilityId,
    status: execCtx.state as 'completed' | 'failed' | 'cancelled',
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    stepResults,
    finalOutput: execCtx.intermediateResults.get('finalOutput'),
    metrics: {
      totalSteps: plan.steps.length,
      completedSteps,
      failedSteps,
      skippedSteps,
      totalDurationMs: Date.now() - startTime,
      retryCount: stepResults.reduce((sum, r) => sum + (r.retryCount || 0), 0),
      strategyUsed: ExecutionStrategy.Balanced,
    },
    context: plan.context,
    schemaVersion: plan.schemaVersion,
    decisions: plan.decisions,
  }
}

/**
 * Build cancelled result.
 */
function buildCancelledResult(
  plan: ExecutionPlan,
  stepResults: StepResult[],
  startTime: number,
): ExecutionResult {
  return {
    planId: plan.id,
    capabilityId: plan.capabilityId,
    status: 'cancelled',
    startedAt: new Date(startTime).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    stepResults,
    metrics: {
      totalSteps: plan.steps.length,
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      totalDurationMs: Date.now() - startTime,
      retryCount: 0,
      strategyUsed: ExecutionStrategy.Balanced,
    },
    schemaVersion: plan.schemaVersion,
  }
}

// ─── Engine object ───
// Stateless — all functions accept explicit parameters.
// No private fields, no in-memory maps, no instance state.

export const executionEngine = {
  /**
   * Execute a full ExecutionPlan.
   */
  async execute(
    plan: ExecutionPlan,
    options?: EngineOptions,
    _ctx?: PlatformContext,
  ): Promise<ExecutionResult> {
    const startTime = Date.now()
    const stepResults: StepResult[] = []
    const signal = options?.signal
    const strategy = options?.strategy

    if (signal?.aborted) {
      return buildCancelledResult(plan, stepResults, startTime)
    }

    // Phase 1: Schedule
    await executionEventService.emitPlanStarted(plan)
    const schedule = await executionScheduler.schedule(plan, strategy, signal)
    const execCtx = executionScheduler.createExecutionContext(plan, schedule)
    execCtx.state = 'executing'

    const abortController = execCtx.abortController

    // Combine external and internal abort signals
    if (signal) {
      signal.addEventListener('abort', () => {
        abortController.abort()
      })
    }

    try {
      // Phase 2: Execute by group
      for (let groupIndex = 0; groupIndex < schedule.totalGroups; groupIndex++) {
        if (abortController.signal.aborted) {
          break
        }

        const groupSteps = schedule.schedule.filter(s => s.group === groupIndex)

        // Execute all steps in this group in parallel
        const groupPromises = groupSteps.map(scheduledStep =>
          executeStep(scheduledStep.step, execCtx, plan, abortController.signal),
        )

        const groupResults = await Promise.all(groupPromises)
        stepResults.push(...groupResults)

        // Check for failures
        const failures = groupResults.filter(r => r.status === 'failed')
        if (failures.length > 0 && plan.rollbackPolicy?.enabled) {
          execCtx.state = 'failed'
          await rollback(plan, execCtx, abortController.signal)
          break
        }
      }

      // Determine final status
      if (abortController.signal.aborted) {
        execCtx.state = 'cancelled'
      } else if (execCtx.state !== 'failed') {
        execCtx.state = 'completed'
      }

      // Build final result
      const result = buildResult(plan, execCtx, stepResults, startTime)
      await executionEventService.emitPlanCompleted(result)

      return result
    } catch (err) {
      execCtx.state = 'failed'
      const result = buildResult(plan, execCtx, stepResults, startTime)
      result.error = {
        code: 'EXECUTION_ERROR',
        message: (err as Error).message,
      }
      await executionEventService.emitPlanFailed(result)
      return result
    }
  },
}
