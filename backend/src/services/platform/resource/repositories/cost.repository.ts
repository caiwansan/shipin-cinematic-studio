// ============================================================
// Cost Repository — ResourceCost aggregation
// KMKI-PLAT-008
// ============================================================

import { PrismaClient } from '@prisma/client'
import type { ResourceCost } from '../types'
import { RepositoryError } from '@platform/errors/platform-errors'

const prisma = new PrismaClient()

export const costRepository = {
  async upsert(data: {
    resourceId: string
    tenantId: string
    workspaceId?: string
    billingPeriod: string
    totalCost: number
    currency: string
    periodStart: Date
    periodEnd: Date
    metadata?: string
  }): Promise<ResourceCost> {
    try {
      const record = await prisma.resourceCost.upsert({
        where: {
          resourceId_tenantId_workspaceId_billingPeriod_periodStart: {
            resourceId: data.resourceId,
            tenantId: data.tenantId,
            workspaceId: data.workspaceId || '',
            billingPeriod: data.billingPeriod,
            periodStart: data.periodStart,
          },
        },
        create: data,
        update: { totalCost: data.totalCost, metadata: data.metadata },
      })
      return record as unknown as ResourceCost
    } catch (err: any) {
      throw new RepositoryError('Failed to upsert ResourceCost', { cause: err.message })
    }
  },

  async findByTenant(tenantId: string, params?: { workspaceId?: string; billingPeriod?: string; limit?: number; offset?: number }): Promise<{ items: ResourceCost[]; total: number }> {
    try {
      const where: any = { tenantId }
      if (params?.workspaceId) where.workspaceId = params.workspaceId
      if (params?.billingPeriod) where.billingPeriod = params.billingPeriod

      const [items, total] = await Promise.all([
        prisma.resourceCost.findMany({
          where,
          take: params?.limit || 50,
          skip: params?.offset || 0,
          orderBy: { periodStart: 'desc' },
        }),
        prisma.resourceCost.count({ where }),
      ])
      return { items: items as unknown as ResourceCost[], total }
    } catch (err: any) {
      throw new RepositoryError('Failed to list cost records', { cause: err.message })
    }
  },

  async getTotalCost(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      const records = await prisma.resourceCost.findMany({
        where: {
          tenantId,
          periodStart: { gte: startDate },
          periodEnd: { lte: endDate },
        },
      })
      return records.reduce((sum: number, r: any) => sum + r.totalCost, 0)
    } catch (err: any) {
      throw new RepositoryError('Failed to calculate total cost', { cause: err.message })
    }
  },

  async getMonthlyCostBreakdown(tenantId: string, year: number, month: number): Promise<Array<{ resourceId: string; resourceName: string; totalCost: number }>> {
    try {
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0, 23, 59, 59)

      const records = await prisma.resourceCost.findMany({
        where: {
          tenantId,
          periodStart: { gte: startDate },
          periodEnd: { lte: endDate },
        },
      })

      // Group by resourceId
      const grouped: Record<string, number> = {}
      for (const r of records as unknown as ResourceCost[]) {
        grouped[r.resourceId] = (grouped[r.resourceId] || 0) + r.totalCost
      }

      return Object.entries(grouped).map(([resourceId, totalCost]) => ({
        resourceId,
        resourceName: resourceId,
        totalCost,
      }))
    } catch (err: any) {
      throw new RepositoryError('Failed to get monthly breakdown', { cause: err.message })
    }
  },
}
