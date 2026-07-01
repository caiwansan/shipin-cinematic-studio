// ════════════════════════════════════════════════════════════
// KH4-T004 — ExecutionGraph
// Manages tasks within a distribution plan.
// Supports sequential execution by default; parallel ready.
// ════════════════════════════════════════════════════════════

import { DistributionTask, DistributionResult } from './types'

export class ExecutionGraph {
  private tasks: Map<string, DistributionTask[]> = new Map()

  async build(planId: string, packageId: string, targets: string[]): Promise<DistributionTask[]> {
    const tasks: DistributionTask[] = targets.map(target => ({
      id: crypto.randomUUID(),
      planId,
      target,
      packageId,
      status: 'pending',
      artifactUrls: [],
      error: null,
      startedAt: null,
      completedAt: null,
    }))
    this.tasks.set(planId, tasks)
    return tasks
  }

  async markRunning(taskId: string): Promise<void> {
    const task = this.findTask(taskId)
    if (task) {
      task.status = 'running'
      task.startedAt = new Date().toISOString()
    }
  }

  async markSucceeded(taskId: string, artifactUrl?: string): Promise<void> {
    const task = this.findTask(taskId)
    if (task) {
      task.status = 'succeeded'
      task.completedAt = new Date().toISOString()
      if (artifactUrl) task.artifactUrls.push(artifactUrl)
    }
  }

  async markFailed(taskId: string, error: string): Promise<void> {
    const task = this.findTask(taskId)
    if (task) {
      task.status = 'failed'
      task.error = error
      task.completedAt = new Date().toISOString()
    }
  }

  async getTask(planId: string): Promise<DistributionTask[]> {
    return this.tasks.get(planId) || []
  }

  async getResult(planId: string): Promise<DistributionResult | null> {
    const tasks = this.tasks.get(planId)
    if (!tasks?.length) return null

    const succeeded = tasks.filter(t => t.status === 'succeeded')
    const failed = tasks.filter(t => t.status === 'failed')
    const start = tasks.reduce((min, t) => Math.min(min, t.startedAt ? new Date(t.startedAt).getTime() : Infinity), Infinity)
    const end = tasks.reduce((max, t) => Math.max(max, t.completedAt ? new Date(t.completedAt).getTime() : 0), 0)

    const status =
      failed.length === 0 ? 'succeeded'
      : succeeded.length > 0 ? 'partial'
      : 'failed'

    return {
      packageId: tasks[0].packageId,
      planId,
      targets: tasks.map(t => t.target),
      artifacts: succeeded
        .filter(t => t.artifactUrls.length > 0)
        .flatMap(t => t.artifactUrls.map(url => ({ target: t.target, url }))),
      duration: end - start,
      status,
      errors: failed.map(t => ({ target: t.target, error: t.error || 'Unknown error' })),
    }
  }

  private findTask(taskId: string): DistributionTask | undefined {
    for (const [, tasks] of this.tasks) {
      const found = tasks.find(t => t.id === taskId)
      if (found) return found
    }
    return undefined
  }
}
