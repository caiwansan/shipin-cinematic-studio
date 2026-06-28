// ============================================================
// Review Repository — CRUD for Review
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { ReviewData } from '../types.js'

function mapReview(row: any): ReviewData {
  return {
    id: row.id,
    executionId: row.executionId,
    status: row.status,
    comments: row.comments,
    score: row.score,
    metadata: row.metadata,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  }
}

export const reviewRepository = {
  async create(data: ReviewData): Promise<ReviewData> {
    const row = await prisma.review.create({
      data: {
        executionId: data.executionId,
        status: data.status ?? 'pending',
        comments: data.comments,
        score: data.score,
        metadata: data.metadata,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
    return mapReview(row)
  },

  async findById(id: string): Promise<ReviewData | null> {
    const row = await prisma.review.findUnique({ where: { id } })
    return row ? mapReview(row) : null
  },

  async findByExecution(executionId: string): Promise<ReviewData[]> {
    const rows = await prisma.review.findMany({
      where: { executionId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(mapReview)
  },

  async list(executionId?: string): Promise<ReviewData[]> {
    const where: any = {}
    if (executionId) where.executionId = executionId
    const rows = await prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return rows.map(mapReview)
  },

  async update(id: string, data: Partial<ReviewData>): Promise<ReviewData> {
    const updateData: any = {}
    if (data.status !== undefined) updateData.status = data.status
    if (data.comments !== undefined) updateData.comments = data.comments
    if (data.score !== undefined) updateData.score = data.score
    if (data.metadata !== undefined) updateData.metadata = data.metadata

    const row = await prisma.review.update({ where: { id }, data: updateData })
    return mapReview(row)
  },

  async delete(id: string): Promise<void> {
    await prisma.review.delete({ where: { id } })
  },

  async deleteByExecution(executionId: string): Promise<void> {
    await prisma.review.deleteMany({ where: { executionId } })
  },

  async countByStatus(status: string): Promise<number> {
    return prisma.review.count({ where: { status } })
  },
}
