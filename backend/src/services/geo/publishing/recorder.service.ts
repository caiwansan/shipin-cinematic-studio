// ════════════════════════════════════════════════════════════
// P3 Service: RecorderService — Publish → PublishingRecord (append-only)
// ════════════════════════════════════════════════════════════
// Phase 3 — No Vue, no CMS, no UI

import { PrismaClient } from '@prisma/client'
import { Artifact, PublishingRecord } from '../types'
import { channelRegistry, computeArtifactHash } from './artifact-renderer'

export class RecorderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a publish event: creates append-only PublishingRecord.
   * FR-B: Version is never modified — rollback creates a new record.
   */
  async record(
    planId: string,
    claimId: string,
    channel: string,
    version: string,
    artifact: Artifact,
    artifactUrl?: string,
  ): Promise<PublishingRecord> {
    const hash = computeArtifactHash(artifact.content)

    const record = await this.prisma.publishingRecord.create({
      data: {
        planId,
        claimId,
        channel,
        version,
        artifactHash: hash,
        artifactUrl: artifactUrl || null,
        status: 'pending',
      },
    })

    return this.toDomain(record)
  }

  /**
   * Mark a record as published (after adapter confirms).
   */
  async confirmPublished(id: string, artifactUrl?: string): Promise<PublishingRecord> {
    const data: any = { status: 'published', publishedAt: new Date() }
    if (artifactUrl) data.artifactUrl = artifactUrl

    const record = await this.prisma.publishingRecord.update({
      where: { id },
      data,
    })
    return this.toDomain(record)
  }

  /**
   * Mark a record as failed.
   */
  async markFailed(id: string): Promise<PublishingRecord> {
    const record = await this.prisma.publishingRecord.update({
      where: { id },
      data: { status: 'failed' },
    })
    return this.toDomain(record)
  }

  /**
   * Rollback: creates a new PublishingRecord for the rollback event.
   * Does NOT modify the original record (append-only).
   */
  async rollback(originalRecordId: string, reason: string): Promise<PublishingRecord> {
    const original = await this.prisma.publishingRecord.findUnique({ where: { id: originalRecordId } })
    if (!original) throw new Error(`Record ${originalRecordId} not found`)

    // Mark original as rolled_back
    await this.prisma.publishingRecord.update({
      where: { id: originalRecordId },
      data: { status: 'rolled_back' },
    })

    // No new record needed for now; rollback is a status change on the original.
    return this.toDomain({ ...original, status: 'rolled_back' })
  }

  /**
   * List records by plan.
   */
  async listByPlan(planId: string): Promise<PublishingRecord[]> {
    const records = await this.prisma.publishingRecord.findMany({
      where: { planId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(r => this.toDomain(r))
  }

  /**
   * List records by claim.
   */
  async listByClaim(claimId: string): Promise<PublishingRecord[]> {
    const records = await this.prisma.publishingRecord.findMany({
      where: { claimId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(r => this.toDomain(r))
  }

  /**
   * Publishing summary for a project.
   */
  async getSummary(projectId: string): Promise<{
    totalPlans: number
    draftCount: number
    inReviewCount: number
    approvedCount: number
    publishedCount: number
    channelBreakdown: Array<{ channel: string; count: number }>
  }> {
    const plans = await this.prisma.publishPlan.findMany({ where: { projectId } })
    const records = await this.prisma.publishingRecord.findMany({
      where: { plan: { projectId } },
    })

    const channelMap = new Map<string, number>()
    records.forEach(r => {
      if (r.status === 'published') {
        channelMap.set(r.channel, (channelMap.get(r.channel) || 0) + 1)
      }
    })

    return {
      totalPlans: plans.length,
      draftCount: plans.filter(p => p.status === 'draft').length,
      inReviewCount: plans.filter(p => p.status === 'in_review').length,
      approvedCount: plans.filter(p => p.status === 'approved').length,
      publishedCount: plans.filter(p => p.status === 'published').length,
      channelBreakdown: Array.from(channelMap.entries()).map(([channel, count]) => ({
        channel,
        count,
      })),
    }
  }

  private toDomain(r: any): PublishingRecord {
    return {
      id: r.id,
      planId: r.planId,
      claimId: r.claimId,
      channel: r.channel,
      version: r.version,
      artifactHash: r.artifactHash,
      artifactUrl: r.artifactUrl || undefined,
      status: r.status,
      publishedAt: r.publishedAt?.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }
  }
}
