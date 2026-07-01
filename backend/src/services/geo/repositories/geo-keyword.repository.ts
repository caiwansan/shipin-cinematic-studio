// ============================================================
// GEO Keyword Repository — CRUD for geoKeyword
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaKeyword(k: any) {
  return {
    id: k.id,
    projectId: k.projectId,
    keyword: k.keyword,
    type: k.type || 'brand',
    source: k.source,
    frequency: k.frequency || 0,
    relevanceScore: k.relevanceScore || 0,
    language: k.language || 'zh',
    status: k.status || 'active',
    metadata: k.metadata || undefined,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  }
}

function extractWhere(where: any): any {
  return where.where || where
}

export const geoKeywordRepository = {
  async findMany(where: any, orderBy?: any): Promise<any[]> {
    const keywords = await prisma.geoKeyword.findMany({ where: extractWhere(where), orderBy: orderBy || { updatedAt: 'desc' } })
    return keywords.map(mapPrismaKeyword)
  },

  async findFirst(where: any): Promise<any | null> {
    const keyword = await prisma.geoKeyword.findFirst({ where: extractWhere(where) })
    if (!keyword) return null
    return mapPrismaKeyword(keyword)
  },

  async findUnique(where: any): Promise<any | null> {
    const keyword = await prisma.geoKeyword.findUnique({ where: extractWhere(where) })
    if (!keyword) return null
    return mapPrismaKeyword(keyword)
  },

  async create(data: any): Promise<any> {
    const keyword = await prisma.geoKeyword.create({ data })
    return mapPrismaKeyword(keyword)
  },

  async createMany(data: any[]): Promise<number> {
    const result = await prisma.geoKeyword.createMany({
      data: data.map(d => ({
        projectId: d.projectId,
        keyword: d.keyword,
        type: d.type || 'brand',
        source: d.source || 'manual',
        frequency: d.frequency || 0,
        relevanceScore: d.relevanceScore || 0,
        language: d.language || 'zh',
        status: d.status || 'active',
        metadata: d.metadata || {},
      })),
      skipDuplicates: true,
    })
    return result.count
  },

  async delete(where: any): Promise<boolean> {
    try {
      await prisma.geoKeyword.delete({ where: extractWhere(where) })
      return true
    } catch {
      return false
    }
  },

  async count(where: any): Promise<number> {
    return prisma.geoKeyword.count({ where: extractWhere(where) })
  },

  async update(where: any, data: any): Promise<any | null> {
    try {
      const keyword = await prisma.geoKeyword.update({ where: extractWhere(where), data })
      return mapPrismaKeyword(keyword)
    } catch {
      return null
    }
  },
}
