// ============================================================
// Task Scheduler — Task scheduling with priority, dependencies, retry
// ============================================================

import { taskRepository } from '../repositories/task.repository.js'
import type { TaskData } from '../types.js'

export class TaskScheduler {
  private running = false
  private pollInterval: number // ms
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor(pollInterval = 10000) {
    this.pollInterval = pollInterval
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.running) return
    this.running = true
    this.pollTimer = setInterval(() => this.scheduleCycle(), this.pollInterval)
    console.log(`[TaskScheduler] Started (poll every ${this.pollInterval}ms)`)
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.running = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    console.log('[TaskScheduler] Stopped')
  }

  /**
   * Main scheduling cycle: find ready tasks and mark them executable
   */
  private async scheduleCycle(): Promise<void> {
    try {
      // Find tasks that are pending but whose dependencies are met
      await this.resolveDependencies()

      // Mark ready tasks that can now be executed
      const executable = await taskRepository.listExecutable(20)
      if (executable.length > 0) {
        console.log(`[TaskScheduler] ${executable.length} tasks ready for execution`)
      }
    } catch (err: any) {
      console.error('[TaskScheduler] Cycle error:', err.message)
    }
  }

  /**
   * Check pending tasks and mark them as 'ready' if their dependencies are satisfied
   */
  private async resolveDependencies(): Promise<void> {
    const pending = await taskRepository.list({ status: 'pending' })
    
    for (const task of pending.items) {
      if (!task.dependencies) {
        // No dependencies → immediately ready
        await taskRepository.update(task.id!, { status: 'ready' })
        continue
      }

      try {
        const depIds: string[] = JSON.parse(task.dependencies)
        if (!depIds.length) {
          await taskRepository.update(task.id!, { status: 'ready' })
          continue
        }

        // Check each dependency's status
        let allCompleted = true
        for (const depId of depIds) {
          const dep = await taskRepository.findById(depId)
          if (!dep || dep.status !== 'completed') {
            allCompleted = false
            break
          }
        }

        if (allCompleted) {
          await taskRepository.update(task.id!, { status: 'ready' })
        }
      } catch {
        // If we can't parse dependencies, treat as ready
        await taskRepository.update(task.id!, { status: 'ready' })
      }
    }
  }

  /**
   * Manually mark a task as ready (after dependency is completed)
   */
  async markReady(taskId: string): Promise<void> {
    const task = await taskRepository.findById(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    await taskRepository.update(taskId, { status: 'ready' })
  }

  /**
   * Handle a retry for a failed task
   */
  async handleRetry(taskId: string): Promise<boolean> {
    const task = await taskRepository.findById(taskId)
    if (!task) return false

    const newRetryCount = (task.retryCount || 0) + 1
    if (newRetryCount >= (task.maxRetries || 3)) {
      // Max retries reached, mark as failed permanently
      await taskRepository.update(taskId, { status: 'failed', retryCount: newRetryCount })
      return false
    }

    // Reset to ready for retry
    await taskRepository.update(taskId, {
      status: 'ready',
      retryCount: newRetryCount,
    })
    return true
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; pollInterval: number } {
    return { running: this.running, pollInterval: this.pollInterval }
  }
}

export const taskScheduler = new TaskScheduler()
