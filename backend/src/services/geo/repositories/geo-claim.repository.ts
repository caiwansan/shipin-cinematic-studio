// ============================================================
// GEO Claim Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { Claim } from '../types'

function mapPrismaClaim(c: any): Claim {
  return {
    id: c.id,
    entityId: c.entityId,
    text: c.text,
    claimType: c.claimType,
    confidence: c.confidence,
    sourceType: c.sourceType,
    status: c.status,
    provenance: typeof c.provenance === 'string' ? JSON.parse(c.provenance) : c.provenance,
    metadata: c.metadata || undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

export const geoClaimRepository = {
  async create(data: {
    entityId: string
    text: string
    claimType?: string
    confidence: number
    sourceType: string
    status?: string
    provenance: any
    metadata?: Record<string, unknown>
  }): Promise<Claim> {
    const claim = await prisma.gEOClaim.create({
      data: {
        entityId: data.entityId,
        text: data.text,
        claimType: data.claimType || 'fact',
        confidence: data.confidence,
        sourceType: data.sourceType,
        status: data.status || 'draft',
        provenance: data.provenance,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaClaim(claim)
  },

  async findById(id: string): Promise<Claim | null> {
    const claim = await prisma.gEOClaim.findUnique({ where: { id } })
    if (!claim) return null
    return mapPrismaClaim(claim)
  },

  async findByEntityId(entityId: string): Promise<Claim[]> {
    const claims = await prisma.gEOClaim.findMany({
      where: { entityId },
      orderBy: { confidence: 'desc' },
    })
    return claims.map(mapPrismaClaim)
  },

  async findByStatus(status: string): Promise<Claim[]> {
    const claims = await prisma.gEOClaim.findMany({
      where: { status },
      orderBy: { updatedAt: 'desc' },
    })
    return claims.map(mapPrismaClaim)
  },

  async listByProjectId(projectId: string): Promise<Claim[]> {
    // Claims are linked to entities which are linked to projects
    const claims = await prisma.gEOClaim.findMany({
      where: {
        entity: { projectId },
      },
      orderBy: { confidence: 'desc' },
    })
    return claims.map(mapPrismaClaim)
  },

  async update(id: string, data: Partial<Claim>): Promise<Claim | null> {
    const existing = await prisma.gEOClaim.findUnique({ where: { id } })
    if (!existing) return null

    const claim = await prisma.gEOClaim.update({
      where: { id },
      data: {
        text: data.text,
        claimType: data.claimType,
        confidence: data.confidence,
        sourceType: data.sourceType,
        status: data.status,
        provenance: data.provenance as any,
        metadata: data.metadata as any,
      },
    })
    return mapPrismaClaim(claim)
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOClaim.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },

  async countByEntityId(entityId: string): Promise<number> {
    return prisma.gEOClaim.count({ where: { entityId } })
  },

  async countByStatus(projectId: string, status: string): Promise<number> {
    return prisma.gEOClaim.count({
      where: {
        status,
        entity: { projectId },
      },
    })
  },
}
