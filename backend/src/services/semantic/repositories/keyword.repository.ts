// ============================================================
// Keyword Repository — CRUD for SemanticKeyword
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { SemanticKeywordData, KeywordFilter } from '../types.js'

export const keywordRepository = {
  async create(data: SemanticKeywordData) {
    return prisma.semanticKeyword.create({
      data: {
        projectId: data.projectId,
        keyword: data.keyword,
        entityId: data.entityId || null,
        language: data.language || 'zh',
        confidence: data.confidence ?? 0.0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        schemaVersion: data.schemaVersion ?? 1,
      },
      include: { entity: true },
    })
  },

  async findById(id: string) {
    return prisma.semanticKeyword.findUnique({
      where: { id },
      include: { entity: true },
    })
  },

  async list(filter: KeywordFilter) {
    const where: Record<string, unknown> = { projectId: filter.projectId }
    if (filter.keyword) where.keyword = { contains: filter.keyword, mode: 'insensitive' }
    if (filter.language) where.language = filter.language
    if (filter.entityId) where.entityId = filter.entityId
    if (filter.search) {
      where.keyword = { contains: filter.search, mode: 'insensitive' }
    }

    const limit = filter.limit || 100
    const offset = filter.offset || 0
    const [items, total] = await Promise.all([
      prisma.semanticKeyword.findMany({
        where: where as any,
        include: { entity: true },
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.semanticKeyword.count({ where: where as any }),
    ])
    return { items, total }
  },

  async update(id: string, data: Partial<SemanticKeywordData>) {
    const updateData: Record<string, unknown> = {}
    if (data.keyword !== undefined) updateData.keyword = data.keyword
    if (data.confidence !== undefined) updateData.confidence = data.confidence
    if (data.language !== undefined) updateData.language = data.language
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)

    return prisma.semanticKeyword.update({
      where: { id },
      data: updateData,
      include: { entity: true },
    })
  },

  async delete(id: string) {
    return prisma.semanticKeyword.delete({ where: { id } })
  },

  async deleteByEntity(entityId: string) {
    return prisma.semanticKeyword.deleteMany({ where: { entityId } })
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.semanticKeyword.count({ where: { projectId } })
  },

  async getTopKeywords(projectId: string, limit = 50) {
    return prisma.semanticKeyword.findMany({
      where: { projectId },
      orderBy: { confidence: 'desc' },
      take: limit,
      include: { entity: true },
    })
  },
}
