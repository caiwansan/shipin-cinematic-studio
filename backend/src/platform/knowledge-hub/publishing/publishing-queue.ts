// ════════════════════════════════════════════════════════════
// KH2-T003 — PublishingQueue
// ════════════════════════════════════════════════════════════
// Async job model for publishing. Every publish goes through here.
// Supports: enqueue, get, list, retry, cancel, updateStatus, complete, fail
// ════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid'
import { PublishingResult, PublishArtifact } from './types'

export interface QueueItem {
  id: string
  packageId: string
  publisherName: string
  config?: Record<string, unknown>
  initiatedBy: string
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  startedAt?: string
  finishedAt?: string
  result?: PublishArtifact[]
  error?: string
  errorLog?: string[]
  retryCount: number
  maxRetries: number
  createdAt: string
  updatedAt: string
}

export class PublishingQueue {
  private jobs: Map<string, QueueItem> = new Map()
  private retryDelay = 5000 // 5s between retries

  async enqueue(data: {
    packageId: string
    publisherName: string
    config?: Record<string, unknown>
    initiatedBy: string
  }): Promise<QueueItem> {
    const item: QueueItem = {
      id: uuid(),
      packageId: data.packageId,
      publisherName: data.publisherName,
      config: data.config,
      initiatedBy: data.initiatedBy,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.jobs.set(item.id, item)
    return item
  }

  async get(id: string): Promise<PublishingResult | null> {
    const item = this.jobs.get(id)
    if (!item) return null
    return this.toResult(item)
  }

  async list(options?: {
    status?: string
    page?: number
    pageSize?: number
  }): Promise<{ items: PublishingResult[]; total: number }> {
    let items = Array.from(this.jobs.values())
    if (options?.status) {
      items = items.filter(i => i.status === options.status)
    }
    const total = items.length
    const page = options?.page ?? 1
    const pageSize = options?.pageSize ?? 20
    const paged = items.slice((page - 1) * pageSize, page * pageSize)

    return { items: paged.map(i => this.toResult(i)), total }
  }

  async updateStatus(id: string, status: QueueItem['status']): Promise<void> {
    const item = this.jobs.get(id)
    if (!item) return
    item.status = status
    item.updatedAt = new Date().toISOString()
    if (status === 'running' && !item.startedAt) {
      item.startedAt = new Date().toISOString()
    }
  }

  async complete(id: string, result: { artifacts: PublishArtifact[] }): Promise<void> {
    const item = this.jobs.get(id)
    if (!item) return
    item.status = 'succeeded'
    item.result = result.artifacts
    item.finishedAt = new Date().toISOString()
    item.updatedAt = new Date().toISOString()
  }

  async fail(id: string, error: string): Promise<void> {
    const item = this.jobs.get(id)
    if (!item) return
    item.error = error
    item.errorLog = [...(item.errorLog || []), error]
    item.retryCount++

    if (item.retryCount < item.maxRetries) {
      item.status = 'queued'
      // In production, schedule via setTimeout/cron
    } else {
      item.status = 'failed'
      item.finishedAt = new Date().toISOString()
    }
    item.updatedAt = new Date().toISOString()
  }

  async retry(id: string): Promise<PublishingResult | null> {
    const item = this.jobs.get(id)
    if (!item || item.status === 'running') return null
    item.status = 'queued'
    item.retryCount = 0
    item.error = undefined
    item.updatedAt = new Date().toISOString()
    return this.toResult(item)
  }

  async cancel(id: string): Promise<boolean> {
    const item = this.jobs.get(id)
    if (!item || item.status === 'succeeded' || item.status === 'running') return false
    item.status = 'cancelled'
    item.finishedAt = new Date().toISOString()
    item.updatedAt = new Date().toISOString()
    return true
  }

  private toResult(item: QueueItem): PublishingResult {
    return {
      id: item.id,
      packageId: item.packageId,
      publisherName: item.publisherName,
      status: item.status,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      artifacts: item.result ?? [],
      error: item.error,
      errorLog: item.errorLog ?? [],
      retryCount: item.retryCount,
      maxRetries: item.maxRetries,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }
}
