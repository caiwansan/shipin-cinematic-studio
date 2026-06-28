// ============================================================
// Replay Engine — Replay/DryRun/Simulation/Resume support
// KMKI-KERNEL-001: Replay readiness for platform IR
// All methods reuse the Engine core — no modification.
// ============================================================

import type { ExecutionPlan, ExecutionResult, ExecutionContext, LogicalPlan } from '../types.js'
import { executionEngine } from './execution-engine.js'
import { executionScheduler } from '../scheduler/execution-scheduler.js'
import { executionEventService } from '../events/execution-events.js'
import type { PlatformContext } from '@platform/context/platform-context'
import { RuntimeError } from '@platform/errors/platform-errors'

export interface ReplayOptions {
  signal?: AbortSignal
  logProgress?: boolean
}

export interface SimulationStepResult {
  stepId: string
  status: 'completed' | 'failed' | 'skipped' | 'simulated'
  simulatedOutput?: any
  durationMs: number
}

export interface SimulationResult {
  planId: string
  capabilityId: string
  status: 'completed' | 'failed'
  stepResults: SimulationStepResult[]
  totalDurationMs: number
  simulated: boolean
}

/**
 * Replay Engine — provides replay, dryRun, simulate, resume capabilities.
 * ALL methods are stateless; state is managed through plan + context.
 */
