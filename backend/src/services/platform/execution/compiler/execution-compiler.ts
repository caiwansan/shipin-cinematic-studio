// ============================================================
// Execution Compiler — LogicalPlan → ExecutablePlan compilation
// Compiler fills in parameters (timeout, budget, strategy, executorType).
// Compiler does NOT determine step order or dependencies (that's Planner).
// ============================================================

import type { CapabilityContractInput, ExecutionPlan, ExecutionStep, ExecutionDecision, LogicalPlan, LogicalStep, QualityProfile, BudgetProfile, TimeoutProfile, RetryPolicy, RollbackPolicy } from '../types.js'
import { StepType, EXECUTION_SCHEMA_VERSION, EXECUTION_PLANNER_VERSION, EXECUTION_COMPILER_VERSION, EXECUTION_STRATEGY_VERSION, ExecutorType, ExecutionStrategy, STEP_CATEGORY } from '../types.js'
import { executionPlanner } from '../planner/execution-planner.js'
import { PlatformContext, createContext } from '@platform/context/platform-context'
import { ContractError } from '@platform/errors/platform-errors'

export interface CompilationOptions {
  qualityProfile?: QualityProfile
  budgetProfile?: BudgetProfile
  timeoutProfile?: TimeoutProfile
  strategy?: ExecutionStrategy
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
  decisions: ExecutionDecision[]
  compiledAt: string
}

// ─── Default parameter providers ───
// These define the default timeout/retry/executor mapping for each step type.

const DEFAULT_STEP_TIMEOUT: Partial<Record<StepType, number>> = {
  [StepType.LOAD_ASSET]: 30000,
  [StepType.LOAD_SEMANTIC]: 15000,
  [StepType.LOAD_GRAPH]: 20000,
  [StepType.VECTOR_SEARCH]: 15000,
  [StepType.BUILD_CONTEXT]: 10000,
  [StepType.TRANSFORM]: 15000,
  [StepType.REASON]: 60000,
  [StepType.CALL_TOOL]: 30000,
  [StepType.CALL_MCP]: 30000,
  [StepType.RUN_SCRIPT]: 60000,
  [StepType.STORE_ASSET]: 30000,
  [StepType.UPDATE_GRAPH]: 15000,
  [StepType.CACHE]: 5000,
  [StepType.EMIT_EVENT]: 5000,
  [StepType.CALL_HUMAN]: 300000,
  [StepType.WAIT_EVENT]: 3600000,
  [StepType.VALIDATE_OUTPUT]: 10000,
  [StepType.CONDITION]: 5000,
  [StepType.TRANSFORM_CONTROL]: 5000,
}

const DEFAULT_STEP_RETRY: Partial<Record<StepType, RetryPolicy>> = {
  [StepType.REASON]: { maxAttempts: 3, backoffMs: 1000, backoffMultiplier: 2, maxBackoffMs: 30000 },
  [StepType.CALL_TOOL]: { maxAttempts: 2, backoffMs: 500, backoffMultiplier: 2, maxBackoffMs: 10000 },
  [StepType.CALL_MCP]: { maxAttempts: 2, backoffMs: 500, backoffMultiplier: 2, maxBackoffMs: 10000 },
  [StepType.LOAD_ASSET]: { maxAttempts: 2, backoffMs: 500 },
  [StepType.STORE_ASSET]: { maxAttempts: 2, backoffMs: 500 },
}

const DEFAULT_EXECUTOR_TYPE: Record<StepType, ExecutorType> = {
  [StepType.LOAD_ASSET]: 'default',
  [StepType.LOAD_SEMANTIC]: 'default',
  [StepType.LOAD_GRAPH]: 'default',
  [StepType.VECTOR_SEARCH]: 'tool',
  [StepType.BUILD_CONTEXT]: 'default',
  [StepType.TRANSFORM]: 'script',
  [StepType.REASON]: 'provider',
  [StepType.CALL_TOOL]: 'tool',
  [StepType.CALL_MCP]: 'mcp',
  [StepType.RUN_SCRIPT]: 'script',
  [StepType.STORE_ASSET]: 'default',
  [StepType.UPDATE_GRAPH]: 'default',
  [StepType.CACHE]: 'cache',
  [StepType.EMIT_EVENT]: 'default',
  [StepType.CALL_HUMAN]: 'human',
  [StepType.WAIT_EVENT]: 'wait',
  [StepType.VALIDATE_OUTPUT]: 'default',
  [StepType.CONDITION]: 'default',
  [StepType.TRANSFORM_CONTROL]: 'default',
}

/**
 * Compile logical steps into executable steps with filled parameters.
 */
function compileSteps(
  logicalSteps: LogicalStep[],
  timeoutProfile?: TimeoutProfile,
  strategy?: ExecutionStrategy,
): ExecutionStep[] {
  return logicalSteps.map((ls, idx) => {
    const defaultTimeout = DEFAULT_STEP_TIMEOUT[ls.type] || 30000
    const stepTimeout = timeoutProfile?.stepTimeout
      ? Math.min(defaultTimeout, timeoutProfile.stepTimeout)
      : defaultTimeout

    const defaultRetry = DEFAULT_STEP_RETRY[ls.type] || { maxAttempts: 1, backoffMs: 500 }

    const step: ExecutionStep = {
      id: ls.id,
      name: ls.name,
      phase: ls.phase,
      category: ls.category,
      type: ls.type,
      executorType: DEFAULT_EXECUTOR_TYPE[ls.type] || 'default',
      inputs: {},
      outputs: {},
      dependencies: ls.dependencies,
      timeout: stepTimeout,
      retry: { ...defaultRetry },
      decisions: [],
      metadata: {
        compiledPhase: idx,
      },
    }

    return step
  })
}

