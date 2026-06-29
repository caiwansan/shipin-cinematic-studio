// ============================================================
// GEO Review Queue Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { ReviewQueueItem } from '../types'

function mapPrismaReview(r: any): ReviewQueueItem {
  return {
    id: r.id,
    projectId: r.projectId,
    reviewableType: r.reviewableType,
    reviewableId: r.reviewableId,
    state: r.state,
    reviewerId: r.reviewerId || undefined,
    reviewNotes: r.reviewNotes || undefined,
    previousState: r.previousState || undefined,
    provenance: typeof r.provenance === 'string' ? JSON.parse(r.provenance) : r.provenance,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export const geoReviewRepository = {
  async create(data: {
    projectId: string
    reviewableType: string
    reviewableId: string
    state?: string
    reviewerId?: string
    reviewNotes?: string
    previousState?: string
    provenance: any
  }): Promise<ReviewQueueItem> {
    const item = await prisma.gEOReviewQueue.create({
      data: {
        projectId: data.projectId,
        reviewableType: data.reviewableType,
        reviewableId: data.reviewableId,
        state: data.state || 'draft',
        reviewerId: data.reviewerId || null,
        reviewNotes: data.reviewNotes || null,
        previousState: data.previousState || null,
        provenance: data.provenance,
      },
    })
    return mapPrismaReview(item)
  },

  async findById(id: string): Promise<ReviewQueueItem | null> {
    const item = await prisma.gEOReviewQueue.findUnique({ where: { id } })
    if (!item) return null
    return mapPrismaReview(item)
  },

  async findByProjectId(projectId: string): Promise<ReviewQueueItem[]> {
    const items = await prisma.gEOReviewQueue.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    })
    return items.map(mapPrismaReview)
  },

  async findByState(projectId: string, state: string): Promise<ReviewQueueItem[]> {
    const items = await prisma.gEOReviewQueue.findMany({
      where: { projectId, state },
      orderBy: { createdAt: 'asc' },
    })
    return items.map(mapPrismaReview)
  },

  async findByReviewable(reviewableType: string, reviewableId: string): Promise<ReviewQueueItem | null> {
    const item = await prisma.gEOReviewQueue.findFirst({
      where: { reviewableType, reviewableId },
    })
    if (!item) return null
    return mapPrismaReview(item)
  },

  async transitionState(id: string, newState: string, provenance: any): Promise<ReviewQueueItem | null> {
    const existing = await prisma.gEOReviewQueue.findUnique({ where: { id } })
    if (!existing) return null

    const item = await prisma.gEOReviewQueue.update({
      where: { id },
      data: {
        state: newState,
        previousState: existing.state,
        provenance: provenance as any,
      },
    })
    return mapPrismaReview(item)
  },

  async updateReview(id: string, data: {
    reviewerId?: string
    reviewNotes?: string
  }): Promise<ReviewQueueItem | null> {
    const existing = await prisma.gEOReviewQueue.findUnique({ where: { id } })
    if (!existing) return null

    const item = await prisma.gEOReviewQueue.update({
      where: { id },
      data: {
        reviewerId: data.reviewerId,
        reviewNotes: data.reviewNotes,
      },
    })
    return mapPrismaReview(item)
  },

  async countByState(projectId: string): Promise<Record<string, number>> {
    const items = await prisma.gEOReviewQueue.groupBy({
      by: ['state'],
      where: { projectId },
      _count: true,
    })
    const result: Record<string, number> = {}
    for (const item of items) {
      result[item.state] = item._count
    }
    return result
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOReviewQueue.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },
}
