// ============================================================
// Execution Scheduler — DAG dependency scheduling
// Sequential/Parallel, Retry, Timeout, and Cancellation support.
// ============================================================

import type { ExecutionPlan, ExecutionStep, ExecutionContext, StepStatus } from '../types.js'
import { StepType } from '../types.js'
import type { PlatformContext } from '@platform/context/platform-context'
import { ExecutionError, RuntimeError } from '@platform/errors/platform-errors'
import type { SchedulerStrategy } from './scheduler.strategies.js'
import { defaultSchedulerStrategy } from './scheduler.strategies.js'

export interface ScheduledStep {
  step: ExecutionStep
  order: number         // execution order (topological)
  group: number         // parallel group (steps with same group can run in parallel)
  dependsOn: string[]   // resolved dependency step IDs
}

export interface ScheduleResult {
  schedule: ScheduledStep[]
  totalGroups: number
  maxParallelism: number
  criticalPath: string[]  // step IDs on critical path
}

export const executionScheduler = {
  /**
   * Schedule an execution plan into ordered groups.
   */
  async schedule(
    plan: ExecutionPlan,
    strategy?: SchedulerStrategy,
    _signal?: AbortSignal,
    _ctx?: PlatformContext,
  ): Promise<ScheduleResult> {
    const activeStrategy = strategy || defaultSchedulerStrategy

    // Topological sort
    const sorted = this._topologicalSort(plan.steps, plan.dependencies || {})

    // Assign groups
    const grouped = await activeStrategy.group(sorted, plan)

    // Calculate critical path
    const criticalPath = this._findCriticalPath(sorted, plan.dependencies || {})

    return {
      schedule: grouped,
      totalGroups: Math.max(...grouped.map(s => s.group)) + 1,
      maxParallelism: this._getMaxParallelism(grouped),
      criticalPath,
    }
  },

  /**
   * Create initial execution context for a scheduled plan.
   */
  createExecutionContext(
    plan: ExecutionPlan,
    schedule: ScheduleResult,
  ): ExecutionContext {
    const stepStates = new Map<string, StepStatus>()

    for (const step of plan.steps) {
      stepStates.set(step.id, {
        stepId: step.id,
        state: 'pending',
        retryCount: 0,
      })
    }

    return {
      planId: plan.id,
      capabilityId: plan.capabilityId,
      context: plan.context || {},
      state: 'initialized',
      stepStates,
      intermediateResults: new Map(),
      stepOrder: schedule.schedule.map(s => s.step.id),
      parallelGroups: this._buildGroupMap(schedule),
      abortController: new AbortController(),
      errors: [],
    }
  },

  /**
   * Topological sort of steps by their dependencies.
   */
  _topologicalSort(
    steps: ExecutionStep[],
    dependencies: Record<string, string[]>,
  ): ExecutionStep[] {
    const visited = new Set<string>()
    const sorted: ExecutionStep[] = []
    const stepMap = new Map(steps.map(s => [s.id, s]))

    function visit(stepId: string) {
      if (visited.has(stepId)) return
      visited.add(stepId)

      const deps = dependencies[stepId] || []
      for (const depId of deps) {
        visit(depId)
      }

      const step = stepMap.get(stepId)
      if (step) sorted.push(step)
    }

    for (const step of steps) {
      visit(step.id)
    }

    return sorted
  },

  /**
   * Find critical path (longest dependency chain).
   */
  _findCriticalPath(
    sorted: ExecutionStep[],
    dependencies: Record<string, string[]>,
  ): string[] {
    const distances = new Map<string, number>()
    const predecessors = new Map<string, string | null>()

    for (const step of sorted) {
      distances.set(step.id, 0)
      predecessors.set(step.id, null)
    }

    for (const step of sorted) {
      const deps = dependencies[step.id] || []
      for (const depId of deps) {
        const depDist = distances.get(depId) || 0
        const stepDist = distances.get(step.id) || 0
        if (depDist + 1 > stepDist) {
          distances.set(step.id, depDist + 1)
          predecessors.set(step.id, depId)
        }
      }
    }

    // Find step with max distance
    let maxDistStep = sorted[0]?.id || ''
    let maxDist = 0
    for (const [stepId, dist] of distances) {
      if (dist > maxDist) {
        maxDist = dist
        maxDistStep = stepId
      }
    }

    // Trace back
    const path: string[] = []
    let current: string | null = maxDistStep
    while (current) {
      path.unshift(current)
      current = predecessors.get(current) || null
    }

    return path
  },

  /**
   * Build a map of group number → step IDs.
   */
  _buildGroupMap(schedule: ScheduleResult): string[][] {
    const groups = new Map<number, string[]>()
    for (const s of schedule.schedule) {
      if (!groups.has(s.group)) groups.set(s.group, [])
      groups.get(s.group)!.push(s.step.id)
    }
    return Array.from(groups.values())
  },

  /**
   * Calculate maximum parallelism across all groups.
   */
  _getMaxParallelism(schedule: ScheduledStep[]): number {
    const groupCounts = new Map<number, number>()
    for (const s of schedule) {
      groupCounts.set(s.group, (groupCounts.get(s.group) || 0) + 1)
    }
    return Math.max(...groupCounts.values(), 1)
  },
}
