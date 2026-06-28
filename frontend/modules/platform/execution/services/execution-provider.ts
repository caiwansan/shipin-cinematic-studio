// ============================================================
// Execution Provider — cross-workspace interface for execution
// ============================================================

import type { ExecutionPlan, ExecutionResult } from '../types/index.js'
import { frontendExecutionRuntime } from '../runtime/execution.runtime.js'

/**
 * Cross-workspace execution provider interface.
 * Workspaces (asset, goal, semantic) can use this to execute plans.
 */
export interface IExecutionProvider {
  /** Execute a compiled plan */
  execute(plan: ExecutionPlan): Promise<ExecutionResult>

  /** Cancel current execution */
  cancel(): Promise<void>

  /** Get current execution status */
  getStatus(): { isExecuting: boolean; planId?: string }
}

/**
 * Default execution provider implementation.
 */
export const executionProvider: IExecutionProvider = {
  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    return frontendExecutionRuntime.execute(plan)
  },

  async cancel(): Promise<void> {
    await frontendExecutionRuntime.cancel()
  },

  getStatus(): { isExecuting: boolean; planId?: string } {
    const current = frontendExecutionRuntime.getCurrentExecution()
    return {
      isExecuting: !!current,
      planId: current?.plan.id,
    }
  },
}
