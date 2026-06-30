// ============================================================
// GEO Entity Repository — CRUD for gEOEntity
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaEntity(e: any) {
  return {
    id: e.id,
    projectId: e.projectId,
    name: e.name,
    type: e.type,
    description: e.description || null,
    metadata: e.metadata || undefined,
    provenance: typeof e.provenance === 'string' ? JSON.parse(e.provenance) : e.provenance,
    sortOrder: e.sortOrder || 0,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

export const geoEntityRepository = {
  async findMany(where: any, select?: any): Promise<any[]> {
    return select
      ? prisma.gEOEntity.findMany({ where, select })
      : prisma.gEOEntity.findMany({ where })
  },

  async findUnique(where: any) {
    const entity = await prisma.gEOEntity.findUnique({ where })
    if (!entity) return null
    return mapPrismaEntity(entity)
  },

  async update(where: any, data: any): Promise<any | null> {
    try {
      const entity = await prisma.gEOEntity.update({ where, data })
      return mapPrismaEntity(entity)
    } catch {
      return null
    }
  },

  async count(where: any): Promise<number> {
    const effectiveWhere = where.where || where
    return prisma.gEOEntity.count({ where: effectiveWhere })
  },

  async findFirst(whereOrOptions: any, options?: { orderBy?: any; select?: any }): Promise<any | null> {
    // Support both (where, options) and ({ where, ... }) signatures
    const effectiveWhere = whereOrOptions.where || whereOrOptions
    const effectiveOptions = options || (whereOrOptions.where ? { orderBy: whereOrOptions.orderBy, select: whereOrOptions.select } : undefined)
    if (effectiveOptions) {
      return prisma.gEOEntity.findFirst({ where: effectiveWhere, ...effectiveOptions })
    }
    const entity = await prisma.gEOEntity.findFirst({ where: effectiveWhere })
    if (!entity) return null
    return mapPrismaEntity(entity)
  },

  async create(data: any): Promise<any> {
    const entity = await prisma.gEOEntity.create({ data })
    return mapPrismaEntity(entity)
  },

  async updateMany(where: any, data: any): Promise<number> {
    const result = await prisma.gEOEntity.updateMany({ where, data })
    return result.count
  },
}

// Separate repository for entity relations
export const geoEntityRelationRepository = {
  async count(where: any): Promise<number> {
    const effectiveWhere = where.where || where
    return prisma.gEOEntityRelation.count({ where: effectiveWhere })
  },
}
