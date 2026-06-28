// ============================================================
// Alias Repository — CRUD + resolve for SemanticAlias
// ============================================================

import { prisma } from '../../../utils/index.js'
import type { SemanticAliasData } from '../types.js'

export const aliasRepository = {
  async create(data: SemanticAliasData) {
    return prisma.semanticAlias.create({
      data: {
        entityId: data.entityId,
        alias: data.alias,
        language: data.language || 'zh',
        confidence: data.confidence ?? 1.0,
      },
      include: { entity: true },
    })
  },

  async findById(id: string) {
    return prisma.semanticAlias.findUnique({
      where: { id },
      include: { entity: true },
    })
  },

  async findByAlias(alias: string, projectId?: string) {
    const where: Record<string, unknown> = {
      alias: { equals: alias, mode: 'insensitive' },
    }
    if (projectId) {
      where.entity = { projectId, deletedAt: null }
    }
    return prisma.semanticAlias.findFirst({
      where: where as any,
      include: { entity: true },
    })
  },

  async listByEntity(entityId: string) {
    return prisma.semanticAlias.findMany({
      where: { entityId },
      orderBy: { confidence: 'desc' },
    })
  },

  async listByProject(projectId: string) {
    return prisma.semanticAlias.findMany({
      where: { entity: { projectId } },
      include: { entity: true },
      orderBy: { confidence: 'desc' },
    })
  },

  async update(id: string, data: Partial<SemanticAliasData>) {
    const updateData: Record<string, unknown> = {}
    if (data.alias !== undefined) updateData.alias = data.alias
    if (data.language !== undefined) updateData.language = data.language
    if (data.confidence !== undefined) updateData.confidence = data.confidence

    return prisma.semanticAlias.update({
      where: { id },
      data: updateData,
      include: { entity: true },
    })
  },

  async delete(id: string) {
    return prisma.semanticAlias.delete({ where: { id } })
  },

  async deleteByEntity(entityId: string) {
    return prisma.semanticAlias.deleteMany({ where: { entityId } })
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.semanticAlias.count({
      where: { entity: { projectId } },
    })
  },
}
