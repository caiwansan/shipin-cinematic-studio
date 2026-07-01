// ============================================================
// GEO Citation Repository — CRUD for gEOCitation
// ============================================================

import { prisma } from '../../../utils/index'

function mapPrismaCitation(c: any) {
  return {
    id: c.id,
    evidenceId: c.evidenceId,
    format: c.format,
    citationText: c.citationText,
    sourceUrl: c.sourceUrl || null,
    publisher: c.publisher || null,
    author: c.author || null,
    datePublished: c.datePublished || null,
    authorityLevel: c.authorityLevel,
    provenance: typeof c.provenance === 'string' ? JSON.parse(c.provenance) : c.provenance,
    metadata: c.metadata || undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

function extractWhere(where: any): any {
  return where.where || where
}

export const geoCitationRepository = {
  async findMany(where: any, orderBy?: any): Promise<any[]> {
    const items = await prisma.gEOCitation.findMany({ where: extractWhere(where), orderBy: orderBy || { createdAt: 'desc' } })
    return items.map(mapPrismaCitation)
  },

  async findUnique(where: any): Promise<any | null> {
    const item = await prisma.gEOCitation.findUnique({ where: extractWhere(where) })
    if (!item) return null
    return mapPrismaCitation(item)
  },

  async create(data: any): Promise<any> {
    const item = await prisma.gEOCitation.create({ data })
    return mapPrismaCitation(item)
  },

  async delete(where: any): Promise<boolean> {
    try {
      await prisma.gEOCitation.delete({ where: extractWhere(where) })
      return true
    } catch {
      return false
    }
  },
}
