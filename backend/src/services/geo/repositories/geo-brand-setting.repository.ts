// ============================================================
// GEO Brand Setting Repository — CRUD for geoBrandSetting
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaSetting(s: any) {
  return {
    id: s.id,
    projectId: s.projectId,
    brandName: s.brandName,
    website: s.website,
    industry: s.industry,
    region: s.region,
    language: s.language,
    description: s.description,
    logo: s.logo || null,
    status: s.status || 'active',
    config: s.config || undefined,
    metadata: s.metadata || undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

function extractWhere(where: any): any {
  return where.where || where
}

export const geoBrandSettingRepository = {
  async findMany(where: any): Promise<any[]> {
    const items = await prisma.geoBrandSetting.findMany({ where: extractWhere(where) })
    return items.map(mapPrismaSetting)
  },

  async findUnique(where: any): Promise<any | null> {
    const item = await prisma.geoBrandSetting.findUnique({ where: extractWhere(where) })
    if (!item) return null
    return mapPrismaSetting(item)
  },

  async create(data: any): Promise<any> {
    const item = await prisma.geoBrandSetting.create({ data })
    return mapPrismaSetting(item)
  },

  async update(where: any, data: any): Promise<any | null> {
    try {
      const item = await prisma.geoBrandSetting.update({ where: extractWhere(where), data })
      return mapPrismaSetting(item)
    } catch {
      return null
    }
  },

  async findFirst(where: any): Promise<any | null> {
    const item = await prisma.geoBrandSetting.findFirst({ where: extractWhere(where) })
    if (!item) return null
    return mapPrismaSetting(item)
  },
}