export const replayEngine = {
  /**
   * Replay: execute the same plan again, exactly as before.
   * Uses the identical ExecutionPlan (same step IDs, same parameters).
   * Useful for debugging, verification, and audit trails.
   */
  async replay(
    plan: ExecutionPlan,
    ctx: PlatformContext,
    options?: ReplayOptions,
  ): Promise<ExecutionResult> {
    if (options?.logProgress) {
      console.log(`[Replay] Replaying plan ${plan.id} (${plan.steps.length} steps)`)
    }

    // Validate plan version compatibility
    this._validateVersionCompatibility(plan)

    // Execute with exact same plan
    const result = await executionEngine.execute(plan, { signal: options?.signal }, ctx)

    if (options?.logProgress) {
      console.log(`[Replay] Completed: ${result.status} (${result.durationMs}ms)`)
    }

    return result
  },

  /**
   * Dry Run: simulate execution without calling any provider.
   * All step plugins execute but MUST return mock/simulated results.
   * Actual provider/tool calls are blocked at the Engine level.
   */
  async dryRun(
    plan: ExecutionPlan,
    ctx: PlatformContext,
    options?: ReplayOptions,
  ): Promise<ExecutionResult> {
    if (options?.logProgress) {
      console.log(`[DryRun] Simulating plan ${plan.id} (no provider calls)`)
    }

    // Mark plan for dry run via metadata
    const dryRunPlan: ExecutionPlan = {
      ...plan,
      metadata: {
        ...plan.metadata,
        _dryRun: true,
        _dryRunStartedAt: new Date().toISOString(),
      },
    }

    // Execute with dry run flag (step plugins should check metadata._dryRun)
    const result = await executionEngine.execute(dryRunPlan, { signal: options?.signal }, ctx)

    if (options?.logProgress) {
      console.log(`[DryRun] Completed: ${result.status} (${result.durationMs}ms)`)
    }

    return result
  },

  /**
   * Simulate: full simulation with generated results.
   * Does NOT call the engine; generates plausible results based on plan structure.
   * Useful for cost estimation, timing analysis, and what-if scenarios.
   */
  async simulate(
    plan: ExecutionPlan,
    _ctx: PlatformContext,
    options?: ReplayOptions,
  ): Promise<SimulationResult> {
    if (options?.logProgress) {
      console.log(`[Simulate] Simulating plan ${plan.id} with generated results`)
    }

    const stepResults: SimulationStepResult[] = []
    const startTime = Date.now()

    // Topological sort
    const sorted = executionScheduler._topologicalSort(plan.steps, plan.dependencies || {})
    const stepMap = new Map(plan.steps.map(s => [s.id, s]))
    const completedOutputs = new Map<string, any>()

    for (const step of sorted) {
      const stepDef = stepMap.get(step.id)!
      const deps = step.dependencies || []

      // Check if all dependencies completed
      const failedDep = deps.find(d => {
        const r = stepResults.find(sr => sr.stepId === d)
        return r && r.status === 'failed'
      })

      if (failedDep) {
        stepResults.push({
          stepId: step.id,
          status: 'skipped',
          durationMs: 0,
        })
        continue
      }

      // Generate plausible simulated output
      const simulatedOutput = this._generateSimulatedOutput(stepDef, completedOutputs)

      stepResults.push({
        stepId: step.id,
        status: 'simulated',
        simulatedOutput,
        durationMs: step.timeout || Math.round(Math.random() * 500 + 100),
      })

      completedOutputs.set(step.id, simulatedOutput)
    }

    const totalDurationMs = Date.now() - startTime
    const hasFailures = stepResults.some(r => r.status === 'failed')

    return {
      planId: plan.id,
      capabilityId: plan.capabilityId,
      status: hasFailures ? 'failed' : 'completed',
      stepResults,
      totalDurationMs,
      simulated: true,
    }
  },

  /**
   * Resume: continue execution from a specific step.
   * Skips all steps before fromStepId (assumes they completed successfully).
   */
  async resume(
    plan: ExecutionPlan,
    ctx: PlatformContext,
    fromStepId: string,
    completedOutputs?: Map<string, any>,
    options?: ReplayOptions,
  ): Promise<ExecutionResult> {
    if (options?.logProgress) {
      console.log(`[Resume] Resuming plan ${plan.id} from step ${fromStepId}`)
    }

    // Validate fromStepId exists
    const step = plan.steps.find(s => s.id === fromStepId)
    if (!step) {
      throw new RuntimeError(`Cannot resume: step "${fromStepId}" not found in plan ${plan.id}`)
    }

    // Create resume plan — mark completed steps as skipped
    const resumeSteps = plan.steps.map(s => {
      const stepIndex = plan.steps.indexOf(s)
      const fromIndex = plan.steps.indexOf(step)

      if (stepIndex < fromIndex) {
        // Already completed — mark with metadata
        return {
          ...s,
          metadata: {
            ...s.metadata,
            _resumed: true,
            _resumedStatus: 'completed',
          },
        }
      }
      return s
    })

    const resumePlan: ExecutionPlan = {
      ...plan,
      steps: resumeSteps,
      metadata: {
        ...plan.metadata,
        _resumed: true,
        _resumeFromStepId: fromStepId,
        _resumedAt: new Date().toISOString(),
      },
    }

    // Execute from the given step
    const result = await executionEngine.execute(resumePlan, { signal: options?.signal }, ctx)

    if (options?.logProgress) {
      console.log(`[Resume] Completed: ${result.status} (${result.durationMs}ms)`)
    }

    return result
  },

  /**
   * Validate that the plan's versions are compatible with the current runtime.
   */
  _validateVersionCompatibility(plan: ExecutionPlan): void {
    const { EXECUTION_SCHEMA_VERSION } = require('../types.js')

    if (plan.schemaVersion) {
      const planMajor = parseInt(plan.schemaVersion.split('.')[0], 10)
      const runtimeMajor = parseInt(EXECUTION_SCHEMA_VERSION.split('.')[0], 10)

      if (planMajor !== runtimeMajor) {
        throw new RuntimeError(
          `Version incompatibility: plan schema v${plan.schemaVersion}, runtime v${EXECUTION_SCHEMA_VERSION}`,
          { planId: plan.id, planVersion: plan.schemaVersion, runtimeVersion: EXECUTION_SCHEMA_VERSION },
        )
      }
    }
  },

  /**
   * Generate simulated output for a step based on its type.
   */
  _generateSimulatedOutput(step: import('../types.js').ExecutionStep, _completedOutputs: Map<string, any>): any {
    const category = step.category
    switch (category) {
      case 'Acquire':
        return { simulated: true, data: `[simulated] ${step.name} result`, size: 1024 }
      case 'Transform':
        return { simulated: true, transformed: true, content: `[simulated] ${step.name} output` }
      case 'Reason':
        return { simulated: true, choices: ['option_a', 'option_b'], confidence: 0.85 }
      case 'Execute':
        return { simulated: true, result: 'ok', exitCode: 0 }
      case 'Persist':
        return { simulated: true, stored: true, id: `sim-${step.id}` }
      case 'Notify':
        return { simulated: true, emitted: true, eventCount: 1 }
      case 'Wait':
        return { simulated: true, approved: true, timestamp: new Date().toISOString() }
      case 'Control':
        return { simulated: true, valid: true, score: 0.95 }
      default:
        return { simulated: true }
    }
  },
}
