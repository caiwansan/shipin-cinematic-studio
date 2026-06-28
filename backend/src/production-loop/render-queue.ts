// Render Queue v1 — 已废弃（Architecture Convergence v1）
// 旧 VideoProvider 已删除，此文件保留仅作为占位以避免 import 断裂。
// 真正的视频渲染请走 ModelAdapterRegistry + RuntimeCredential 链路。
// 计划后续移除此文件。

import { eventBus } from './event-bus.js'

// 临时类型定义（不再依赖已删除的 video-provider.ts）
export interface VideoPrompt {
  id: string
  sceneId: string
  projectId: string
  prompt: string
  duration: number
  width: number
  height: number
}

export interface VideoRenderJob {
  id: string
  prompt: VideoPrompt
  status: 'queued' | 'generating' | 'completed' | 'failed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  output?: { url: string; duration: number; latencyMs: number }
  error?: string
  retryCount: number
  maxRetries: number
}

export type RenderJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface QueueConfig {
  maxConcurrent: number
  maxRetries: number
  retryDelayMs: number
  pollIntervalMs: number
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 2,
  maxRetries: 3,
  retryDelayMs: 5000,
  pollIntervalMs: 2000,
}

export class RenderQueue {
  private config: QueueConfig
  private queue: VideoRenderJob[] = []
  private running = new Map<string, VideoRenderJob>()
  private completed: VideoRenderJob[] = []
  private processing = false

  constructor(config?: Partial<QueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ── Enqueue ──

  async enqueue(prompt: VideoPrompt): Promise<VideoRenderJob> {
    const job: VideoRenderJob = {
      id: `render-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt,
      status: 'queued',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
    }

    this.queue.push(job)
    this.process()

    return job
  }

  // ── Process ──

  private async process(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0 && this.running.size < this.config.maxConcurrent) {
      const job = this.queue.shift()!
      this.running.set(job.id, job)
      this.executeJob(job)
    }

    this.processing = false
  }

  private async executeJob(job: VideoRenderJob): Promise<void> {
    job.status = 'generating'
    job.startedAt = new Date().toISOString()

    try {
      // NOTE: 旧 VideoProviderRegistry 已随 Architecture Convergence v1 删除
      // 视频生成请通过 ModelAdapterRegistry 调用
      throw new Error('RenderQueue v1 已废弃 — 视频生成请通过 ModelAdapterRegistry 调用')

      // Emit render started event
      eventBus.emit({
        type: 'render.video_completed',
        projectId: job.prompt.projectId,
        pipelineId: job.prompt.projectId,
        stepId: 'render',
        data: { jobId: job.id, status: 'generating' },
        metadata: { attempt: job.retryCount + 1 },
      })

      const output = await provider.generate(job.prompt)

      job.status = 'completed'
      job.output = output
      job.completedAt = new Date().toISOString()
      this.running.delete(job.id)
      this.completed.push(job)

      eventBus.emit({
        type: 'render.video_completed',
        projectId: job.prompt.projectId,
        pipelineId: job.prompt.projectId,
        stepId: 'render',
        data: { jobId: job.id, url: output.url, duration: output.duration },
        metadata: { durationMs: output.latencyMs, attempt: job.retryCount + 1 },
      })

    } catch (err: any) {
      job.error = err.message

      if (job.retryCount < job.maxRetries) {
        // Retry
        job.retryCount++
        job.status = 'queued'

        eventBus.emit({
          type: 'step.retrying',
          projectId: job.prompt.projectId,
          pipelineId: job.prompt.projectId,
          stepId: 'render',
          error: err.message,
          metadata: { attempt: job.retryCount },
        })

        // Re-queue with delay
        setTimeout(() => {
          this.running.delete(job.id)
          this.queue.unshift(job)
          this.process()
        }, this.config.retryDelayMs * job.retryCount)  // Exponential backoff
      } else {
        // Max retries exceeded
        job.status = 'failed'
        this.running.delete(job.id)
        this.completed.push(job)

        eventBus.emit({
          type: 'render.failed',
          projectId: job.prompt.projectId,
          pipelineId: job.prompt.projectId,
          stepId: 'render',
          data: { jobId: job.id },
          error: `Failed after ${job.maxRetries} retries: ${err.message}`,
        })
      }
    }

    // Continue processing queue
    this.process()
  }

  // ── Status ──

  getJob(jobId: string): VideoRenderJob | undefined {
    return this.queue.find(j => j.id === jobId)
      || this.running.get(jobId)
      || this.completed.find(j => j.id === jobId)
  }

  getQueueStats() {
    return {
      queued: this.queue.length,
      running: this.running.size,
      completed: this.completed.length,
      failed: this.completed.filter(j => j.status === 'failed').length,
      total: this.queue.length + this.running.size + this.completed.length,
    }
  }

  listCompleted(projectId?: string): VideoRenderJob[] {
    return projectId
      ? this.completed.filter(j => j.prompt.projectId === projectId)
      : this.completed
  }

  listQueued(): VideoRenderJob[] {
    return this.queue
  }

  // ── Control ──

  clear(): void {
    this.queue = []
    this.running.clear()
    this.completed = []
  }

  cancel(jobId: string): boolean {
    const idx = this.queue.findIndex(j => j.id === jobId)
    if (idx >= 0) {
      this.queue.splice(idx, 1)
      return true
    }
    const running = this.running.get(jobId)
    if (running) {
      running.status = 'failed'
      running.error = 'canceled'
      this.running.delete(jobId)
      this.completed.push(running)
      return true
    }
    return false
  }
}

// Export singleton
export const renderQueue = new RenderQueue()
