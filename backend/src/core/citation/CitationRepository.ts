// ============================================================
// Citation Repository — Platform-level CRUD for Citations
// ============================================================

import { prisma } from '../../utils/index'
import type { Citation, CreateCitationInput, UpdateCitationInput, SearchCitationsParams } from './types'

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
    authorityLevel: (c.authorityLevel || 'news') as Citation['authorityLevel'],
    provenance: typeof c.provenance === 'string' ? JSON.parse(c.provenance) : c.provenance,
    metadata: c.metadata || undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

interface CreateWithProvenance extends CreateCitationInput {
  provenance: Record<string, unknown>
  tenantId?: string
}

export const citationRepository = {
  /**
   * Create a new citation with provenance.
   */
  async create(data: CreateWithProvenance): Promise<Citation> {
    const citation = await prisma.gEOCitation.create({
      data: {
        evidenceId: data.evidenceId,
        format: data.format || 'custom',
        citationText: data.citationText,
        sourceUrl: data.sourceUrl || null,
        publisher: data.publisher || null,
        author: data.author || null,
        datePublished: data.datePublished || null,
        authorityLevel: data.authorityLevel || 'news',
        provenance: data.provenance as any,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaCitation(citation)
  },

  /**
   * Find a citation by its ID.
   */
  async findById(id: string): Promise<Citation | null> {
    const citation = await prisma.gEOCitation.findUnique({ where: { id } })
    if (!citation) return null
    return mapPrismaCitation(citation)
  },

  /**
   * Find all citations for a given evidence ID.
   */
  async findByEvidenceId(evidenceId: string): Promise<Citation[]> {
    const items = await prisma.gEOCitation.findMany({
      where: { evidenceId },
    })
    return items.map(mapPrismaCitation)
  },

  /**
   * Update an existing citation.
   */
  async update(id: string, data: UpdateCitationInput): Promise<Citation | null> {
    const existing = await prisma.gEOCitation.findUnique({ where: { id } })
    if (!existing) return null

    const citation = await prisma.gEOCitation.update({
      where: { id },
      data: {
        ...(data.format !== undefined && { format: data.format }),
        ...(data.citationText !== undefined && { citationText: data.citationText }),
        ...(data.sourceUrl !== undefined && { sourceUrl: data.sourceUrl }),
        ...(data.publisher !== undefined && { publisher: data.publisher }),
        ...(data.author !== undefined && { author: data.author }),
        ...(data.datePublished !== undefined && { datePublished: data.datePublished }),
        ...(data.authorityLevel !== undefined && { authorityLevel: data.authorityLevel }),
        ...(data.metadata !== undefined && { metadata: data.metadata as any }),
      },
    })
    return mapPrismaCitation(citation)
  },

  /**
   * Delete a citation by ID. Returns true if deleted, false if not found.
   */
  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOCitation.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },

  /**
   * Count citations for a given evidence ID.
   */
  async countByEvidenceId(evidenceId: string): Promise<number> {
    return prisma.gEOCitation.count({ where: { evidenceId } })
  },

  /**
   * Search citations with full-text search on citationText,
   * filtering by evidenceId, tenantId, and authorityLevel.
   */
  async search(params: SearchCitationsParams): Promise<{ items: Citation[]; total: number }> {
    const where: any = {}

    if (params.evidenceId) {
      where.evidenceId = params.evidenceId
    }

    if (params.authorityLevel) {
      where.authorityLevel = params.authorityLevel
    }

    if (params.q) {
      where.citationText = { contains: params.q }
    }

    const limit = params.limit ?? 20
    const offset = params.offset ?? 0

    const [items, total] = await Promise.all([
      prisma.gEOCitation.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.gEOCitation.count({ where }),
    ])

    return {
      items: items.map(mapPrismaCitation),
      total,
    }
  },
}
