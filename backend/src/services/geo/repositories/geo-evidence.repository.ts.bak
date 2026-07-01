// ============================================================
// GEO Evidence Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { Evidence } from '../types'

function mapPrismaEvidence(e: any): Evidence {
  return {
    id: e.id,
    claimId: e.claimId,
    source: e.source,
    content: e.content,
    credibilityScore: e.credibilityScore,
    verificationMethod: e.verificationMethod,
    collectedAt: e.collectedAt.toISOString(),
    provenance: typeof e.provenance === 'string' ? JSON.parse(e.provenance) : e.provenance,
    metadata: e.metadata || undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

export const geoEvidenceRepository = {
  async create(data: {
    claimId: string
    source: string
    content: string
    credibilityScore: number
    verificationMethod?: string
    provenance: any
    metadata?: Record<string, unknown>
  }): Promise<Evidence> {
    const evidence = await prisma.gEOEvidence.create({
      data: {
        claimId: data.claimId,
        source: data.source,
        content: data.content,
        credibilityScore: data.credibilityScore,
        verificationMethod: data.verificationMethod || 'llm',
        provenance: data.provenance,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaEvidence(evidence)
  },

  async findById(id: string): Promise<Evidence | null> {
    const evidence = await prisma.gEOEvidence.findUnique({ where: { id } })
    if (!evidence) return null
    return mapPrismaEvidence(evidence)
  },

  async findByClaimId(claimId: string): Promise<Evidence[]> {
    const items = await prisma.gEOEvidence.findMany({
      where: { claimId },
      orderBy: { credibilityScore: 'desc' },
    })
    return items.map(mapPrismaEvidence)
  },

  async listByProjectId(projectId: string): Promise<Evidence[]> {
    const items = await prisma.gEOEvidence.findMany({
      where: {
        claim: { entity: { projectId } },
      },
      orderBy: { credibilityScore: 'desc' },
    })
    return items.map(mapPrismaEvidence)
  },

  async update(id: string, data: Partial<Evidence>): Promise<Evidence | null> {
    const existing = await prisma.gEOEvidence.findUnique({ where: { id } })
    if (!existing) return null

    const evidence = await prisma.gEOEvidence.update({
      where: { id },
      data: {
        source: data.source,
        content: data.content,
        credibilityScore: data.credibilityScore,
        provenance: data.provenance as any,
        metadata: data.metadata as any,
      },
    })
    return mapPrismaEvidence(evidence)
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOEvidence.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },

  async countByClaimId(claimId: string): Promise<number> {
    return prisma.gEOEvidence.count({ where: { claimId } })
  },

  async averageCredibilityByProjectId(projectId: string): Promise<number> {
    const result = await prisma.gEOEvidence.aggregate({
      where: { claim: { entity: { projectId } } },
      _avg: { credibilityScore: true },
    })
    return result._avg.credibilityScore || 0
  },
}
