// ============================================================
// Execution Planner — inputs Capability Contract, outputs ExecutionPlan
// Planner only compiles; it does NOT execute.
// ============================================================

import type { CapabilityContractInput, ExecutionPlan, ExecutionStep } from '../types.js'
import { StepType, EXECUTION_SCHEMA_VERSION } from '../types.js'
import { PlatformContext, createContext } from '@platform/context/platform-context'
import { ContractError } from '@platform/errors/platform-errors'

/**
 * Generate a deterministic step ID.
 */
function stepId(type: StepType, index: number): string {
  return `step-${type.toLowerCase()}-${index}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Build default steps for a capability contract when no explicit steps are defined.
 */
function buildDefaultSteps(contract: CapabilityContractInput): ExecutionStep[] {
  const steps: ExecutionStep[] = []
  let index = 0

  // 1. Load asset (if applicable)
  steps.push({
    id: stepId(StepType.LOAD_ASSET, index++),
    type: StepType.LOAD_ASSET,
    name: `Load Asset (${contract.displayName})`,
    inputs: { capabilityId: contract.id },
    outputs: { assets: 'assets' },
    timeout: 30000,
    retry: { maxAttempts: 2, backoffMs: 500 },
  })

  // 2. Load semantic context
  steps.push({
    id: stepId(StepType.LOAD_SEMANTIC, index++),
    type: StepType.LOAD_SEMANTIC,
    name: `Load Semantic Context (${contract.displayName})`,
    dependencies: [steps[0].id],
    inputs: {},
    outputs: { semanticContext: 'semanticContext' },
    timeout: 15000,
  })

  // 3. Build context for provider call
  steps.push({
    id: stepId(StepType.BUILD_CONTEXT, index++),
    type: StepType.BUILD_CONTEXT,
    name: `Build Context (${contract.displayName})`,
    dependencies: [steps[1].id],
    inputs: { assets: '${steps[0].outputs.assets}', semantic: '${steps[1].outputs.semanticContext}' },
    outputs: { executionContext: 'executionContext' },
    timeout: 10000,
  })

  // 4. Build prompt
  steps.push({
    id: stepId(StepType.BUILD_PROMPT, index++),
    type: StepType.BUILD_PROMPT,
    name: `Build Prompt (${contract.displayName})`,
    dependencies: [steps[2].id],
    inputs: { context: '${steps[2].outputs.executionContext}' },
    outputs: { prompt: 'prompt' },
    timeout: 10000,
  })

  // 5. Call provider (interface only — no provider implementation yet)
  steps.push({
    id: stepId(StepType.CALL_PROVIDER, index++),
    type: StepType.CALL_PROVIDER,
    name: `Call Provider (${contract.displayName})`,
    dependencies: [steps[3].id],
    inputs: { prompt: '${steps[3].outputs.prompt}' },
    outputs: { providerResult: 'providerResult' },
    timeout: 60000,
    retry: { maxAttempts: 3, backoffMs: 1000, backoffMultiplier: 2 },
  })

  // 6. Validate output
  steps.push({
    id: stepId(StepType.VALIDATE_OUTPUT, index++),
    type: StepType.VALIDATE_OUTPUT,
    name: `Validate Output (${contract.displayName})`,
    dependencies: [steps[4].id],
    inputs: { result: '${steps[4].outputs.providerResult}' },
    outputs: { validated: 'validatedOutput' },
    timeout: 10000,
  })

  // 7. Store asset
  steps.push({
    id: stepId(StepType.STORE_ASSET, index++),
    type: StepType.STORE_ASSET,
    name: `Store Asset (${contract.displayName})`,
    dependencies: [steps[5].id],
    inputs: { output: '${steps[5].outputs.validated}' },
    outputs: { storedAssetId: 'storedAssetId' },
    timeout: 30000,
  })

  // 8. Emit completion event
  steps.push({
    id: stepId(StepType.EMIT_EVENT, index++),
    type: StepType.EMIT_EVENT,
    name: `Emit Completion Event (${contract.displayName})`,
    dependencies: [steps[6].id],
    inputs: { storedAssetId: '${steps[6].outputs.storedAssetId}' },
    outputs: {},
    timeout: 5000,
  })

  return steps
}

/**
 * Planner — creates an ExecutionPlan from a Capability Contract.
 */
export const executionPlanner = {
  /**
   * Create an ExecutionPlan from a CapabilityContract.
   */
  async plan(
    contract: CapabilityContractInput,
    ctx?: PlatformContext,
  ): Promise<ExecutionPlan> {
    const context = createContext(ctx)

    if (!contract.id || !contract.name) {
      throw new ContractError('Invalid capability contract: missing id or name', { contract })
    }

    const steps = contract.steps && contract.steps.length > 0
      ? contract.steps
      : buildDefaultSteps(contract)

    // Build dependency map
    const dependencies: Record<string, string[]> = {}
    for (const step of steps) {
      if (step.dependencies && step.dependencies.length > 0) {
        dependencies[step.id] = step.dependencies
      }
    }

    // Build parallel groups (simple: independent steps at same depth)
    const parallelGroups = buildParallelGroups(steps, dependencies)

    const plan: ExecutionPlan = {
      id: `plan-${contract.id}-${Date.now().toString(36)}`,
      capabilityId: contract.id,
      version: contract.version,
      context,
      qualityProfile: contract.qualityProfile,
      budgetProfile: contract.budgetProfile,
      timeoutProfile: contract.timeoutProfile || {
        stepTimeout: 60000,
        planTimeout: 300000,
        executionTimeout: 600000,
      },
      steps,
      dependencies,
      parallelGroups,
      retryPolicy: contract.retryPolicy || { maxAttempts: 3, backoffMs: 1000 },
      rollbackPolicy: contract.rollbackPolicy || { enabled: false },
      metadata: {
        contractName: contract.name,
        contractDisplayName: contract.displayName,
        category: contract.category,
        plannedAt: new Date().toISOString(),
      },
      schemaVersion: EXECUTION_SCHEMA_VERSION,
    }

    return plan
  },

  /**
   * Re-plan from an existing plan with updated context.
   */
  async replan(
    existingPlan: ExecutionPlan,
    overrides: Partial<ExecutionPlan>,
    _ctx?: PlatformContext,
  ): Promise<ExecutionPlan> {
    return {
      ...existingPlan,
      ...overrides,
      id: `plan-${existingPlan.capabilityId}-${Date.now().toString(36)}`,
      schemaVersion: EXECUTION_SCHEMA_VERSION,
      metadata: {
        ...existingPlan.metadata,
        originalPlanId: existingPlan.id,
        replannedAt: new Date().toISOString(),
        ...overrides.metadata,
      },
    }
  },
}

/**
 * Build parallel groups by grouping steps at the same dependency depth.
 */
function buildParallelGroups(
  steps: ExecutionStep[],
  dependencies: Record<string, string[]>,
): string[][] {
  const depths = new Map<string, number>()

  function getDepth(stepId: string): number {
    if (depths.has(stepId)) return depths.get(stepId)!
    const deps = dependencies[stepId]
    if (!deps || deps.length === 0) {
      depths.set(stepId, 0)
      return 0
    }
    const maxDepDepth = Math.max(...deps.map(d => getDepth(d)))
    const depth = maxDepDepth + 1
    depths.set(stepId, depth)
    return depth
  }

  for (const step of steps) {
    getDepth(step.id)
  }

  // Group steps by depth
  const groups = new Map<number, string[]>()
  for (const [stepId, depth] of depths) {
    if (!groups.has(depth)) groups.set(depth, [])
    groups.get(depth)!.push(stepId)
  }

  return Array.from(groups.values())
}
