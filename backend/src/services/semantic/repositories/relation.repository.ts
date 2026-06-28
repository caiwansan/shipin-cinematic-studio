// ============================================================
// Relation Repository — CRUD for SemanticRelation
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { SemanticRelationData, RelationFilter } from '../types.js'

export const relationRepository = {
  async create(data: SemanticRelationData) {
    return prisma.semanticRelation.create({
      data: {
        projectId: data.projectId,
        fromEntityId: data.fromEntityId || null,
        fromTopicId: data.fromTopicId || null,
        toEntityId: data.toEntityId || null,
        toTopicId: data.toTopicId || null,
        relation: data.relation,
        confidence: data.confidence ?? 0.0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        schemaVersion: data.schemaVersion ?? 1,
      },
    })
  },

  async findById(id: string) {
    return prisma.semanticRelation.findUnique({ where: { id } })
  },

  async list(filter: RelationFilter) {
    const where: Record<string, unknown> = { projectId: filter.projectId }
    if (filter.relation) where.relation = filter.relation
    if (filter.fromEntityId) where.fromEntityId = filter.fromEntityId
    if (filter.toEntityId) where.toEntityId = filter.toEntityId
    if (filter.fromTopicId) where.fromTopicId = filter.fromTopicId
    if (filter.toTopicId) where.toTopicId = filter.toTopicId

    const limit = filter.limit || 100
    const offset = filter.offset || 0
    const [items, total] = await Promise.all([
      prisma.semanticRelation.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.semanticRelation.count({ where: where as any }),
    ])
    return { items, total }
  },

  async update(id: string, data: Partial<SemanticRelationData>) {
    const updateData: Record<string, unknown> = {}
    if (data.relation !== undefined) updateData.relation = data.relation
    if (data.confidence !== undefined) updateData.confidence = data.confidence
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)

    return prisma.semanticRelation.update({
      where: { id },
      data: updateData,
    })
  },

  async delete(id: string) {
    return prisma.semanticRelation.delete({ where: { id } })
  },

  async deleteByEntity(entityId: string) {
    return prisma.semanticRelation.deleteMany({
      where: {
        OR: [{ fromEntityId: entityId }, { toEntityId: entityId }],
      },
    })
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.semanticRelation.count({ where: { projectId } })
  },
}
