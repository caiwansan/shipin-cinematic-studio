/**
 * E2 Worker Pool — 通用 Worker 系统
 *
 * 消费 JobQueue 中的任务，执行对应的处理器
 * 支持注册任意 handler
 */

import { jobQueueManager, Job, JobType } from '../services/job-queue-manager.js'

type JobHandler = (job: Job) => Promise<any>

export class WorkerPool {
  private handlers = new Map<JobType, JobHandler>()
  private running = false
  private pollTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 注册任务处理器
   */
  registerHandler(type: JobType, handler: JobHandler) {
    this.handlers.set(type, handler)
  }

  /**
   * 启动 Worker（轮询模式）
   */
  start(pollIntervalMs: number = 500) {
    if (this.running) return
    this.running = true

    this.pollTimer = setInterval(async () => {
      if (!this.running) return

      try {
        const job = await jobQueueManager.dequeue()
        if (!job) return

        const handler = this.handlers.get(job.type)
        if (!handler) {
          await jobQueueManager.fail(job.id, `未注册处理器: ${job.type}`)
          return
        }

        try {
          const result = await handler(job)
          await jobQueueManager.complete(job.id, result)
        } catch (err: any) {
          await jobQueueManager.fail(job.id, err.message)
        }
      } catch {
        // 轮询异常不崩溃
      }
    }, pollIntervalMs)
  }

  /**
   * 停止 Worker
   */
  stop() {
    this.running = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}

export const workerPool = new WorkerPool()
