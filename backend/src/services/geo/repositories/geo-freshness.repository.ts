// ============================================================
// GEO Freshness Record Repository — Sprint 1B Knowledge Quality
// ============================================================

import { prisma } from '../../../utils/index'
import type { FreshnessRecord } from '../types'

function mapPrismaFreshness(f: any): FreshnessRecord {
  return {
    id: f.id,
    projectId: f.projectId,
    objectType: f.objectType,
    objectId: f.objectId,
    freshnessState: f.freshnessState,
    verificationState: f.verificationState,
    lastChecked: f.lastChecked.toISOString(),
    lastVerifiedAt: f.lastVerifiedAt?.toISOString() || undefined,
    nextReviewAt: f.nextReviewAt?.toISOString() || undefined,
    ttlSeconds: f.ttlSeconds,
    checkCount: f.checkCount,
    metadata: f.metadata || undefined,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  }
}

export const geoFreshnessRepository = {
  async create(data: {
    projectId: string
    objectType: string
    objectId: string
    freshnessState?: string
    verificationState?: string
    ttlSeconds?: number
    nextReviewAt?: Date
    metadata?: Record<string, unknown>
  }): Promise<FreshnessRecord> {
    const record = await prisma.gEOFreshnessRecord.create({
      data: {
        projectId: data.projectId,
        objectType: data.objectType,
        objectId: data.objectId,
        freshnessState: data.freshnessState || 'fresh',
        verificationState: data.verificationState || 'pending',
        ttlSeconds: data.ttlSeconds || 604800,
        nextReviewAt: data.nextReviewAt || null,
        metadata: (data.metadata || {}) as any,
      },
    })
    return mapPrismaFreshness(record)
  },

  async findById(id: string): Promise<FreshnessRecord | null> {
    const r = await prisma.gEOFreshnessRecord.findUnique({ where: { id } })
    if (!r) return null
    return mapPrismaFreshness(r)
  },

  async findByObject(objectType: string, objectId: string): Promise<FreshnessRecord | null> {
    const r = await prisma.gEOFreshnessRecord.findFirst({
      where: { objectType, objectId },
    })
    if (!r) return null
    return mapPrismaFreshness(r)
  },

  async findByProjectId(projectId: string): Promise<FreshnessRecord[]> {
    const records = await prisma.gEOFreshnessRecord.findMany({
      where: { projectId },
      orderBy: { lastChecked: 'asc' },
    })
    return records.map(mapPrismaFreshness)
  },

  async findByState(projectId: string, freshnessState: string): Promise<FreshnessRecord[]> {
    const records = await prisma.gEOFreshnessRecord.findMany({
      where: { projectId, freshnessState },
    })
    return records.map(mapPrismaFreshness)
  },

  async updateState(id: string, state: string): Promise<FreshnessRecord | null> {
    const existing = await prisma.gEOFreshnessRecord.findUnique({ where: { id } })
    if (!existing) return null

    const r = await prisma.gEOFreshnessRecord.update({
      where: { id },
      data: {
        freshnessState: state,
        lastChecked: new Date(),
        checkCount: { increment: 1 },
      },
    })
    return mapPrismaFreshness(r)
  },

  async verify(id: string, verified: boolean): Promise<FreshnessRecord | null> {
    const existing = await prisma.gEOFreshnessRecord.findUnique({ where: { id } })
    if (!existing) return null

    const now = new Date()
    const r = await prisma.gEOFreshnessRecord.update({
      where: { id },
      data: {
        verificationState: verified ? 'verified' : 'verification_failed',
        lastVerifiedAt: now,
        lastChecked: now,
        checkCount: { increment: 1 },
      },
    })
    return mapPrismaFreshness(r)
  },

  async checkAndUpdate(projectId: string): Promise<{ stale: number; expired: number }> {
    const now = new Date()

    // Find records that have exceeded their TTL
    const records = await prisma.gEOFreshnessRecord.findMany({
      where: { projectId },
    })

    let stale = 0
    let expired = 0

    for (const r of records) {
      const elapsed = (now.getTime() - r.lastChecked.getTime()) / 1000
      if (elapsed > r.ttlSeconds * 2) {
        // Exceeded 2x TTL → expired
        await prisma.gEOFreshnessRecord.update({
          where: { id: r.id },
          data: { freshnessState: 'expired' },
        })
        expired++
      } else if (elapsed > r.ttlSeconds) {
        // Exceeded TTL → stale
        await prisma.gEOFreshnessRecord.update({
          where: { id: r.id },
          data: { freshnessState: 'stale' },
        })
        stale++
      }
    }

    return { stale, expired }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.gEOFreshnessRecord.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  },
}
