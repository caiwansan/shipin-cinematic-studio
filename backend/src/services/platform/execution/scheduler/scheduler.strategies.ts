// ============================================================
// Scheduler Strategies — pluggable scheduling strategies
// ============================================================

import type { ExecutionStep, ExecutionPlan } from '../types.js'
import type { ScheduledStep } from './execution-scheduler.js'

/**
 * Scheduler Strategy interface.
 * Determines how steps are grouped and ordered.
 */
export interface SchedulerStrategy {
  name: string

  /**
   * Group sorted steps into parallel execution groups.
   * Steps in the same group can be executed in parallel.
   */
  group(sorted: ExecutionStep[], plan: ExecutionPlan): Promise<ScheduledStep[]>

  /**
   * Maximum number of steps allowed to run in parallel.
   */
  maxParallelism?: number
}

/**
 * Default strategy: steps at the same dependency depth run in parallel.
 */
export const defaultSchedulerStrategy: SchedulerStrategy = {
  name: 'default',

  async group(sorted: ExecutionStep[], plan: ExecutionPlan): Promise<ScheduledStep[]> {
    // Calculate dependency depth for each step
    const depths = new Map<string, number>()

    function getDepth(step: ExecutionStep): number {
      if (depths.has(step.id)) return depths.get(step.id)!
      const deps = step.dependencies || []
      if (deps.length === 0) {
        depths.set(step.id, 0)
        return 0
      }
      const maxDepDepth = Math.max(
        ...deps.map(d => {
          const depStep = sorted.find(s => s.id === d)
          return depStep ? getDepth(depStep) : 0
        }),
      )
      const depth = maxDepDepth + 1
      depths.set(step.id, depth)
      return depth
    }

    for (const step of sorted) {
      getDepth(step)
    }

    return sorted.map(step => ({
      step,
      order: sorted.indexOf(step),
      group: depths.get(step.id) || 0,
      dependsOn: step.dependencies || [],
    }))
  },
}

/**
 * Sequential strategy: no parallelism, one step at a time.
 */
export const sequentialSchedulerStrategy: SchedulerStrategy = {
  name: 'sequential',

  async group(sorted: ExecutionStep[], _plan: ExecutionPlan): Promise<ScheduledStep[]> {
    return sorted.map((step, index) => ({
      step,
      order: index,
      group: index, // each step gets its own group
      dependsOn: step.dependencies || [],
    }))
  },
}

/**
 * Greedy strategy: maximize parallelism within resource limits.
 */
export const greedySchedulerStrategy: SchedulerStrategy = {
  name: 'greedy',
  maxParallelism: 10,

  async group(sorted: ExecutionStep[], _plan: ExecutionPlan): Promise<ScheduledStep[]> {
    // Resolve all ready steps at each iteration
    const scheduled: ScheduledStep[] = []
    const remaining = new Map(sorted.map(s => [s.id, s]))
    const completed = new Set<string>()

    let groupIndex = 0
    let orderIndex = 0

    while (remaining.size > 0) {
      const ready: ExecutionStep[] = []

      for (const [id, step] of remaining) {
        const deps = step.dependencies || []
        const allDepsCompleted = deps.every(d => completed.has(d))
        if (allDepsCompleted) {
          ready.push(step)
        }
      }

      // Apply parallelism limit
      const batch = this.maxParallelism
        ? ready.slice(0, this.maxParallelism)
        : ready

      for (const step of batch) {
        scheduled.push({
          step,
          order: orderIndex++,
          group: groupIndex,
          dependsOn: step.dependencies || [],
        })
        remaining.delete(step.id)
        completed.add(step.id)
      }

      groupIndex++
    }

    return scheduled
  },
}
