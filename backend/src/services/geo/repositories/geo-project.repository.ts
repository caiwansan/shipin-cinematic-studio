// ============================================================
// GEO Project Repository — CRUD for gEOProject
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaProject(p: any) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    topic: p.topic || null,
    industry: p.industry || '',
    language: p.language || 'zh',
    country: p.country || null,
    status: p.status || 'draft',
    config: p.config || {},
    workspaceId: p.workspaceId || null,
    deletedAt: p.deletedAt?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

/** Extract the Prisma-compatible where clause, supporting both { id } and { where: { id } } forms */
function extractWhere(where: any): any {
  return where.where || where
}

export const geoProjectRepository = {
  async findMany(where: any, orderBy?: any): Promise<any[]> {
    const projects = await prisma.gEOProject.findMany({ where: extractWhere(where), orderBy: orderBy || { updatedAt: 'desc' } })
    return projects.map(mapPrismaProject)
  },

  async findUnique(where: any): Promise<any | null> {
    const project = await prisma.gEOProject.findUnique({ where: extractWhere(where) })
    if (!project) return null
    return mapPrismaProject(project)
  },

  async findFirst(whereOrOptions: any, options?: { select?: any }): Promise<any | null> {
    // Support both (where, options) and ({ where, select }) signatures
    const where = whereOrOptions.where || whereOrOptions
    const effectiveOptions = options || (whereOrOptions.where ? { select: whereOrOptions.select } : undefined)
    if (effectiveOptions?.select) {
      return prisma.gEOProject.findFirst({ where, ...effectiveOptions })
    }
    const project = await prisma.gEOProject.findFirst({ where })
    if (!project) return null
    return mapPrismaProject(project)
  },

  async create(data: any): Promise<any> {
    const project = await prisma.gEOProject.create({
      data: {
        userId: data.userId,
        name: data.name,
        topic: data.topic || '',
        industry: data.industry || '',
        language: data.language || 'zh',
        country: data.country || null,
        status: data.status || 'draft',
        config: JSON.parse(JSON.stringify(data.config || {})),
      },
    })
    return mapPrismaProject(project)
  },

  async update(where: any, data: any): Promise<any | null> {
    try {
      const project = await prisma.gEOProject.update({ where: extractWhere(where), data })
      return mapPrismaProject(project)
    } catch {
      return null
    }
  },

  async count(where: any): Promise<number> {
    return prisma.gEOProject.count({ where: extractWhere(where) })
  },

  async findManyWithCounts(tenantId: string): Promise<any[]> {
    return prisma.gEOProject.findMany({
      where: {
        userId: tenantId,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            entities: true,
            relations: true,
            versions: true,
          },
        },
      },
    })
  },

  async findUniqueWithInclude(id: string): Promise<any | null> {
    return prisma.gEOProject.findUnique({
      where: { id },
      include: {
        entities: true,
        relations: true,
      },
    })
  },
}
