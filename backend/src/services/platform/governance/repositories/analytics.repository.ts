// ============================================================
// AnalyticsDaily Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { AnalyticsDailyDTO } from '../types.js'

export class AnalyticsRepository {
  async upsert(data: {
    tenantId: string; date: Date; metric: string; value: number; metadata?: Record<string, any>
  }): Promise<AnalyticsDailyDTO> {
    const prisma = getPrisma()
    const record = await prisma.analyticsDaily.upsert({
      where: {
        tenantId_date_metric: {
          tenantId: data.tenantId,
          date: data.date,
          metric: data.metric,
        },
      },
      create: {
        tenantId: data.tenantId,
        date: data.date,
        metric: data.metric,
        value: data.value,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
      update: {
        value: data.value,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(record)
  }

  async findByTenantAndPeriod(tenantId: string, metric: string, fromDate: Date, toDate: Date): Promise<AnalyticsDailyDTO[]> {
    const prisma = getPrisma()
    const records = await prisma.analyticsDaily.findMany({
      where: {
        tenantId,
        metric,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: { date: 'asc' },
    })
    return records.map(this.toDTO)
  }

  async getTopCapabilities(tenantId: string, fromDate: Date, toDate: Date, limit = 10): Promise<Array<{ capability: string; count: number }>> {
    const prisma = getPrisma()
    const records = await prisma.usageRecord.groupBy({
      by: ['capability'],
      where: {
        tenantId,
        recordedAt: { gte: fromDate, lte: toDate },
        capability: { not: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    })
    return records.map((r: any) => ({
      capability: r.capability!,
      count: r._sum.amount ?? 0,
    }))
  }

  private toDTO(r: any): AnalyticsDailyDTO {
    return {
      id: r.id,
      tenantId: r.tenantId,
      date: r.date,
      metric: r.metric,
      value: r.value,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.createdAt,
    }
  }
}

export const analyticsRepository = new AnalyticsRepository()
