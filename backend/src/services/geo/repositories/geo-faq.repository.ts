// ============================================================
// GEO FAQ Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { FAQ } from '../types'

function mapPrismaFAQ(f: any): FAQ {
  return {
    id: f.id,
    entityId: f.entityId,
    question: f.question,
    answer: f.answer,
    schemaType: f.schemaType,
    confidence: f.confidence,
    status: f.status,
    provenance: typeof f.provenance === 'string' ? JSON.parse(f.provenance) : f.provenance,
    metadata: f.metadata || undefined,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }
}

export const geoFAQRepository = {
  async create(data: {
    entityId: string
    question: string
    answer: string
    schemaType?: string
    confidence: number
    status?: string
    provenance: any
    metadata?: Record<string, unknown>
  }): Promise<FAQ> {
    const faq = await prisma.gEOFAQ.create({
      data: {
        entityId: data.entityId,
        question: data.question,
        answer: data.answer,
        schemaType: data.schemaType || 'FAQPage',
        confidence: data.confidence,
        status: data.status || 'draft',
        provenance: data.provenance,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaFAQ(faq)
  },

  async findById(id: string): Promise<FAQ | null> {
    const faq = await prisma.gEOFAQ.findUnique({ where: { id } })
    if (!faq) return null
    return mapPrismaFAQ(faq)
  },

  async findByEntityId(entityId: string): Promise<FAQ[]> {
    const items = await prisma.gEOFAQ.findMany({
      where: { entityId },
      orderBy: { confidence: 'desc' },
    })
    return items.map(mapPrismaFAQ)
  },

  async listByProjectId(projectId: string): Promise<FAQ[]> {
    const items = await prisma.gEOFAQ.findMany({
      where: { entity: { projectId } },
      orderBy: { confidence: 'desc' },
    })
    return items.map(mapPrismaFAQ)
  },

  async update(id: string, data: Partial<FAQ>): Promise<FAQ | null> {
    const existing = await prisma.gEOFAQ.findUnique({ where: { id } })
    if (!existing) return null

    const faq = await prisma.gEOFAQ.update({
      where: { id },
      data: {
        question: data.question,
        answer: data.answer,
        schemaType: data.schemaType,
        confidence: data.confidence,
        status: data.status,
        provenance: data.provenance as any,
        metadata: data.metadata as any,
      },
    })
    return mapPrismaFAQ(faq)
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOFAQ.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },

  async countByEntityId(entityId: string): Promise<number> {
    return prisma.gEOFAQ.count({ where: { entityId } })
  },
}
