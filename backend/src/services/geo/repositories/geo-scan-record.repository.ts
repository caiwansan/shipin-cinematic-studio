// ============================================================
// GEO Scan Record Repository — Minimal CRUD for gEOScanRecord
// ============================================================

import { prisma } from '../../../utils/index'

export const geoScanRecordRepository = {
  async create(data: any): Promise<any> {
    return prisma.gEOScanRecord.create({ data })
  },

  async findUnique(where: { id: string }): Promise<any | null> {
    return prisma.gEOScanRecord.findUnique({ where })
  },

  async findMany(where?: any, options?: { orderBy?: any; take?: number }): Promise<any[]> {
    return prisma.gEOScanRecord.findMany({ where, ...options })
  },

  async findFirst(where?: any, options?: { orderBy?: any }): Promise<any | null> {
    return prisma.gEOScanRecord.findFirst({ where, ...options })
  },

  async update(where: { id: string }, data: any): Promise<any | null> {
    try {
      return prisma.gEOScanRecord.update({ where, data })
    } catch {
      return null
    }
  },

  async count(where?: any): Promise<number> {
    return prisma.gEOScanRecord.count({ where })
  },
}
