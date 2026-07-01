// ============================================================
// GEO Scan History Repository — CRUD for geoScanHistory
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaScan(s: any) {
  return {
    id: s.id,
    projectId: s.projectId,
    scanType: s.scanType,
    status: s.status,
    topic: s.topic || null,
    knowledgeObjectId: s.knowledgeObjectId || null,
    config: s.config || undefined,
    result: s.result || undefined,
    error: s.error || undefined,
    startedAt: s.startedAt?.toISOString() || null,
    completedAt: s.completedAt?.toISOString() || null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }
}

function extractWhere(where: any): any {
  return where.where || where
}

export const geoScanHistoryRepository = {
  async findMany(where: any, orderBy?: any): Promise<any[]> {
    const scans = await prisma.geoScanHistory.findMany({ where: extractWhere(where), orderBy: orderBy || { createdAt: 'desc' } })
    return scans.map(mapPrismaScan)
  },

  async findFirst(where: any, orderBy?: any): Promise<any | null> {
    const scan = await prisma.geoScanHistory.findFirst({ where: extractWhere(where), orderBy: orderBy || { createdAt: 'desc' } })
    if (!scan) return null
    return mapPrismaScan(scan)
  },

  async findUnique(where: any): Promise<any | null> {
    const scan = await prisma.geoScanHistory.findUnique({ where: extractWhere(where) })
    if (!scan) return null
    return mapPrismaScan(scan)
  },

  async create(data: any): Promise<any> {
    const scan = await prisma.geoScanHistory.create({ data })
    return mapPrismaScan(scan)
  },

  async delete(where: any): Promise<boolean> {
    try {
      await prisma.geoScanHistory.delete({ where: extractWhere(where) })
      return true
    } catch {
      return false
    }
  },

  async update(where: any, data: any): Promise<any | null> {
    try {
      const scan = await prisma.geoScanHistory.update({ where: extractWhere(where), data })
      return mapPrismaScan(scan)
    } catch {
      return null
    }
  },

  async count(where: any): Promise<number> {
    return prisma.geoScanHistory.count({ where: extractWhere(where) })
  },
}
