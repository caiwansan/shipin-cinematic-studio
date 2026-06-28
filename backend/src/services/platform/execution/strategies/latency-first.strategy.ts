// ============================================================
// Latency-First Strategy — prioritizes speed over quality/cost
// ============================================================

import type { IExecutionStrategy } from './execution-strategy.interface.js'
import type { ExecutionPlan, ExecutionResult, ExecutionStep } from '../types.js'
import { StepType } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'

export const latencyFirstStrategy: IExecutionStrategy = {
  name: 'LatencyFirst',
  description: 'Prioritizes execution speed — minimal validation, aggressive parallelism, fewer retries',

  async prioritize(steps: ExecutionStep[], _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionStep[]> {
    // Move validation to end (non-blocking), execute provider call earlier
    return [...steps].sort((a, b) => {
      if (a.type === StepType.VALIDATE_OUTPUT && b.type !== StepType.VALIDATE_OUTPUT) return 1
      if (a.type !== StepType.VALIDATE_OUTPUT && b.type === StepType.VALIDATE_OUTPUT) return -1
      return 0
    })
  },

  getMaxParallelism(_plan: ExecutionPlan): number {
    return 10 // High parallelism
  },

  getTimeoutMultiplier(): number {
    return 0.5 // Shorter timeouts
  },

  getRetryPolicy(_plan: ExecutionPlan): { maxAttempts: number; backoffMs: number } {
    return { maxAttempts: 1, backoffMs: 0 } // No retries
  },

  async postProcess(result: ExecutionResult, _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionResult> {
    result.metadata = {
      ...result.metadata,
      strategy: this.name,
      latencyScore: result.durationMs ? Math.max(0, 1 - result.durationMs / 10000) : 0,
    }
    return result
  },
}
