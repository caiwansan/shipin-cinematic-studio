// ============================================================
// Graph Validator — validates ExecutionPlan is a valid DAG
// KMKI-KERNEL-001: DAG validation for platform IR
// Validates: cycles, dead steps, unreachable steps, parallel safety, dependency integrity
// ============================================================

import type { ExecutionPlan, ExecutionStep } from '../types.js'
import type { ValidationResult } from './execution-validator.js'

/**
 * Graph Validator — validates the DAG structure of an ExecutionPlan.
 */
export const graphValidator = {
  /**
   * Full DAG validation.
   */
  validate(plan: ExecutionPlan): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    const stepIds = new Set(plan.steps.map(s => s.id))
    const stepMap = new Map(plan.steps.map(s => [s.id, s]))

    this._validateDependencyIntegrity(plan, stepIds, errors, warnings)
    this._validateCycleDetection(plan, stepIds, errors, warnings)
    this._validateDeadSteps(plan, stepIds, stepMap, errors, warnings)
    this._validateUnreachableSteps(plan, stepIds, stepMap, errors, warnings)
    this._validateParallelSafety(plan, errors, warnings)
    this._validateStepIds(plan, errors, warnings)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        stepCount: plan.steps.length,
        dependencyCount: Object.keys(plan.dependencies || {}).length,
        parallelGroups: plan.parallelGroups?.length || 0,
      },
    }
  },

  /**
   * 1. Dependency Integrity — all dependencies reference valid steps.
   */
  _validateDependencyIntegrity(
    plan: ExecutionPlan,
    stepIds: Set<string>,
    errors: string[],
    _warnings: string[],
  ): void {
    for (const step of plan.steps) {
      if (!step.dependencies || step.dependencies.length === 0) continue

      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          errors.push(`Step "${step.id}" depends on unknown step "${depId}"`)
        }
        if (depId === step.id) {
          errors.push(`Step "${step.id}" has a self-referencing dependency`)
        }
      }
    }

    // Check dependencies map for consistency
    if (plan.dependencies) {
      for (const [stepId, deps] of Object.entries(plan.dependencies)) {
        if (!stepIds.has(stepId)) {
          errors.push(`Dependencies map references unknown step "${stepId}"`)
        }
        for (const depId of deps) {
          if (!stepIds.has(depId)) {
            errors.push(`Dependencies map: step "${stepId}" depends on unknown step "${depId}"`)
          }
        }
      }
    }
  },

  /**
   * 2. Cycle Detection — DFS with white/grey/black set.
   */
  _validateCycleDetection(
    plan: ExecutionPlan,
    _stepIds: Set<string>,
    errors: string[],
    _warnings: string[],
  ): void {
    const WHITE = 0, GREY = 1, BLACK = 2
    const colors = new Map<string, number>()
    const stepMap = new Map(plan.steps.map(s => [s.id, s]))

    for (const step of plan.steps) {
      colors.set(step.id, WHITE)
    }

    function hasCycle(stepId: string, path: string[]): boolean {
      const color = colors.get(stepId)
      if (color === GREY) {
        // Found a cycle — report the path
        const cycleStart = path.indexOf(stepId)
        const cycle = [...path.slice(cycleStart), stepId]
        errors.push(`Dependency cycle detected: ${cycle.join(' → ')}`)
        return true
      }
      if (color === BLACK) return false

      colors.set(stepId, GREY)
      path.push(stepId)

      const step = stepMap.get(stepId)
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId, path)) return true
        }
      }

      path.pop()
      colors.set(stepId, BLACK)
      return false
    }

    for (const step of plan.steps) {
      if (colors.get(step.id) === WHITE) {
        hasCycle(step.id, [])
      }
    }
  },

  /**
   * 3. Dead Step Detection — steps that are dependencies but don't exist.
   */
  _validateDeadSteps(
    plan: ExecutionPlan,
    stepIds: Set<string>,
    stepMap: Map<string, ExecutionStep>,
    errors: string[],
    _warnings: string[],
  ): void {
    // A "dead step" is referenced in dependencies but has no step definition
    // This is already caught by dependency integrity check above.

    // Additional: steps that have no dependencies and no dependents (isolated)
    const hasDependents = new Set<string>()
    for (const step of plan.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          hasDependents.add(depId)
        }
      }
    }

    for (const step of plan.steps) {
      const hasDeps = step.dependencies && step.dependencies.length > 0
      const isDepended = hasDependents.has(step.id)

      if (!hasDeps && !isDepended && plan.steps.length > 1) {
        errors.push(`Step "${step.id}" is isolated: no dependencies and no dependents`)
      }
    }
  },

  /**
   * 4. Unreachable Step Detection — steps that can't be reached from entry points.
   */
  _validateUnreachableSteps(
    plan: ExecutionPlan,
    stepIds: Set<string>,
    stepMap: Map<string, ExecutionStep>,
    _errors: string[],
    warnings: string[],
  ): void {
    // Entry points = steps with no dependencies
    const entryPoints = plan.steps.filter(s => !s.dependencies || s.dependencies.length === 0)
    const reachable = new Set<string>()

    // BFS from entry points
    const queue = [...entryPoints.map(s => s.id)]
    while (queue.length > 0) {
      const current = queue.shift()!
      if (reachable.has(current)) continue
      reachable.add(current)

      // Find all steps that depend on current
      for (const step of plan.steps) {
        if (step.dependencies?.includes(current)) {
          queue.push(step.id)
        }
      }
    }

    // Also check reverse dependencies
    const reverseReachable = new Set<string>()
    const exitPoints = plan.steps.filter(s => {
      // Steps that no other step depends on
      return !plan.steps.some(other =>
        other.dependencies?.includes(s.id),
      )
    })

    const reverseQueue = [...exitPoints.map(s => s.id)]
    while (reverseQueue.length > 0) {
      const current = reverseQueue.shift()!
      if (reverseReachable.has(current)) continue
      reverseReachable.add(current)

      const step = stepMap.get(current)
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          reverseQueue.push(depId)
        }
      }
    }

    const unreachable = [...stepIds].filter(id => !reachable.has(id) || !reverseReachable.has(id))
    if (unreachable.length > 0) {
      warnings.push(`Steps potentially unreachable: ${unreachable.join(', ')}`)
    }
  },

  /**
   * 5. Parallel Safety Check — ensures steps in same parallel group don't have cross-dependencies.
   */
  _validateParallelSafety(
    plan: ExecutionPlan,
    errors: string[],
    _warnings: string[],
  ): void {
    if (!plan.parallelGroups) return

    for (const group of plan.parallelGroups) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const stepA = plan.steps.find(s => s.id === group[i])
          const stepB = plan.steps.find(s => s.id === group[j])

          if (!stepA || !stepB) continue

          // Check if A depends on B
          if (stepA.dependencies?.includes(stepB.id)) {
            errors.push(`Parallel safety violation: step "${stepA.id}" depends on "${stepB.id}" but both are in same parallel group`)
          }

          // Check if B depends on A
          if (stepB.dependencies?.includes(stepA.id)) {
            errors.push(`Parallel safety violation: step "${stepB.id}" depends on "${stepA.id}" but both are in same parallel group`)
          }
        }
      }
    }
  },

  /**
   * 6. Step ID Uniqueness — ensures all step IDs are unique.
   */
  _validateStepIds(
    plan: ExecutionPlan,
    errors: string[],
    _warnings: string[],
  ): void {
    const ids = new Set<string>()
    for (const step of plan.steps) {
      if (ids.has(step.id)) {
        errors.push(`Duplicate step id: "${step.id}"`)
      }
      ids.add(step.id)
    }
  },
}
