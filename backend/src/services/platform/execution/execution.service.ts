// ============================================================
// Execution Service — business orchestration
// ============================================================

import type { ExecutionPlan, ExecutionResult, ExecutionPlanQuery, StepType } from './types.js'
import { EXECUTION_SCHEMA_VERSION, ExecutionStrategy } from './types.js'
import type { CompilationOptions } from './compiler/execution-compiler.js'
import type { CapabilityContractInput } from './types.js'
import { executionRuntime } from './runtime/execution.runtime.js'
import { executionCompiler } from './compiler/execution-compiler.js'
import { executionPlanner } from './planner/execution-planner.js'
import { executionEngine } from './engine/execution-engine.js'
import { executionValidator } from './validators/execution-validator.js'
import { executionPlanRepository } from './repositories/execution-plan.repository.js'
import { executionHistoryRepository } from './repositories/execution-history.repository.js'
import { executionMetricsRepository } from './repositories/execution-metrics.repository.js'
import { PlatformContext, createContext } from '@platform/context/platform-context'
import { RuntimeError } from '@platform/errors/platform-errors'

export interface ExecuteFromContractOptions {
  capabilityId: string
  contract: CapabilityContractInput
  input?: Record<string, any>
  compilationOptions?: CompilationOptions
  strategy?: ExecutionStrategy
}

export const executionService = {
  /**
   * Execute a capability from its contract.
   * Full pipeline: compile → plan → validate → schedule → execute.
   */
  async executeFromContract(
    options: ExecuteFromContractOptions,
    ctx?: PlatformContext,
  ): Promise<ExecutionResult> {
    const context = createContext(ctx)

    // 1. Compile contract to plan
    const compiled = await executionCompiler.compile(options.contract, options.compilationOptions, context)

    // 2. Save plan
    await executionPlanRepository.save(compiled.plan, context)

    // 3. Execute
    return executionRuntime.execute(context, compiled.plan)
  },

  /**
   * Execute a pre-compiled plan.
   */
  async executePlan(
    plan: ExecutionPlan,
    ctx?: PlatformContext,
  ): Promise<ExecutionResult> {
    const context = createContext(ctx)

    // Validate
    const validation = await executionValidator.validate(plan, context)
    if (!validation.valid) {
      throw new RuntimeError(
        `Cannot execute invalid plan: ${validation.errors.join('; ')}`,
        { planId: plan.id, errors: validation.errors },
      )
    }

    // Execute
    return executionRuntime.execute(context, plan)
  },

  /**
   * Compile a contract without executing.
   */
  async compileOnly(
    contract: CapabilityContractInput,
    options?: CompilationOptions,
    ctx?: PlatformContext,
  ) {
    return executionCompiler.compile(contract, options, ctx)
  },

  /**
   * Validate a plan without executing.
   */
  async validatePlan(
    plan: ExecutionPlan,
    ctx?: PlatformContext,
  ) {
    return executionValidator.validate(plan, ctx)
  },

  /**
   * Get plan by ID.
   */
  async getPlan(planId: string, ctx?: PlatformContext): Promise<ExecutionPlan | null> {
    return executionPlanRepository.getById(planId, ctx)
  },

  /**
   * List plans with query.
   */
  async listPlans(query: ExecutionPlanQuery, ctx?: PlatformContext) {
    return executionPlanRepository.list(query, ctx)
  },

  /**
   * Delete a plan by ID.
   */
  async deletePlan(planId: string, ctx?: PlatformContext): Promise<void> {
    return executionPlanRepository.delete(planId, ctx)
  },

  /**
   * Get execution history.
   */
  async getHistory(
    filter?: { capabilityId?: string; status?: string; fromDate?: string; toDate?: string },
    limit?: number,
  ) {
    return executionHistoryRepository.list(filter, limit)
  },

  /**
   * Get global metrics.
   */
  async getMetrics() {
    return executionMetricsRepository.getGlobal()
  },

  /**
   * Get metrics for a specific capability.
   */
  async getCapabilityMetrics(capabilityId: string) {
    return executionMetricsRepository.getByCapabilityId(capabilityId)
  },

  /**
   * Get strategy metrics.
   */
  async getStrategyMetrics() {
    return executionMetricsRepository.getByStrategy()
  },
}
