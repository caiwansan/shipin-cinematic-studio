// ============================================================
// Agent Scheduler — KMKI-PLAT-010
// 调度能力：sequential, parallel, priority, retry, timeout, cancel, resume, queue
// 集成 AgentQueue
// ============================================================

import type { AgentSchedulePlan, AgentScheduleStep, DispatchResult } from '../types'
import { agentDispatcher } from '../dispatcher/agent-dispatcher'
import { ExecutionError } from '@platform/errors/platform-errors'
import type { PlatformContext } from '@platform/context/platform-context'

interface ScheduledJob {
  id: string
  plan: AgentSchedulePlan
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  results: Map<string, DispatchResult>
  error?: string
  startedAt?: Date
  completedAt?: Date
}

class AgentScheduler {
  private jobs = new Map<string, ScheduledJob>()
  private queues = new Map<string, any[]>()  // agentCode -> queue items

  /**
   * Schedule a plan for execution.
   * Handles sequential, parallel, and hybrid execution with dependency resolution.
   */
  async schedule(
    plan: AgentSchedulePlan,
    platformCtx?: PlatformContext,
  ): Promise<ScheduledJob> {
    const { default: uuid } = await import("uuid")
    const jobId = plan.id || uuid()

    const job: ScheduledJob = {
      id: jobId,
      plan,
      status: 'pending',
      results: new Map(),
    }
    this.jobs.set(jobId, job)

    // Start execution asynchronously
    setImmediate(() => {
      this.executeJob(job, platformCtx)
    })

    return job
  }

  /**
   * Execute a scheduled job.
   */
  private async executeJob(
    job: ScheduledJob,
    platformCtx?: PlatformContext,
  ): Promise<void> {
    job.status = 'running'
    job.startedAt = new Date()

    try {
      const plan = job.plan
      const completedSteps = new Set<string>()
      const remaining = [...plan.steps]

      while (remaining.length > 0) {
        // Find steps whose dependencies are met
        const ready = remaining.filter(step => {
          if (!step.dependsOn || step.dependsOn.length === 0) return true
          return step.dependsOn.every(dep => completedSteps.has(dep))
        })

        if (ready.length === 0) {
          throw new ExecutionError('Circular dependency or unmet dependencies in schedule plan')
        }

        // Remove ready steps from remaining
        ready.forEach(s => {
          const idx = remaining.indexOf(s)
          if (idx >= 0) remaining.splice(idx, 1)
        })

        // Determine execution mode for this batch
        const mode = this.determineBatchMode(ready)
        let batchResults: DispatchResult[]

        if (mode === 'sequential') {
          batchResults = []
          for (const step of ready) {
            const result = await this.executeStep(step, plan, platformCtx)
            batchResults.push(result)
            if (result.status === 'failed' && plan.maxRetries && plan.maxRetries <= 0) {
              break
            }
          }
        } else {
          // Parallel
          batchResults = await Promise.all(
            ready.map(step => this.executeStep(step, plan, platformCtx)),
          )
        }

        // Process results
        for (let i = 0; i < ready.length; i++) {
          const step = ready[i]
          const result = batchResults[i]
          job.results.set(step.agentCode, result)
          completedSteps.add(step.agentCode)

          if (result.status === 'failed') {
            console.warn(`[AgentScheduler] Step ${step.agentCode} failed`)
            // Continue despite failure unless strict mode
          }
        }

        // Check overall timeout
        if (plan.timeout) {
          const elapsed = Date.now() - job.startedAt!.getTime()
          if (elapsed > plan.timeout) {
            job.status = 'failed'
            job.error = `Schedule timeout after ${elapsed}ms`
            job.completedAt = new Date()
            return
          }
        }
      }

      job.status = 'completed'
    } catch (err) {
      job.status = 'failed'
      job.error = err instanceof Error ? err.message : String(err)
    }

    job.completedAt = new Date()
  }

  /**
   * Execute a single step with retry logic.
   */
  private async executeStep(
    step: AgentScheduleStep,
    plan: AgentSchedulePlan,
    platformCtx?: PlatformContext,
  ): Promise<DispatchResult> {
    const maxAttempts = step.retry?.maxAttempts || plan.maxRetries || 1
    const backoffMs = step.retry?.backoffMs || 1000

    let lastError: string | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await agentDispatcher.dispatch({
          agentCode: step.agentCode,
          input: step.input,
        }, platformCtx)

        if (result.status === 'completed') {
          return result
        }

        lastError = result.error
        console.warn(`[AgentScheduler] Attempt ${attempt}/${maxAttempts} failed for ${step.agentCode}`)
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.warn(`[AgentScheduler] Attempt ${attempt}/${maxAttempts} errored for ${step.agentCode}: ${lastError}`)
      }

      if (attempt < maxAttempts) {
        await this.sleep(backoffMs * attempt)
      }
    }

    return {
      sessionId: '',
      agentCode: step.agentCode,
      status: 'failed',
      error: lastError || 'All retry attempts exhausted',
      startedAt: new Date(),
      completedAt: new Date(),
    }
  }

  /**
   * Determine the execution mode for a batch of steps.
   */
  private determineBatchMode(steps: AgentScheduleStep[]): 'sequential' | 'parallel' {
    if (steps.length <= 1) return 'sequential'
    // If all steps have the same mode, use it
    const modes = new Set(steps.map(s => s.mode))
    if (modes.size === 1) return steps[0].mode
    // Mixed modes: default to parallel
    return 'parallel'
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ─── Job Management ───

  /**
   * Cancel a running job.
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'running') return false
    job.status = 'cancelled'
    job.completedAt = new Date()
    return true
  }

  /**
   * Get job status.
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * List all jobs, optionally filtered.
   */
  listJobs(filter?: { status?: string }): ScheduledJob[] {
    let jobs = Array.from(this.jobs.values())
    if (filter?.status) {
      jobs = jobs.filter(j => j.status === filter.status)
    }
    return jobs.sort((a, b) => {
      const aTime = a.startedAt?.getTime() || 0
      const bTime = b.startedAt?.getTime() || 0
      return bTime - aTime
    })
  }

  // ─── Queue Management ───

  /**
   * Enqueue an agent task.
   */
  enqueue(agentCode: string, input: any, priority: number = 0): void {
    if (!this.queues.has(agentCode)) {
      this.queues.set(agentCode, [])
    }
    this.queues.get(agentCode)!.push({ input, priority, enqueuedAt: new Date() })
    // Sort by priority (higher = first)
    this.queues.get(agentCode)!.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Dequeue the next item for an agent.
   */
  dequeue(agentCode: string): any | undefined {
    return this.queues.get(agentCode)?.shift()
  }

  /**
   * Get queue length for an agent.
   */
  queueLength(agentCode: string): number {
    return this.queues.get(agentCode)?.length || 0
  }

  /**
   * Clear all data for testing.
   */
  clear(): void {
    this.jobs.clear()
    this.queues.clear()
  }
}

// Singleton
export const agentScheduler = new AgentScheduler()
