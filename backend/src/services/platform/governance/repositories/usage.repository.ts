// ============================================================
// UsageRecord Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { UsageRecordDTO } from '../types.js'

export class UsageRepository {
  async record(data: {
    tenantId: string; resourceType: string; amount: number; unit: string;
    capability?: string; source: string; sourceId?: string; metadata?: Record<string, any>
  }): Promise<UsageRecordDTO> {
    const prisma = getPrisma()
    const record = await prisma.usageRecord.create({
      data: {
        tenantId: data.tenantId,
        resourceType: data.resourceType,
        amount: data.amount,
        unit: data.unit,
        capability: data.capability,
        source: data.source,
        sourceId: data.sourceId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(record)
  }

  async findByTenant(tenantId: string, options?: {
    fromDate?: Date; toDate?: Date; resourceType?: string; limit?: number; offset?: number
  }): Promise<UsageRecordDTO[]> {
    const prisma = getPrisma()
    const where: any = { tenantId }
    if (options?.fromDate || options?.toDate) {
      where.recordedAt = {}
      if (options?.fromDate) where.recordedAt.gte = options.fromDate
      if (options?.toDate) where.recordedAt.lte = options.toDate
    }
    if (options?.resourceType) where.resourceType = options.resourceType
    const records = await prisma.usageRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    })
    return records.map(this.toDTO)
  }

  async getDailyTotal(tenantId: string, date: Date, resourceType: string): Promise<number> {
    const prisma = getPrisma()
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    const result = await prisma.usageRecord.aggregate({
      where: {
        tenantId,
        resourceType,
        recordedAt: { gte: startOfDay, lte: endOfDay },
      },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0
  }

  async getMonthlyTotal(tenantId: string, year: number, month: number, resourceType: string): Promise<number> {
    const prisma = getPrisma()
    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)
    const result = await prisma.usageRecord.aggregate({
      where: {
        tenantId,
        resourceType,
        recordedAt: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0
  }

  private toDTO(r: any): UsageRecordDTO {
    return {
      id: r.id,
      tenantId: r.tenantId,
      resourceType: r.resourceType,
      amount: r.amount,
      unit: r.unit,
      capability: r.capability || undefined,
      source: r.source,
      sourceId: r.sourceId || undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      recordedAt: r.recordedAt,
    }
  }
}

export const usageRepository = new UsageRepository()
