// ============================================================
// BillingRecord Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { BillingRecordDTO } from '../types.js'

export class BillingRepository {
  async record(data: {
    tenantId: string; type: string; amount: number; currency?: string;
    description?: string; source: string; metadata?: Record<string, any>
  }): Promise<BillingRecordDTO> {
    const prisma = getPrisma()
    const record = await prisma.billingRecord.create({
      data: {
        tenantId: data.tenantId,
        type: data.type,
        amount: data.amount,
        currency: data.currency || 'USD',
        description: data.description,
        source: data.source,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(record)
  }

  async findByTenant(tenantId: string, options?: {
    fromDate?: Date; toDate?: Date; type?: string; limit?: number; offset?: number
  }): Promise<BillingRecordDTO[]> {
    const prisma = getPrisma()
    const where: any = { tenantId }
    if (options?.fromDate || options?.toDate) {
      where.createdAt = {}
      if (options?.fromDate) where.createdAt.gte = options.fromDate
      if (options?.toDate) where.createdAt.lte = options.toDate
    }
    if (options?.type) where.type = options.type
    const records = await prisma.billingRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    })
    return records.map(this.toDTO)
  }

  async getTotalCost(tenantId: string, fromDate: Date, toDate: Date): Promise<number> {
    const prisma = getPrisma()
    const result = await prisma.billingRecord.aggregate({
      where: {
        tenantId,
        createdAt: { gte: fromDate, lte: toDate },
        type: { in: ['usage', 'overage', 'subscription'] },
      },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0
  }

  private toDTO(r: any): BillingRecordDTO {
    return {
      id: r.id,
      tenantId: r.tenantId,
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      description: r.description || undefined,
      source: r.source,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.createdAt,
    }
  }
}

export const billingRepository = new BillingRepository()
