// ============================================================
// Execution Strategy Interface — pluggable execution strategies
// KMKI-KERNEL-001: Added decision support for explainability
// ============================================================

import type { ExecutionPlan, ExecutionStep, ExecutionResult, ExecutionDecision } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'

export interface IExecutionStrategy {
  name: string
  description: string

  /**
   * Prioritize steps based on strategy.
   * Returns reordered step list.
   */
  prioritize(steps: ExecutionStep[], plan: ExecutionPlan, ctx?: PlatformContext): Promise<ExecutionStep[]>

  /**
   * Determine max parallelism for the strategy.
   */
  getMaxParallelism(plan: ExecutionPlan): number

  /**
   * Strategy-specific timeout multiplier.
   */
  getTimeoutMultiplier(): number

  /**
   * Strategy-specific retry policy override.
   */
  getRetryPolicy(plan: ExecutionPlan): { maxAttempts: number; backoffMs: number } | null

  /**
   * Post-process execution result based on strategy.
   */
  postProcess(result: ExecutionResult, plan: ExecutionPlan, ctx?: PlatformContext): Promise<ExecutionResult>

  /**
   * Return strategy decisions for explainability.
   * Each strategy should document why it made certain choices.
   */
  getDecisions(plan: ExecutionPlan, ctx?: PlatformContext): ExecutionDecision[]
}