/**
 * Generate compiler decisions for explainability.
 */
function generateCompilerDecisions(
  logicalSteps: LogicalStep[],
  strategy?: ExecutionStrategy,
): ExecutionDecision[] {
  const decisions: ExecutionDecision[] = []

  decisions.push({
    id: `decision-compiler-strategy-${Date.now().toString(36)}`,
    stepId: '__compile__',
    reason: `Strategy selection for execution plan`,
    decision: strategy || ExecutionStrategy.Balanced,
    alternatives: Object.values(ExecutionStrategy).filter(s => s !== strategy),
    rejectedAlternatives: Object.values(ExecutionStrategy).filter(s => s !== strategy && s !== ExecutionStrategy.Custom),
    chosenStrategy: strategy || ExecutionStrategy.Balanced,
    qualityTradeoff: strategy === ExecutionStrategy.QualityFirst
      ? 'High quality, 2x cost, 3x latency'
      : strategy === ExecutionStrategy.LatencyFirst
        ? 'Fast execution, lower quality, higher cost'
        : strategy === ExecutionStrategy.CostFirst
          ? 'Minimal cost, lower quality, slower retries'
          : 'Balanced quality-cost-latency tradeoff',
    costTradeoff: strategy === ExecutionStrategy.CostFirst ? 'Minimal' : strategy === ExecutionStrategy.QualityFirst ? '2x baseline' : '1x baseline',
    latencyTradeoff: strategy === ExecutionStrategy.LatencyFirst ? 'Minimal' : strategy === ExecutionStrategy.QualityFirst ? '3x baseline' : '1x baseline',
  })

  return decisions
}

/**
 * Execution Compiler — compiles LogicalPlan → ExecutablePlan.
 * Fills in timeouts, retries, executor types, and strategy parameters.
 * Does NOT determine step order or dependencies (that's the Planner's job).
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

    // Step 1: Plan → get LogicalPlan
    const logicalPlan = await executionPlanner.plan(contract, context)

    // Step 2: Apply quality/budget/timeout profiles
    let timeoutProfile = contract.timeoutProfile || options?.timeoutProfile
    let qualityProfile = contract.qualityProfile || options?.qualityProfile
    let budgetProfile = contract.budgetProfile || options?.budgetProfile
    const strategy = options?.strategy

    if (!timeoutProfile) {
      timeoutProfile = {
        stepTimeout: 60000,
        planTimeout: 300000,
        executionTimeout: 600000,
      }
    }

    // Apply runtime constraints
    if (options?.runtimeConstraints) {
      for (const constraint of options.runtimeConstraints) {
        switch (constraint.type) {
          case 'timeout':
            timeoutProfile = {
              ...timeoutProfile,
              executionTimeout: constraint.value as number,
              stepTimeout: Math.min(timeoutProfile!.stepTimeout, constraint.value as number),
              planTimeout: Math.min(timeoutProfile!.planTimeout, constraint.value as number),
            }
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
            warnings.push('Retry limit constraint applied; step retry policies may be overridden')
            break
        }
      }
    }

    // Step 3: Compile steps (fill params)
    const steps = compileSteps(logicalPlan.steps, timeoutProfile, strategy)

    // Step 4: Generate compiler decisions
    const compilerDecisions = generateCompilerDecisions(logicalPlan.steps, strategy)
    const allDecisions = [...logicalPlan.decisions, ...compilerDecisions]

    // Step 5: Build the executable plan
    const retryPolicy = contract.retryPolicy || { maxAttempts: 3, backoffMs: 1000 }
    const rollbackPolicy = contract.rollbackPolicy || { enabled: false }
    const now = new Date()

    const plan: ExecutionPlan = {
      id: logicalPlan.id,
      capabilityId: contract.id,
      version: contract.version || '1.0.0',

      // Version fields
      schemaVersion: EXECUTION_SCHEMA_VERSION,
      plannerVersion: logicalPlan.plannerVersion,
      compilerVersion: EXECUTION_COMPILER_VERSION,
      contractVersion: contract.version || EXECUTION_PLANNER_VERSION.replace(EXECUTION_PLANNER_VERSION[0], '1'),
      strategyVersion: EXECUTION_STRATEGY_VERSION,

      // Structure
      steps,
      dependencies: logicalPlan.dependencies,
      parallelGroups: logicalPlan.parallelGroups,

      // Policies
      retryPolicy,
      rollbackPolicy,

      // Context
      context: context,

      // Explainability
      decisions: allDecisions,

      // Metadata
      metadata: {
        ...logicalPlan.metadata,
        compiledAt: new Date().toISOString(),
        compileDurationMs: Date.now() - startTime,
        strategy: strategy || ExecutionStrategy.Balanced,
        runtimeConstraints: options?.runtimeConstraints?.map(c => c.type),
        qualityProfile: qualityProfile ? {
          validationThreshold: qualityProfile.validationThreshold,
          modelPreference: qualityProfile.modelPreference,
        } : undefined,
        budgetProfile: budgetProfile ? {
          maxCost: budgetProfile.maxCost,
          maxSteps: budgetProfile.maxSteps,
        } : undefined,
        ...options?.metadata,
      },
      createdAt: logicalPlan.createdAt,
      updatedAt: now,
    }

    return {
      plan,
      warnings,
      decisions: allDecisions,
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
