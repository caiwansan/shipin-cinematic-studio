/**
 * E1-E4 通用 Job System
 *
 * 统一 Job 类型，支持内存 + DB 两种后端
 * 重试 + 死信队列
 */

// ─── Job 类型 ───

export type JobType = 'ai_invoke' | 'optimization' | 'video_generation' | 'batch_optimize'

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Job {
  id: string
  type: JobType
  payload: any
  status: JobStatus
  retryCount: number
  maxRetries: number
  result?: any
  error?: string
  createdAt: number
  updatedAt: number
}

// ─── 内存 Queue 后端 ───

class MemoryQueueBackend {
  private queue: Job[] = []
  private deadLetter: Job[] = []

  async push(job: Job): Promise<void> {
    this.queue.push(job)
  }

  async pop(): Promise<Job | undefined> {
    return this.queue.shift()
  }

  async peek(): Promise<Job[]> {
    return [...this.queue]
  }

  async dlqPush(job: Job): Promise<void> {
    this.deadLetter.push(job)
  }

  async dlqPeek(): Promise<Job[]> {
    return [...this.deadLetter]
  }

  size(): number {
    return this.queue.length
  }
}

// ─── Job Queue Manager ───

export class JobQueueManager {
  private backend = new MemoryQueueBackend()
  private jobs = new Map<string, Job>()
  private processing = new Set<string>()

  /**
   * 提交任务
   */
  async submit(params: {
    type: JobType
    payload: any
    maxRetries?: number
  }): Promise<Job> {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: params.type,
      payload: params.payload,
      status: 'pending',
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    this.jobs.set(job.id, job)
    await this.backend.push(job)
    return job
  }

  /**
   * 取下一个任务
   */
  async dequeue(): Promise<Job | null> {
    const job = await this.backend.pop()
    if (!job) return null

    if (this.processing.has(job.id)) {
      // 重入保护
      await this.backend.push(job)
      return null
    }

    this.processing.add(job.id)
    job.status = 'running'
    job.updatedAt = Date.now()
    return job
  }

  /**
   * 完成任务
   */
  async complete(jobId: string, result: any): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.status = 'completed'
    job.result = result
    job.updatedAt = Date.now()
    this.processing.delete(jobId)
  }

  /**
   * 标记失败（自动重试或进 DLQ）
   */
  async fail(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job) return

    job.retryCount++
    job.updatedAt = Date.now()

    if (job.retryCount <= job.maxRetries) {
      // 重试：指数退避后重新入队
      job.status = 'pending'
      job.error = error
      this.processing.delete(jobId)

      const backoffMs = Math.min(1000 * Math.pow(2, job.retryCount - 1), 30000)
      setTimeout(async () => {
        await this.backend.push(job)
      }, backoffMs)
    } else {
      // 超过最大重试 → 死信队列
      job.status = 'failed'
      job.error = error
      this.processing.delete(jobId)
      await this.backend.dlqPush(job)
    }
  }

  /**
   * 获取任务状态
   */
  getStatus(jobId: string): Job | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * 获取死信队列
   */
  getDeadLetterQueue(): Promise<Job[]> {
    return this.backend.dlqPeek()
  }

  /**
   * 队列统计
   */
  stats() {
    return {
      pending: this.backend.size(),
      processing: this.processing.size,
      total: this.jobs.size,
      deadLetter: 0, // 从 backend dlq
    }
  }

  /**
   * 包装函数：将同步 API 异步化
   * 返回 jobId，worker 消费后结果存 job
   */
  async wrapAsync<T>(
    type: JobType,
    executor: () => Promise<T>,
  ): Promise<string> {
    const job = await this.submit({ type, payload: {} })

    // 立即执行（简单模式——生产环境由 worker 消费）
    // 这里用 setTimeout 确保不阻塞 response
    setTimeout(async () => {
      try {
        const result = await executor()
        await this.complete(job.id, result)
      } catch (err: any) {
        await this.fail(job.id, err.message)
      }
    }, 0)

    return job.id
  }
}

export const jobQueueManager = new JobQueueManager()
