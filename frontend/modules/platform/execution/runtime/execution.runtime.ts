// ============================================================
// Frontend Execution Runtime — lifecycle management
// ============================================================

import type { ExecutionPlan, ExecutionResult } from '../types/index.js'
import { executionApiService } from './execution.service.js'

class FrontendExecutionRuntime {
  private initialized = false
  private currentExecution: { plan: ExecutionPlan; result?: ExecutionResult } | null = null

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    console.log('[FrontendExecutionRuntime] Initialized')
  }

  async execute(plan: ExecutionPlan): Promise<ExecutionResult> {
    this._requireInit()
    this.currentExecution = { plan }

    try {
      const result = await executionApiService.executePlan(plan)
      this.currentExecution.result = result
      return result
    } catch (err) {
      throw err
    }
  }

  async cancel(): Promise<void> {
    this._requireInit()
    if (this.currentExecution) {
      this.currentExecution.result = {
        planId: this.currentExecution.plan.id,
        capabilityId: this.currentExecution.plan.capabilityId,
        status: 'cancelled',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        stepResults: [],
        metrics: {
          totalSteps: this.currentExecution.plan.steps.length,
          completedSteps: 0,
          failedSteps: 0,
          skippedSteps: 0,
          totalDurationMs: 0,
          retryCount: 0,
          strategyUsed: 'Balanced' as any,
        },
        schemaVersion: '1.0.0',
      }
    }
  }

  getCurrentExecution() {
    return this.currentExecution
  }

  clear() {
    this.currentExecution = null
  }

  isInitialized(): boolean {
    return this.initialized
  }

  async dispose(): Promise<void> {
    this.clear()
    this.initialized = false
    console.log('[FrontendExecutionRuntime] Disposed')
  }

  private _requireInit(): void {
    if (!this.initialized) {
      throw new Error('FrontendExecutionRuntime not initialized. Call init() first.')
    }
  }
}

export const frontendExecutionRuntime = new FrontendExecutionRuntime()
