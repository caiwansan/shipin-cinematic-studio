// ============================================================
// Subscription Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { SubscriptionDTO } from '../types.js'

export class SubscriptionRepository {
  async create(data: {
    tenantId: string; planId: string; status?: string;
    startDate: Date; endDate?: Date; autoRenew?: boolean; metadata?: Record<string, any>
  }): Promise<SubscriptionDTO> {
    const prisma = getPrisma()
    const sub = await prisma.subscription.create({
      data: {
        tenantId: data.tenantId,
        planId: data.planId,
        status: data.status || 'active',
        startDate: data.startDate,
        endDate: data.endDate,
        autoRenew: data.autoRenew ?? false,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(sub)
  }

  async findById(id: string): Promise<SubscriptionDTO | null> {
    const prisma = getPrisma()
    const sub = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } })
    return sub ? this.toDTO(sub) : null
  }

  async findByTenant(tenantId: string, activeOnly = false): Promise<SubscriptionDTO[]> {
    const prisma = getPrisma()
    const where: any = { tenantId }
    if (activeOnly) where.status = 'active'
    const subs = await prisma.subscription.findMany({ where, include: { plan: true }, orderBy: { createdAt: 'desc' } })
    return subs.map(this.toDTO)
  }

  async getActiveSubscription(tenantId: string): Promise<SubscriptionDTO | null> {
    const subs = await this.findByTenant(tenantId, true)
    return subs.length > 0 ? subs[0] : null
  }

  async update(id: string, data: Partial<{ status: string; endDate: Date; autoRenew: boolean }>): Promise<SubscriptionDTO> {
    const prisma = getPrisma()
    const sub = await prisma.subscription.update({ where: { id }, data, include: { plan: true } })
    return this.toDTO(sub)
  }

  async cancel(tenantId: string): Promise<void> {
    const activeSubs = await this.findByTenant(tenantId, true)
    for (const sub of activeSubs) {
      await this.update(sub.id, { status: 'cancelled', endDate: new Date() })
    }
  }

  async renew(tenantId: string, planId: string): Promise<SubscriptionDTO> {
    await this.cancel(tenantId)
    return this.create({
      tenantId,
      planId,
      startDate: new Date(),
      autoRenew: true,
    })
  }

  private toDTO(s: any): SubscriptionDTO {
    return {
      id: s.id,
      tenantId: s.tenantId,
      planId: s.planId,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate || undefined,
      autoRenew: s.autoRenew,
      metadata: s.metadata ? JSON.parse(s.metadata) : undefined,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      plan: s.plan ? {
        id: s.plan.id,
        code: s.plan.code,
        name: s.plan.name,
        description: s.plan.description,
        price: s.plan.price,
        currency: s.plan.currency,
        billingCycle: s.plan.billingCycle,
        capabilities: JSON.parse(s.plan.capabilities),
        schemaVersion: s.plan.schemaVersion,
        status: s.plan.status,
        createdAt: s.plan.createdAt,
        updatedAt: s.plan.updatedAt,
      } : undefined,
    }
  }
}

export const subscriptionRepository = new SubscriptionRepository()
