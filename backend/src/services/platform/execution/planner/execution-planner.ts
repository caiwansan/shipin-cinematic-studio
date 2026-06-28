// ============================================================
// Execution Planner — inputs Capability Contract, outputs LogicalPlan
// Planner ONLY generates the logical plan (step order + dependencies).
// It does NOT set timeouts, budgets, executor types, or strategy params.
// ============================================================

import type { CapabilityContractInput, ExecutionPlan, ExecutionStep, ExecutionDecision, LogicalPlan, LogicalStep, RetryPolicy, RollbackPolicy } from '../types.js'
import { StepType, STEP_CATEGORY, EXECUTION_SCHEMA_VERSION, EXECUTION_PLANNER_VERSION, EXECUTION_CONTRACT_VERSION, ExecutorType } from '../types.js'
import { PlatformContext, createContext } from '@platform/context/platform-context'
import { ContractError } from '@platform/errors/platform-errors'

let _stepCounter = 0

/**
 * Generate a deterministic step ID.
 * Uses monotonically incrementing counter + step type prefix.
 * NO Math.random(), NO Date.now() — ensures deterministic output.
 */
function stepId(type: StepType, index: number): string {
  _stepCounter++
  return `step-${type.toLowerCase()}-${index}-${_stepCounter}`
}

// ─── Step Template Definitions ───
// Defines the logical structure of default steps by category.
// These are pure logical templates — no provider-specific params.

interface StepTemplate {
  name: string
  category: import('../types.js').StepCategory
  type: StepType
  dependencies: number[] // indices of dependent template steps
}

const DEFAULT_STEP_TEMPLATES: StepTemplate[] = [
  // Phase 0: Acquire
  { name: 'Load Asset', category: 'Acquire', type: StepType.LOAD_ASSET, dependencies: [] },
  { name: 'Load Semantic', category: 'Acquire', type: StepType.LOAD_SEMANTIC, dependencies: [0] },

  // Phase 1: Transform
  { name: 'Build Context', category: 'Transform', type: StepType.BUILD_CONTEXT, dependencies: [1] },

  // Phase 2: Reason
  { name: 'Reason', category: 'Reason', type: StepType.REASON, dependencies: [2] },

  // Phase 3: Control
  { name: 'Validate Output', category: 'Control', type: StepType.VALIDATE_OUTPUT, dependencies: [3] },

  // Phase 4: Persist
  { name: 'Store Asset', category: 'Persist', type: StepType.STORE_ASSET, dependencies: [4] },

  // Phase 5: Notify
  { name: 'Emit Completion', category: 'Notify', type: StepType.EMIT_EVENT, dependencies: [5] },
]

/**
 * Build logical steps from templates.
 */
function buildLogicalSteps(contract: CapabilityContractInput): LogicalStep[] {
  const templates = contract.steps && contract.steps.length > 0
    ? contract.steps.map(s => ({
        name: s.name,
        category: STEP_CATEGORY[s.type] || 'Execute',
        type: s.type,
      }))
    : DEFAULT_STEP_TEMPLATES

  const steps: LogicalStep[] = []
  let idx = 0

  if (contract.steps && contract.steps.length > 0) {
    // Use explicit steps from contract (logical only)
    for (const s of contract.steps) {
      steps.push({
        id: stepId(s.type, idx),
        name: s.name,
        phase: idx,
        category: STEP_CATEGORY[s.type] || 'Execute',
        type: s.type,
        dependencies: s.dependencies || [],
      })
      idx++
    }
  } else {
    // Build default steps from templates
    for (const tpl of DEFAULT_STEP_TEMPLATES) {
      const sid = stepId(tpl.type, idx)
      const depIds = tpl.dependencies.map(d => steps[d].id)
      steps.push({
        id: sid,
        name: `${tpl.name} (${contract.displayName})`,
        phase: idx,
        category: tpl.category,
        type: tpl.type,
        dependencies: depIds,
      })
      idx++
    }
  }

  return steps
}

/**
 * Build parallel groups by grouping steps at the same dependency depth.
 */
function buildParallelGroups(
  steps: LogicalStep[],
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

  const groups = new Map<number, string[]>()
  for (const [stepId, depth] of depths) {
    if (!groups.has(depth)) groups.set(depth, [])
    groups.get(depth)!.push(stepId)
  }

  return Array.from(groups.values())
}

/**
 * Planner — creates a LogicalPlan from a Capability Contract.
 * Output is provider-agnostic. Timeouts, budgets, executor types are compiler concerns.
 */
export const executionPlanner = {
  /**
   * Create a LogicalPlan from a CapabilityContract.
   */
  async plan(
    contract: CapabilityContractInput,
    ctx?: PlatformContext,
  ): Promise<LogicalPlan> {
    const context = createContext(ctx)

    if (!contract.id || !contract.name) {
      throw new ContractError('Invalid capability contract: missing id or name', { contract })
    }

    const steps = buildLogicalSteps(contract)

    // Build dependency map
    const dependencies: Record<string, string[]> = {}
    for (const step of steps) {
      if (step.dependencies && step.dependencies.length > 0) {
        dependencies[step.id] = step.dependencies
      }
    }

    // Build parallel groups
    const parallelGroups = buildParallelGroups(steps, dependencies)

    // Planner decisions (explainability)
    const decisions: ExecutionDecision[] = [
      {
        id: `decision-planner-${contract.id}`,
        stepId: '__plan__',
        reason: 'Plan structure derived from capability contract',
        decision: 'Default step pipeline',
        alternatives: ['Custom step pipeline'],
        rejectedAlternatives: contract.steps && contract.steps.length > 0 ? [] : ['Custom step pipeline'],
        chosenStrategy: contract.steps && contract.steps.length > 0 ? 'Custom steps from contract' : 'Default template steps',
        qualityTradeoff: 'Steps follow category-based pipeline (Acquire → Transform → Reason → Control → Persist → Notify)',
        costTradeoff: 'Default pipeline uses minimal required steps',
      },
    ]

    const now = new Date()

    const logicalPlan: LogicalPlan = {
      id: `plan-${contract.id}-${now.getTime().toString(36)}`,
      capabilityId: contract.id,
      version: contract.version,
      plannerVersion: EXECUTION_PLANNER_VERSION,
      contractVersion: contract.version || EXECUTION_CONTRACT_VERSION,
      steps,
      dependencies,
      parallelGroups,
      decisions,
      metadata: {
        contractName: contract.name,
        contractDisplayName: contract.displayName,
        category: contract.category,
        plannedAt: now.toISOString(),
      },
      createdAt: now,
    }

    return logicalPlan
  },

  /**
   * Convert a LogicalPlan into a partial ExecutionPlan.
   * Used by the Compiler to produce the final ExecutablePlan.
   * NOTE: This does NOT set timeouts/budgets — those are compiler concerns.
   */
  logicalPlanToPartialPlan(
    logicalPlan: LogicalPlan,
    retryPolicy: RetryPolicy = { maxAttempts: 3, backoffMs: 1000 },
    rollbackPolicy: RollbackPolicy = { enabled: false },
  ): Partial<ExecutionPlan> {
    return {
      plannerVersion: logicalPlan.plannerVersion,
      contractVersion: logicalPlan.contractVersion,
      dependencies: logicalPlan.dependencies,
      parallelGroups: logicalPlan.parallelGroups,
      decisions: logicalPlan.decisions,
      retryPolicy,
      rollbackPolicy,
    }
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
      metadata: {
        ...existingPlan.metadata,
        originalPlanId: existingPlan.id,
        replannedAt: new Date().toISOString(),
        ...overrides.metadata,
      },
    }
  },
}
