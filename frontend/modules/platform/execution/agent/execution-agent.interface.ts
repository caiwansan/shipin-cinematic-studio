// ============================================================
// Execution Agent Interface — compile, plan, execute, cancel, resume
// ============================================================

import type { ExecutionPlan, ExecutionResult } from '../types/index.js'
import { executionApiService } from '../services/execution.service.js'
import { frontendExecutionRuntime } from '../runtime/execution.runtime.js'

export interface IExecutionAgent {
  /**
   * Compile a capability contract into an execution plan.
   */
  compile(capabilityId: string, ctx?: Record<string, any>): Promise<ExecutionPlan>

  /**
   * Plan execution from capability contract.
   */
  plan(capabilityId: string, input: any, ctx?: Record<string, any>): Promise<ExecutionPlan>

  /**
   * Execute a plan and return results.
   */
  execute(plan: ExecutionPlan, ctx?: Record<string, any>): Promise<ExecutionResult>

  /**
   * Cancel current execution.
   */
  cancel(): Promise<void>

  /**
   * Resume a paused/failed execution.
   */
  resume(planId: string, ctx?: Record<string, any>): Promise<ExecutionResult>
}

/**
 * Default execution agent implementation.
 */
export const executionAgent: IExecutionAgent = {
  async compile(capabilityId: string, _ctx?: Record<string, any>): Promise<ExecutionPlan> {
    const compiled = await executionApiService.compileContract({
      id: capabilityId,
      name: capabilityId,
      displayName: capabilityId,
      description: null,
      category: 'general',
      version: '1.0.0',
      status: 'active',
    })
    return compiled.plan
  },

  async plan(capabilityId: string, _input: any, _ctx?: Record<string, any>): Promise<ExecutionPlan> {
    return this.compile(capabilityId, _ctx)
  },

  async execute(plan: ExecutionPlan, _ctx?: Record<string, any>): Promise<ExecutionResult> {
    return frontendExecutionRuntime.execute(plan)
  },

  async cancel(): Promise<void> {
    await frontendExecutionRuntime.cancel()
  },

  async resume(planId: string, _ctx?: Record<string, any>): Promise<ExecutionResult> {
    const plan = await executionApiService.getPlan(planId)
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`)
    }
    return frontendExecutionRuntime.execute(plan)
  },
}
