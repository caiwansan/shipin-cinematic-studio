// ============================================================
// GEO Entity Relation Repository — CRUD for gEOEntityRelation
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaRelation(r: any) {
  return {
    id: r.id,
    projectId: r.projectId,
    sourceId: r.sourceId,
    targetId: r.targetId,
    type: r.type,
    lineage: typeof r.lineage === 'string' ? JSON.parse(r.lineage) : r.lineage,
    metadata: r.metadata || undefined,
    createdAt: r.createdAt.toISOString(),
  }
}

function extractWhere(where: any): any {
  return where.where || where
}

export const geoEntityRelationRepository = {
  async findMany(where: any, orderBy?: any): Promise<any[]> {
    const relations = await prisma.gEOEntityRelation.findMany({ where: extractWhere(where), orderBy })
    return relations.map(mapPrismaRelation)
  },

  async findUnique(where: any) {
    const relation = await prisma.gEOEntityRelation.findUnique({ where: extractWhere(where) })
    if (!relation) return null
    return mapPrismaRelation(relation)
  },

  async create(data: {
    projectId: string
    sourceId: string
    targetId: string
    type: string
    lineage: any
    metadata?: Record<string, unknown>
  }): Promise<any> {
    const relation = await prisma.gEOEntityRelation.create({ data })
    return mapPrismaRelation(relation)
  },

  async count(where: any): Promise<number> {
    return prisma.gEOEntityRelation.count({ where: extractWhere(where) })
  },

  async findFirst(where: any): Promise<any | null> {
    const relation = await prisma.gEOEntityRelation.findFirst({ where })
    if (!relation) return null
    return mapPrismaRelation(relation)
  },
}
