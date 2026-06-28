// ============================================================
// Topic Repository — CRUD for SemanticTopic
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { SemanticTopicData, TopicFilter } from '../types.js'

export const topicRepository = {
  async create(data: SemanticTopicData) {
    return prisma.semanticTopic.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description || null,
        confidence: data.confidence ?? 0.0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        schemaVersion: data.schemaVersion ?? 1,
      },
      include: { entities: { include: { entity: true } } },
    })
  },

  async findById(id: string) {
    return prisma.semanticTopic.findUnique({
      where: { id },
      include: { entities: { include: { entity: true } } },
    })
  },

  async findByName(projectId: string, name: string) {
    return prisma.semanticTopic.findFirst({
      where: { projectId, name: { equals: name, mode: 'insensitive' } },
      include: { entities: { include: { entity: true } } },
    })
  },

  async list(filter: TopicFilter) {
    const where: Record<string, unknown> = { projectId: filter.projectId }
    if (filter.name) where.name = { contains: filter.name, mode: 'insensitive' }
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ]
    }

    const limit = filter.limit || 50
    const offset = filter.offset || 0
    const [items, total] = await Promise.all([
      prisma.semanticTopic.findMany({
        where: where as any,
        include: { entities: { include: { entity: true } } },
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.semanticTopic.count({ where: where as any }),
    ])
    return { items, total }
  },

  async update(id: string, data: Partial<SemanticTopicData>) {
    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.confidence !== undefined) updateData.confidence = data.confidence
    if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata)

    return prisma.semanticTopic.update({
      where: { id },
      data: updateData,
      include: { entities: { include: { entity: true } } },
    })
  },

  async delete(id: string) {
    return prisma.semanticTopic.delete({ where: { id } })
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.semanticTopic.count({ where: { projectId } })
  },

  // Link entity to topic
  async linkEntity(entityId: string, topicId: string) {
    return prisma.semanticEntityTopic.upsert({
      where: { entityId_topicId: { entityId, topicId } },
      create: { entityId, topicId },
      update: {},
    })
  },

  // Unlink entity from topic
  async unlinkEntity(entityId: string, topicId: string) {
    return prisma.semanticEntityTopic.deleteMany({
      where: { entityId, topicId },
    })
  },

  // Get entities for a topic
  async getEntities(topicId: string) {
    return prisma.semanticEntityTopic.findMany({
      where: { topicId },
      include: { entity: { include: { aliases: true } } },
    })
  },
}
