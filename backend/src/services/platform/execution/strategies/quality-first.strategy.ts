// ============================================================
// Quality-First Strategy — prioritizes output quality over speed/cost
// ============================================================

import type { IExecutionStrategy } from './execution-strategy.interface.js'
import type { ExecutionPlan, ExecutionResult, ExecutionStep } from '../types.js'
import { StepType } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'

export const qualityFirstStrategy: IExecutionStrategy = {
  name: 'QualityFirst',
  description: 'Prioritizes output quality — uses better models, more validation, higher retries',

  async prioritize(steps: ExecutionStep[], plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionStep[]> {
    // Ensure validation steps are included and ordered after provider calls
    return [...steps].sort((a, b) => {
      // VALIDATE_OUTPUT should run after CALL_PROVIDER
      if (a.type === StepType.VALIDATE_OUTPUT && b.type === StepType.CALL_PROVIDER) return 1
      if (a.type === StepType.CALL_PROVIDER && b.type === StepType.VALIDATE_OUTPUT) return -1
      return 0
    })
  },

  getMaxParallelism(_plan: ExecutionPlan): number {
    return 2 // Conservative parallelism to ensure quality
  },

  getTimeoutMultiplier(): number {
    return 3.0 // Longer timeouts for quality processing
  },

  getRetryPolicy(_plan: ExecutionPlan): { maxAttempts: number; backoffMs: number } {
    return { maxAttempts: 5, backoffMs: 2000 }
  },

  async postProcess(result: ExecutionResult, _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionResult> {
    // Add quality assurance metadata
    result.metadata = {
      ...result.metadata,
      strategy: this.name,
      qualityScore: result.stepResults.every(r => r.status === 'completed') ? 1.0 : 0.5,
    }
    return result
  },
}
