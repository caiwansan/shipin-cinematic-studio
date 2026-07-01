// ════════════════════════════════════════════════════════════
// KH4-T001 — DistributionEngine
// Sole execution entry point.
// Takes Approved Package + publishTargets[] and executes.
// Does NOT approve, does NOT re-calculate targets.
// ════════════════════════════════════════════════════════════

import { DistributionPlanner } from './distribution-planner'
import { DistributionRegistry } from './distribution-registry'
import { ExecutionGraph } from './execution-graph'
import { DistributionResult } from './types'

export interface DistributionRequest {
  packageId: string
  publishTargets: string[]
  initiatedBy: string
}

export class DistributionEngine {
  private jobs: Map<string, { status: string; planId: string }> = new Map()

  constructor(
    private planner: DistributionPlanner,
    private registry: DistributionRegistry,
    private graph: ExecutionGraph,
  ) {}

  async start(request: DistributionRequest): Promise<{ jobId: string; planId: string; status: string }> {
    const plan = await this.planner.createPlan(request.packageId, request.publishTargets)
    await this.graph.build(plan.id, request.packageId, plan.targets)

    const jobId = crypto.randomUUID()
    this.jobs.set(jobId, { status: 'running', planId: plan.id })

    // Execute each target sequentially (parallel ready via future dependency graph)
    const tasks = await this.graph.getTask(plan.id)
    for (const task of tasks) {
      const adapter = this.registry.get(task.target)
      if (!adapter) continue

      await this.graph.markRunning(task.id)
      try {
        const result = await adapter.execute(request.packageId, plan.id)
        await this.graph.markSucceeded(task.id, result.artifactUrl)
      } catch (err: any) {
        await this.graph.markFailed(task.id, err.message)
      }
    }

    const result = await this.graph.getResult(plan.id)
    this.jobs.set(jobId, {
      status: result?.status === 'failed' ? 'failed' : 'completed',
      planId: plan.id,
    })

    return { jobId, planId: plan.id, status: 'completed' }
  }

  async getJob(jobId: string): Promise<{ status: string; planId: string } | null> {
    return this.jobs.get(jobId) || null
  }

  async listJobs(): Promise<{ jobId: string; status: string; planId: string }[]> {
    return Array.from(this.jobs.entries()).map(([jobId, job]) => ({
      jobId,
      status: job.status,
      planId: job.planId,
    }))
  }

  async getResult(planId: string): Promise<DistributionResult | null> {
    return this.graph.getResult(planId)
  }
}
