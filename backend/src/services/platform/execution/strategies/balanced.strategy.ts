// ============================================================
// Balanced Strategy — balance between quality, latency, and cost
// ============================================================

import type { IExecutionStrategy } from './execution-strategy.interface.js'
import type { ExecutionPlan, ExecutionResult, ExecutionStep, ExecutionDecision } from '../types.js'
import { ExecutionStrategy } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'

export const balancedStrategy: IExecutionStrategy = {
  name: 'Balanced',
  description: 'Balances quality, latency, and cost with sensible defaults',

  async prioritize(steps: ExecutionStep[], _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionStep[]> {
    return [...steps]
  },

  getMaxParallelism(_plan: ExecutionPlan): number {
    return 5
  },

  getTimeoutMultiplier(): number {
    return 1.5
  },

  getRetryPolicy(_plan: ExecutionPlan): { maxAttempts: number; backoffMs: number } {
    return { maxAttempts: 3, backoffMs: 1000 }
  },

  async postProcess(result: ExecutionResult, _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionResult> {
    result.metadata = {
      ...result.metadata,
      strategy: this.name,
      balance: 'neutral',
    }
    return result
  },

  getDecisions(_plan: ExecutionPlan, _ctx?: PlatformContext): ExecutionDecision[] {
    return [
      {
        id: 'decision-balanced-strategy',
        stepId: '__strategy__',
        reason: 'Balanced strategy selected for neutral quality-cost-latency tradeoff',
        decision: ExecutionStrategy.Balanced,
        alternatives: [ExecutionStrategy.QualityFirst, ExecutionStrategy.LatencyFirst, ExecutionStrategy.CostFirst],
        rejectedAlternatives: [],
        chosenStrategy: ExecutionStrategy.Balanced,
        qualityTradeoff: 'Standard quality, no tradeoff',
        costTradeoff: '1x baseline',
        latencyTradeoff: '1x baseline',
      },
    ]
  },
}
