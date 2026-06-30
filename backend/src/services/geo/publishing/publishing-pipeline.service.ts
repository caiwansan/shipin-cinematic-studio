import { PrismaClient } from '@prisma/client'
import { publishingAdapterRegistry } from './adapters/adapter-registry'
import { eventBus } from '../../../platform/event-bus'
import { validateTransition } from '../../../platform/state-machine'
import type { PublishRequest, PublishPreview, PublishResult } from './publishing.types'

export class PublishingPipelineService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Preview a publication
   */
  async preview(request: PublishRequest): Promise<PublishPreview> {
    const adapter = publishingAdapterRegistry.resolve(request.platform)
    return adapter.preview({
      projectId: request.projectId,
      contentType: request.contentType,
      content: request.content,
      beforeContent: request.beforeContent,
      afterContent: request.afterContent,
    })
  }

  /**
   * Submit for publishing (creates draft record)
   */
  async submit(request: PublishRequest): Promise<PublishResult> {
    // Validate the adapter exists and supports this content type
    const adapter = publishingAdapterRegistry.resolve(request.platform)
    if (!adapter.supports(request.contentType)) {
      throw new Error(`Platform '${request.platform}' does not support content type '${request.contentType}'`)
    }

    // Create draft publishing record
    const record = await this.prisma.publishingRecord.create({
      data: {
        projectId: request.projectId,
        executionId: request.executionId,
        platform: request.platform,
        adapterType: request.platform,
        contentType: request.contentType,
        content: request.content,
        beforeContent: request.beforeContent || undefined,
        afterContent: request.afterContent || undefined,
        status: 'draft',
        publishVersion: 1,
      },
    })

    // Publish event
    await eventBus.publish({
      type: 'publishing.draft_created',
      source: 'PublishingPipelineService',
      payload: { publishId: record.id, projectId: request.projectId, platform: request.platform },
    })

    // Record status in publishing_records
    return {
      publishId: record.id,
      platform: request.platform,
      status: 'draft',
      publishVersion: 1,
    }
  }

  /**
   * Approve and publish
   */
  async approve(publishId: string, reviewer: string, note?: string): Promise<PublishResult> {
    const record = await this.prisma.publishingRecord.findUnique({ where: { id: publishId } })
    if (!record) throw new Error(`Publish record ${publishId} not found`)

    // Validate state transition: draft → approved
    const transition = validateTransition('publishing', record.status, 'approved')
    if (!transition.allowed) throw new Error(`IllegalStateTransition: ${transition.reason}`)

    // Update record to approved
    await this.prisma.publishingRecord.update({
      where: { id: publishId },
      data: {
        status: 'approved',
        reviewedBy: reviewer,
        approvalNote: note,
        reviewedAt: new Date(),
      },
    })

    // Execute publish via adapter
    const adapter = publishingAdapterRegistry.resolve(record.platform)
    const publishResult = await adapter.publish(record.projectId, {
      projectId: record.projectId,
      contentType: record.contentType,
      content: record.content as Record<string, any>,
      beforeContent: (record.beforeContent as Record<string, any>) || undefined,
      afterContent: (record.afterContent as Record<string, any>) || undefined,
    })

    // Update record to published
    await this.prisma.publishingRecord.update({
      where: { id: publishId },
      data: { status: 'published', publishedAt: new Date(), publishVersion: publishResult.publishVersion },
    })

    await eventBus.publish({
      type: 'publishing.published',
      source: 'PublishingPipelineService',
      payload: { publishId, projectId: record.projectId, platform: record.platform },
    })

    return {
      publishId,
      platform: record.platform,
      status: 'published',
      publishedAt: new Date(),
      publishVersion: publishResult.publishVersion,
    }
  }

  /**
   * Rollback a publication
   */
  async rollback(publishId: string, reason: string): Promise<void> {
    const record = await this.prisma.publishingRecord.findUnique({ where: { id: publishId } })
    if (!record) throw new Error(`Publish record ${publishId} not found`)

    const transition = validateTransition('publishing', record.status, 'rolled_back')
    if (!transition.allowed) throw new Error(`IllegalStateTransition: ${transition.reason}`)

    const adapter = publishingAdapterRegistry.resolve(record.platform)
    await adapter.rollback(record.projectId, record.publishVersion)

    await this.prisma.publishingRecord.update({
      where: { id: publishId },
      data: {
        status: 'rolled_back',
        rollbackVersion: record.publishVersion,
        rollbackReason: reason,
        rolledBackAt: new Date(),
      },
    })

    await eventBus.publish({
      type: 'publishing.rolled_back',
      source: 'PublishingPipelineService',
      payload: { publishId, projectId: record.projectId, platform: record.platform, reason },
    })
  }

  /**
   * Get publishing record
   */
  async getRecord(publishId: string): Promise<any> {
    return this.prisma.publishingRecord.findUnique({ where: { id: publishId } })
  }

  /**
   * List publishing records for a project
   */
  async listRecords(projectId: string, limit = 20, offset = 0): Promise<any[]> {
    return this.prisma.publishingRecord.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })
  }

  /**
   * Get the publishing pipeline status for a project (aggregated)
   */
  async getPipelineStatus(projectId: string): Promise<{
    total: number
    draft: number
    approved: number
    published: number
    verifiedOnline: number
    indexed: number
    failed: number
    rolledBack: number
    latestPublished?: any
  }> {
    const records = await this.prisma.publishingRecord.findMany({ where: { projectId } })
    const total = records.length
    const draft = records.filter(r => r.status === 'draft').length
    const approved = records.filter(r => r.status === 'approved').length
    const published = records.filter(r => r.status === 'published').length
    const verifiedOnline = records.filter(r => r.status === 'verified_online').length
    const indexed = records.filter(r => r.status === 'indexed').length
    const failed = records.filter(r => r.status === 'failed').length
    const rolledBack = records.filter(r => r.status === 'rolled_back').length
    const latestPublished = records
      .filter(r => r.status === 'published' || r.status === 'verified_online' || r.status === 'indexed')
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())[0]

    return { total, draft, approved, published, verifiedOnline, indexed, failed, rolledBack, latestPublished }
  }
}
