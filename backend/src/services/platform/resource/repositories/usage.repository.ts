// ============================================================
// Usage Repository — ResourceUsage record keeping
// KMKI-PLAT-008
// ============================================================

import { PrismaClient } from '@prisma/client'
import type { ResourceUsage } from '../types'
import { RepositoryError } from '@platform/errors/platform-errors'

const prisma = new PrismaClient()

export const usageRepository = {
  async create(data: Omit<ResourceUsage, 'id' | 'createdAt'>): Promise<ResourceUsage> {
    try {
      const record = await prisma.resourceUsage.create({ data })
      return record as unknown as ResourceUsage
    } catch (err: any) {
      throw new RepositoryError('Failed to create ResourceUsage', { cause: err.message })
    }
  },

  async findById(id: string): Promise<ResourceUsage | null> {
    try {
      const record = await prisma.resourceUsage.findUnique({ where: { id } })
      return record as unknown as ResourceUsage | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find ResourceUsage', { cause: err.message })
    }
  },

  async listByTenant(tenantId: string, params?: { resourceType?: string; status?: string; limit?: number; offset?: number; startDate?: Date; endDate?: Date }): Promise<{ items: ResourceUsage[]; total: number }> {
    try {
      const where: any = { tenantId }
      if (params?.resourceType) where.resourceType = params.resourceType
      if (params?.status) where.status = params.status
      if (params?.startDate || params?.endDate) {
        where.createdAt = {}
        if (params.startDate) where.createdAt.gte = params.startDate
        if (params.endDate) where.createdAt.lte = params.endDate
      }

      const [items, total] = await Promise.all([
        prisma.resourceUsage.findMany({
          where,
          take: params?.limit || 50,
          skip: params?.offset || 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.resourceUsage.count({ where }),
      ])
      return { items: items as unknown as ResourceUsage[], total }
    } catch (err: any) {
      throw new RepositoryError('Failed to list usage records', { cause: err.message })
    }
  },

  async aggregateByTenant(tenantId: string, startDate: Date, endDate: Date): Promise<{
    totalCost: number
    totalTokens: number
    totalRequests: number
    byType: Record<string, { count: number; cost: number; tokens: number }>
  }> {
    try {
      const records = await prisma.resourceUsage.findMany({
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
      })

      const result = {
        totalCost: 0,
        totalTokens: 0,
        totalRequests: records.length,
        byType: {} as Record<string, { count: number; cost: number; tokens: number }>,
      }

      for (const r of records as unknown as ResourceUsage[]) {
        result.totalCost += r.actualCost || r.estimatedCost || 0
        result.totalTokens += r.totalTokens || 0
        if (!result.byType[r.resourceType]) {
          result.byType[r.resourceType] = { count: 0, cost: 0, tokens: 0 }
        }
        result.byType[r.resourceType].count++
        result.byType[r.resourceType].cost += r.actualCost || r.estimatedCost || 0
        result.byType[r.resourceType].tokens += r.totalTokens || 0
      }

      return result
    } catch (err: any) {
      throw new RepositoryError('Failed to aggregate usage', { cause: err.message })
    }
  },
}
