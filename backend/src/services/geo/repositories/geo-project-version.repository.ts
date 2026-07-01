// ============================================================
// GEO Project Version Repository — CRUD for GEOProjectVersion
// ============================================================

import { prisma } from '../../../utils/index'

export const geoProjectVersionRepository = {
  async findFirst(where: any, orderBy?: any): Promise<any | null> {
    return prisma.gEOProjectVersion.findFirst({ where, orderBy: orderBy || { version: 'desc' } })
  },

  async findUnique(where: any): Promise<any | null> {
    return prisma.gEOProjectVersion.findUnique({ where })
  },

  async create(data: any): Promise<any> {
    return prisma.gEOProjectVersion.create({ data })
  },
}
