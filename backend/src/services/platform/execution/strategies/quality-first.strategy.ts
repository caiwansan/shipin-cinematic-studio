// ============================================================
// Quality-First Strategy — prioritizes output quality over speed/cost
// ============================================================

import type { IExecutionStrategy } from './execution-strategy.interface.js'
import type { ExecutionPlan, ExecutionResult, ExecutionStep, ExecutionDecision } from '../types.js'
import { StepType, ExecutionStrategy } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'

export const qualityFirstStrategy: IExecutionStrategy = {
  name: 'QualityFirst',
  description: 'Prioritizes output quality — uses better models, more validation, higher retries',

  async prioritize(steps: ExecutionStep[], plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionStep[]> {
    return [...steps].sort((a, b) => {
      if (a.type === StepType.VALIDATE_OUTPUT && b.type === StepType.REASON) return 1
      if (a.type === StepType.REASON && b.type === StepType.VALIDATE_OUTPUT) return -1
      return 0
    })
  },

  getMaxParallelism(_plan: ExecutionPlan): number {
    return 2
  },

  getTimeoutMultiplier(): number {
    return 3.0
  },

  getRetryPolicy(_plan: ExecutionPlan): { maxAttempts: number; backoffMs: number } {
    return { maxAttempts: 5, backoffMs: 2000 }
  },

  async postProcess(result: ExecutionResult, _plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionResult> {
    result.metadata = {
      ...result.metadata,
      strategy: this.name,
      qualityScore: result.stepResults.every(r => r.status === 'completed') ? 1.0 : 0.5,
    }
    return result
  },

  getDecisions(_plan: ExecutionPlan, _ctx?: PlatformContext): ExecutionDecision[] {
    return [
      {
        id: 'decision-quality-first-strategy',
        stepId: '__strategy__',
        reason: 'Quality-First strategy selected for maximum output quality',
        decision: ExecutionStrategy.QualityFirst,
        alternatives: [ExecutionStrategy.LatencyFirst, ExecutionStrategy.CostFirst, ExecutionStrategy.Balanced],
        rejectedAlternatives: [ExecutionStrategy.LatencyFirst, ExecutionStrategy.CostFirst],
        chosenStrategy: ExecutionStrategy.QualityFirst,
        qualityTradeoff: 'High quality, 2x cost, 3x latency',
        costTradeoff: '2x baseline cost',
        latencyTradeoff: '3x baseline latency',
      },
    ]
  },
}
