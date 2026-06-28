// ============================================================
// Entity Repository — CRUD + search + resolve for SemanticEntity
// Repository only operates Prisma, no business logic
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { SemanticEntityData, EntityFilter } from '../types.js'

export const entityRepository = {
  async create(data: SemanticEntityData) {
    return prisma.semanticEntity.create({
      data: {
        projectId: data.projectId,
        assetId: data.assetId || null,
        type: data.type,
        name: data.name,
        description: data.description || null,
        confidence: data.confidence ?? 0.0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        schemaVersion: data.schemaVersion ?? 1,
      },
      include: { aliases: true, topics: { include: { topic: true } }, sourceKeywords: true },
    })
  },

  async findById(id: string) {
    return prisma.semanticEntity.findUnique({
      where: { id },
      include: { aliases: true, topics: { include: { topic: true } }, sourceKeywords: true },
    })
  },

  async findByName(projectId: string, name: string) {
    return prisma.semanticEntity.findFirst({
      where: { projectId, name, deletedAt: null },
      include: { aliases: true, sourceKeywords: true },
    })
  },

  async findByNameInsensitive(projectId: string, name: string) {
    return prisma.semanticEntity.findFirst({
      where: {
        projectId,
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null,
      },
      include: { aliases: true },
    })
  },

  async resolveByName(projectId: string, name: string): Promise<{ entity: any; matchedVia: 'name' | 'alias' } | null> {
    // Try exact match first
    const exact = await this.findByName(projectId, name)
    if (exact) return { entity: exact, matchedVia: 'name' }

    // Try case-insensitive
    const insensitive = await this.findByNameInsensitive(projectId, name)
    if (insensitive) return { entity: insensitive, matchedVia: 'name' }

    // Try alias match
    const aliasResult = await prisma.semanticAlias.findFirst({
      where: {
        alias: { equals: name, mode: 'insensitive' },
        entity: { projectId, deletedAt: null },
      },
      include: {
        entity: { include: { aliases: true, topics: { include: { topic: true } }, sourceKeywords: true } },
      },
    })
    if (aliasResult) return { entity: aliasResult.entity, matchedVia: 'alias' }

    return null
  },

  async list(filter: EntityFilter) {
    const where: Record<string, unknown> = {
      projectId: filter.projectId,
      deletedAt: null,
    }
    if (filter.type) where.type = filter.type
    if (filter.name) where.name = { contains: filter.name, mode: 'insensitive' }
    if (filter.confidenceMin !== undefined) where.confidence = { gte: filter.confidenceMin }
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ]
    }

    const limit = filter.limit || 50
    const offset = filter.offset || 0
    const [items, total] = await Promise.all([
      prisma.semanticEntity.findMany({
        where: where as any,
        include: { aliases: true, topics: { include: { topic: true } }, sourceKeywords: true },
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.semanticEntity.count({ where: where as any }),
    ])
    return { items, total }
  },

  async update(id: string, data: Partial<SemanticEntityData>) {
    const updateData: Record<string, unknown> = {}
    if (data.type !== undefined) updateData.type = data.type
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.confidence !== undefined) updateData.confidence = data.confidence
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)
    if (data.assetId !== undefined) updateData.assetId = data.assetId

    return prisma.semanticEntity.update({
      where: { id },
      data: updateData,
      include: { aliases: true, topics: { include: { topic: true } }, sourceKeywords: true },
    })
  },

  async softDelete(id: string) {
    return prisma.semanticEntity.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  },

  async hardDelete(id: string) {
    return prisma.semanticEntity.delete({ where: { id } })
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.semanticEntity.count({
      where: { projectId, deletedAt: null },
    })
  },

  async getTypeStats(projectId: string): Promise<Record<string, number>> {
    const groups = await prisma.semanticEntity.groupBy({
      by: ['type'],
      where: { projectId, deletedAt: null },
      _count: true,
    })
    const stats: Record<string, number> = { total: 0 }
    for (const g of groups) {
      stats[g.type] = g._count
      stats.total += g._count
    }
    return stats
  },
}
