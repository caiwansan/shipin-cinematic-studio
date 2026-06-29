// ============================================================
// GEO Citation Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { Citation } from '../types'

function mapPrismaCitation(c: any): Citation {
  return {
    id: c.id,
    evidenceId: c.evidenceId,
    format: c.format,
    citationText: c.citationText,
    sourceUrl: c.sourceUrl || undefined,
    publisher: c.publisher || undefined,
    author: c.author || undefined,
    datePublished: c.datePublished || undefined,
    authorityLevel: c.authorityLevel || 'news',
    provenance: typeof c.provenance === 'string' ? JSON.parse(c.provenance) : c.provenance,
    metadata: c.metadata || undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

export const geoCitationRepository = {
  async create(data: {
    evidenceId: string
    format: string
    citationText: string
    sourceUrl?: string
    publisher?: string
    author?: string
    datePublished?: string
    authorityLevel?: string
    provenance: any
    metadata?: Record<string, unknown>
  }): Promise<Citation> {
    const citation = await prisma.gEOCitation.create({
      data: {
        evidenceId: data.evidenceId,
        format: data.format,
        citationText: data.citationText,
        sourceUrl: data.sourceUrl || null,
        publisher: data.publisher || null,
        author: data.author || null,
        datePublished: data.datePublished || null,
        authorityLevel: data.authorityLevel || 'news',
        provenance: data.provenance,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaCitation(citation)
  },

  async findById(id: string): Promise<Citation | null> {
    const citation = await prisma.gEOCitation.findUnique({ where: { id } })
    if (!citation) return null
    return mapPrismaCitation(citation)
  },

  async findByEvidenceId(evidenceId: string): Promise<Citation[]> {
    const items = await prisma.gEOCitation.findMany({
      where: { evidenceId },
    })
    return items.map(mapPrismaCitation)
  },

  async update(id: string, data: Partial<Citation>): Promise<Citation | null> {
    const existing = await prisma.gEOCitation.findUnique({ where: { id } })
    if (!existing) return null

    const citation = await prisma.gEOCitation.update({
      where: { id },
      data: {
        format: data.format,
        citationText: data.citationText,
        sourceUrl: data.sourceUrl,
        publisher: data.publisher,
        author: data.author,
        datePublished: data.datePublished,
        provenance: data.provenance as any,
        metadata: data.metadata as any,
      },
    })
    return mapPrismaCitation(citation)
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOCitation.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },

  async countByEvidenceId(evidenceId: string): Promise<number> {
    return prisma.gEOCitation.count({ where: { evidenceId } })
  },
}
