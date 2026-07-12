// ============================================================
// P0-B.4: Presence Evidence Repository
//
// Plain-object repository (no classes) following the existing
// pattern. Handles DB persistence + dedup for presence evidence.
// ============================================================

import { prisma } from '../../../utils/index'

export interface PresenceEvidenceRecord {
  id: string
  projectId: string
  provider: string
  entity: string
  status: string
  confidence: number
  requestHash: string
  source: string
  checkedAt: Date
  latencyMs: number
  metadata: Record<string, unknown> | null
  createdAt: Date
}

function mapPrismaPresenceEvidence(e: any): PresenceEvidenceRecord {
  return {
    id: e.id,
    projectId: e.projectId,
    provider: e.provider,
    entity: e.entity,
    status: e.status,
    confidence: e.confidence,
    requestHash: e.requestHash,
    source: e.source,
    checkedAt: e.checkedAt,
    latencyMs: e.latencyMs,
    metadata: e.metadata as Record<string, unknown> | null,
    createdAt: e.createdAt,
  }
}

export const presenceRepository = {
  async create(data: {
    projectId: string
    provider: string
    entity: string
    status: string
    confidence: number
    requestHash: string
    source: string
    checkedAt: Date
    latencyMs?: number
    metadata?: Record<string, unknown>
  }): Promise<PresenceEvidenceRecord> {
    const record = await prisma.gEOPresenceEvidence.create({
      data: {
        projectId: data.projectId,
        provider: data.provider,
        entity: data.entity,
        status: data.status,
        confidence: data.confidence,
        requestHash: data.requestHash,
        source: data.source,
        checkedAt: data.checkedAt,
        latencyMs: data.latencyMs ?? 0,
        metadata: (data.metadata ?? {}) as any,
      },
    })
    return mapPrismaPresenceEvidence(record)
  },

  async findLatestByProject(projectId: string, limit = 50): Promise<PresenceEvidenceRecord[]> {
    const records = await prisma.gEOPresenceEvidence.findMany({
      where: { projectId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    })
    return records.map(mapPrismaPresenceEvidence)
  },

  async findRecentByHash(requestHash: string, hours = 24): Promise<PresenceEvidenceRecord | null> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const record = await prisma.gEOPresenceEvidence.findFirst({
      where: {
        requestHash,
        checkedAt: { gte: cutoff },
      },
      orderBy: { checkedAt: 'desc' },
    })
    if (!record) return null
    return mapPrismaPresenceEvidence(record)
  },

  async countByProject(projectId: string): Promise<number> {
    return prisma.gEOPresenceEvidence.count({ where: { projectId } })
  },

  async deleteByProjectId(projectId: string): Promise<number> {
    const result = await prisma.gEOPresenceEvidence.deleteMany({
      where: { projectId },
    })
    return result.count
  },
}
