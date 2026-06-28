// ============================================================
// Health Repository — ResourceHealth read/write
// KMKI-PLAT-008
// ============================================================

import { PrismaClient } from '@prisma/client'
import type { ResourceHealth, HealthStatus } from '../types'
import { RepositoryError } from '@platform/errors/platform-errors'

const prisma = new PrismaClient()

export const healthRepository = {
  async create(data: Omit<ResourceHealth, 'id' | 'checkedAt'>): Promise<ResourceHealth> {
    try {
      const record = await prisma.resourceHealth.create({ data })
      return record as unknown as ResourceHealth
    } catch (err: any) {
      throw new RepositoryError('Failed to create ResourceHealth', { cause: err.message })
    }
  },

  async findLatestByResourceId(resourceId: string): Promise<ResourceHealth | null> {
    try {
      const record = await prisma.resourceHealth.findFirst({
        where: { resourceId },
        orderBy: { checkedAt: 'desc' },
      })
      return record as unknown as ResourceHealth | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find latest health', { cause: err.message })
    }
  },

  async findLatestByCredentialId(credentialId: string): Promise<ResourceHealth | null> {
    try {
      const record = await prisma.resourceHealth.findFirst({
        where: { credentialId },
        orderBy: { checkedAt: 'desc' },
      })
      return record as unknown as ResourceHealth | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find latest health by credential', { cause: err.message })
    }
  },

  async listByResourceId(resourceId: string, limit: number = 20): Promise<ResourceHealth[]> {
    try {
      const records = await prisma.resourceHealth.findMany({
        where: { resourceId },
        orderBy: { checkedAt: 'desc' },
        take: limit,
      })
      return records as unknown as ResourceHealth[]
    } catch (err: any) {
      throw new RepositoryError('Failed to list health records', { cause: err.message })
    }
  },

  async listUnhealthy(status: HealthStatus = 'down'): Promise<ResourceHealth[]> {
    try {
      const records = await prisma.resourceHealth.findMany({
        where: { status },
        orderBy: { checkedAt: 'desc' },
      })
      return records as unknown as ResourceHealth[]
    } catch (err: any) {
      throw new RepositoryError('Failed to list unhealthy resources', { cause: err.message })
    }
  },

  async getAggregatedHealth(): Promise<Record<string, number>> {
    try {
      // Get latest health for each resource
      const all = await prisma.resourceHealth.findMany({
        orderBy: { checkedAt: 'desc' },
      })
      const latest = new Map<string, ResourceHealth>()
      for (const h of all as unknown as ResourceHealth[]) {
        if (!latest.has(h.resourceId)) {
          latest.set(h.resourceId, h)
        }
      }
      const result: Record<string, number> = { healthy: 0, degraded: 0, down: 0, unknown: 0 }
      for (const h of latest.values()) {
        result[h.status] = (result[h.status] || 0) + 1
      }
      result.unknown = result.unknown || 0
      return result
    } catch (err: any) {
      throw new RepositoryError('Failed to aggregate health', { cause: err.message })
    }
  },
}
