// ════════════════════════════════════════════════════════════
// KH2-T001 — PublishingEngine
// ════════════════════════════════════════════════════════════
// Single entry point for all KnowledgePackage publishing.
// No Workspace, page, or API may bypass this engine.
// ════════════════════════════════════════════════════════════

import { KnowledgePackage } from '../core/types'
import { PublisherRegistry } from './publisher-registry'
import { PublishingQueue } from './publishing-queue'
import { PublishingResult, Publisher } from './types'
import { KnowledgePackageRepository } from '../repository/package-repository'

export interface PublishRequest {
  packageId: string
  publisherName: string
  config?: Record<string, unknown>
  initiatedBy: string
}

export interface PublishResponse {
  jobId: string
  status: string
}

export class PublishingEngine {
  constructor(
    private registry: PublisherRegistry,
    private queue: PublishingQueue,
    private repo?: KnowledgePackageRepository,
  ) {}

  /**
   * Submit a package for publishing. Always goes through the queue.
   */
  async publish(request: PublishRequest): Promise<PublishResponse> {
    const publisher = this.registry.get(request.publisherName)
    if (!publisher) {
      throw new Error(`Publisher not found: ${request.publisherName}`)
    }

    const pkg = this.repo ? await this.repo.findById(request.packageId) : null
    const job = await this.queue.enqueue({
      packageId: request.packageId,
      publisherName: request.publisherName,
      config: request.config,
      initiatedBy: request.initiatedBy,
    })

    // Process synchronously for now (KH2-T003: async queue in next iteration)
    this.processJob(job.id, publisher, (pkg as any))

    return { jobId: job.id, status: job.status }
  }

  async getJob(jobId: string): Promise<PublishingResult | null> {
    return this.queue.get(jobId)
  }

  async listJobs(options?: {
    status?: string
    page?: number
    pageSize?: number
  }): Promise<{ items: PublishingResult[]; total: number }> {
    return this.queue.list(options)
  }

  async retry(jobId: string): Promise<PublishingResult | null> {
    return this.queue.retry(jobId)
  }

  async cancel(jobId: string): Promise<boolean> {
    return this.queue.cancel(jobId)
  }

  private async processJob(
    jobId: string,
    publisher: Publisher,
    pkg: KnowledgePackage | null,
  ): Promise<void> {
    try {
      await this.queue.updateStatus(jobId, 'running')

      if (!pkg) {
        await this.queue.fail(jobId, 'Package not found')
        return
      }

      const result = await publisher.publish(pkg)
      await this.queue.complete(jobId, result)
    } catch (err: any) {
      await this.queue.fail(jobId, err.message)
    }
  }
}
