// ============================================================
// GEO Quality Score Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { QualityScore } from '../types'

function mapPrismaScore(s: any): QualityScore {
  return {
    id: s.id,
    projectId: s.projectId,
    dimension: s.dimension,
    score: s.score,
    breakdown: s.breakdown || undefined,
    metadata: s.metadata || undefined,
    createdAt: s.createdAt.toISOString(),
  }
}

export const geoQualityRepository = {
  async create(data: {
    projectId: string
    dimension: string
    score: number
    breakdown?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }): Promise<QualityScore> {
    const score = await prisma.gEOQualityScore.create({
      data: {
        projectId: data.projectId,
        dimension: data.dimension,
        score: data.score,
        breakdown: (data.breakdown || {}) as any,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaScore(score)
  },

  async findById(id: string): Promise<QualityScore | null> {
    const s = await prisma.gEOQualityScore.findUnique({ where: { id } })
    if (!s) return null
    return mapPrismaScore(s)
  },

  async findByProjectId(projectId: string): Promise<QualityScore[]> {
    const scores = await prisma.gEOQualityScore.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return scores.map(mapPrismaScore)
  },

  async findLatestByProjectAndDimension(projectId: string, dimension: string): Promise<QualityScore | null> {
    const s = await prisma.gEOQualityScore.findFirst({
      where: { projectId, dimension },
      orderBy: { createdAt: 'desc' },
    })
    if (!s) return null
    return mapPrismaScore(s)
  },

  async listDimensions(projectId: string): Promise<string[]> {
    const result = await prisma.gEOQualityScore.findMany({
      where: { projectId },
      select: { dimension: true },
      distinct: ['dimension'],
    })
    return result.map((r: any) => r.dimension)
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOQualityScore.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },
}
