// ============================================================
// Execution Manager — Concurrency control, timeout, retry management
// ============================================================

import { executor } from './executor.js'
import { taskRepository } from '../repositories/task.repository.js'
import { taskScheduler } from '../engine/task-scheduler.js'

export interface ExecutionManagerConfig {
  maxConcurrent: number
  retryDelayMs: number
}

export class ExecutionManager {
  private running = false
  private activeCount = 0
  private config: ExecutionManagerConfig

  constructor(config?: Partial<ExecutionManagerConfig>) {
    this.config = {
      maxConcurrent: config?.maxConcurrent ?? 5,
      retryDelayMs: config?.retryDelayMs ?? 30000,
    }
  }

  /**
   * Start the execution manager
   */
  start(): void {
    if (this.running) return
    this.running = true
    console.log(`[ExecutionManager] Started (max ${this.config.maxConcurrent} concurrent)`)
  }

  /**
   * Stop the execution manager
   */
  stop(): void {
    this.running = false
    console.log('[ExecutionManager] Stopped')
  }

  /**
   * Poll and execute ready tasks
   * Called periodically by task scheduler or external trigger
   */
  async pollAndExecute(): Promise<void> {
    if (!this.running) return
    if (this.activeCount >= this.config.maxConcurrent) {
      console.log(`[ExecutionManager] Max concurrent reached (${this.activeCount})`)
      return
    }

    try {
      const available = this.config.maxConcurrent - this.activeCount
      const tasks = await taskRepository.listExecutable(available)

      if (tasks.length === 0) return

      this.activeCount += tasks.length
      console.log(`[ExecutionManager] Executing ${tasks.length} tasks (active: ${this.activeCount})`)

      // Execute batch asynchronously
      this.executeBatchAsync(tasks)
    } catch (err: any) {
      console.error('[ExecutionManager] Poll error:', err.message)
    }
  }

  /**
   * Execute a batch of tasks asynchronously
   */
  private async executeBatchAsync(tasks: any[]): Promise<void> {
    try {
      const results = await executor.executeBatch(tasks)

      // Handle retries for failed tasks
      for (const { task, execution } of results) {
        if (execution.status === 'failed') {
          const canRetry = await taskScheduler.handleRetry(task.id!)
          if (canRetry) {
            // Schedule retry after delay
            setTimeout(() => {
              this.pollAndExecute()
            }, this.config.retryDelayMs)
          }
        }
      }
    } catch (err: any) {
      console.error('[ExecutionManager] Batch execution error:', err.message)
    } finally {
      this.activeCount = Math.max(0, this.activeCount - tasks.length)
    }
  }

  /**
   * Get manager status
   */
  getStatus(): { running: boolean; activeCount: number; maxConcurrent: number } {
    return {
      running: this.running,
      activeCount: this.activeCount,
      maxConcurrent: this.config.maxConcurrent,
    }
  }
}

export const executionManager = new ExecutionManager()
