// ============================================================
// Cost-First Strategy — minimizes execution cost
// ============================================================

import type { IExecutionStrategy } from './execution-strategy.interface.js'
import type { ExecutionPlan, ExecutionResult, ExecutionStep, ExecutionDecision } from '../types.js'
import { StepType, ExecutionStrategy } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'

export const costFirstStrategy: IExecutionStrategy = {
  name: 'CostFirst',
  description: 'Minimizes execution cost — minimal retries, no unnecessary steps, budget-aware',

  async prioritize(steps: ExecutionStep[], _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionStep[]> {
    // Remove non-essential steps (like detailed validation, emit events) if budget is tight
    return [...steps].filter(step =>
      step.type !== StepType.EMIT_EVENT, // Skip event emission to save cost
    )
  },

  getMaxParallelism(_plan: ExecutionPlan): number {
    return 3
  },

  getTimeoutMultiplier(): number {
    return 1.0
  },

  getRetryPolicy(_plan: ExecutionPlan): { maxAttempts: number; backoffMs: number } {
    return { maxAttempts: 1, backoffMs: 0 } // No costly retries
  },

  async postProcess(result: ExecutionResult, _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionResult> {
    result.metadata = {
      ...result.metadata,
      strategy: this.name,
      estimatedCostSaved: result.metrics.retryCount > 0 ? 'minimal' : 'none',
    }
    return result
  },

  getDecisions(_plan: ExecutionPlan, _ctx?: PlatformContext): ExecutionDecision[] {
    return [
      {
        id: 'decision-cost-first-strategy',
        stepId: '__strategy__',
        reason: 'Cost-First strategy selected to minimize execution cost',
        decision: ExecutionStrategy.CostFirst,
        alternatives: [ExecutionStrategy.QualityFirst, ExecutionStrategy.LatencyFirst, ExecutionStrategy.Balanced],
        rejectedAlternatives: [ExecutionStrategy.QualityFirst, ExecutionStrategy.LatencyFirst],
        chosenStrategy: ExecutionStrategy.CostFirst,
        qualityTradeoff: 'Lower quality, minimal validation, no event emission',
        costTradeoff: 'Minimal cost',
        latencyTradeoff: '1x baseline (fewer retries)',
      },
    ]
  },
}
