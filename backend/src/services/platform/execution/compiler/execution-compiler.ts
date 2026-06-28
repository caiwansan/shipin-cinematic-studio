// ============================================================
// Execution Compiler — Capability → ExecutionPlan compilation
// Compiler does NOT call any Provider.
// ============================================================

import type { CapabilityContractInput, ExecutionPlan, ExecutionStep, QualityProfile, BudgetProfile, TimeoutProfile } from '../types.js'
import { StepType, EXECUTION_SCHEMA_VERSION } from '../types.js'
import { executionPlanner } from '../planner/execution-planner.js'
import { PlatformContext, createContext } from '@platform/context/platform-context'
import { ContractError } from '@platform/errors/platform-errors'

export interface CompilationOptions {
  qualityProfile?: QualityProfile
  budgetProfile?: BudgetProfile
  timeoutProfile?: TimeoutProfile
  runtimeConstraints?: RuntimeConstraint[]
  metadata?: Record<string, any>
}

export interface RuntimeConstraint {
  type: 'timeout' | 'max_steps' | 'max_cost' | 'model_preference' | 'retry_limit'
  value: any
}

export interface CompilationResult {
  plan: ExecutionPlan
  warnings: string[]
  compiledAt: string
}

/**
 * Execution Compiler — compiles capability contracts into executable plans.
 * Supports quality/budget/timeout profiles, runtime constraints, and metadata.
 */
export const executionCompiler = {
  /**
   * Compile a capability contract into an ExecutionPlan.
   */
  async compile(
    contract: CapabilityContractInput,
    options?: CompilationOptions,
    ctx?: PlatformContext,
  ): Promise<CompilationResult> {
    const context = createContext(ctx)
    const warnings: string[] = []
    const startTime = Date.now()

    if (!contract || !contract.id) {
      throw new ContractError('Cannot compile: invalid capability contract', { contract })
    }

    // Validate contract version
    if (!contract.version) {
      warnings.push(`Contract "${contract.name}" has no version; defaulting to 1.0.0`)
    }

    // Apply quality profile
    let qualityProfile = contract.qualityProfile
    if (options?.qualityProfile) {
      qualityProfile = options.qualityProfile
    }

    // Apply budget profile
    let budgetProfile = contract.budgetProfile
    if (options?.budgetProfile) {
      budgetProfile = options.budgetProfile
    }

    // Apply timeout profile
    let timeoutProfile = contract.timeoutProfile
    if (options?.timeoutProfile) {
      timeoutProfile = options.timeoutProfile
    }

    // Apply runtime constraints
    if (options?.runtimeConstraints) {
      for (const constraint of options.runtimeConstraints) {
        switch (constraint.type) {
          case 'timeout':
            timeoutProfile = {
              ...timeoutProfile,
              executionTimeout: constraint.value as number,
              stepTimeout: Math.min(timeoutProfile?.stepTimeout || 60000, constraint.value as number),
              planTimeout: Math.min(timeoutProfile?.planTimeout || 300000, constraint.value as number),
            }
            break
          case 'max_steps':
            // Will be validated later
            break
          case 'max_cost':
            budgetProfile = {
              ...budgetProfile,
              maxCost: constraint.value as number,
            }
            break
          case 'model_preference':
            qualityProfile = {
              ...qualityProfile,
              modelPreference: Array.isArray(constraint.value) ? constraint.value : [constraint.value as string],
            }
            break
          case 'retry_limit':
            warnings.push(`Retry limit constraint applied; contract retry policy will be overridden`)
            break
        }
      }
    }

    // Use planner to create the plan
    const plan = await executionPlanner.plan(
      {
        ...contract,
        qualityProfile,
        budgetProfile,
        timeoutProfile,
      },
      context,
    )

    // Add compilation metadata
    plan.metadata = {
      ...plan.metadata,
      compiledAt: new Date().toISOString(),
      compileDurationMs: Date.now() - startTime,
      runtimeConstraints: options?.runtimeConstraints?.map(c => c.type),
      ...options?.metadata,
    }

    return {
      plan,
      warnings,
      compiledAt: new Date().toISOString(),
    }
  },

  /**
   * Compile and immediately validate.
   */
  async compileAndValidate(
    contract: CapabilityContractInput,
    options?: CompilationOptions,
    ctx?: PlatformContext,
  ): Promise<CompilationResult> {
    const { executionValidator } = await import('../validators/execution-validator.js')
    const result = await this.compile(contract, options, ctx)
    const validation = await executionValidator.validate(result.plan, ctx)

    if (!validation.valid) {
      throw new ContractError(
        `Compilation validation failed: ${validation.errors.join('; ')}`,
        { errors: validation.errors, warnings: validation.warnings },
      )
    }

    return result
  },
}
