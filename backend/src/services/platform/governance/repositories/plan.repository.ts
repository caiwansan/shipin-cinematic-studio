// ============================================================
// SubscriptionPlan Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { SubscriptionPlanDTO } from '../types.js'

export class PlanRepository {
  async create(data: {
    code: string; name: string; description?: string; price?: number;
    currency?: string; billingCycle: string; capabilities: Record<string, any>;
    metadata?: Record<string, any>
  }): Promise<SubscriptionPlanDTO> {
    const prisma = getPrisma()
    const plan = await prisma.subscriptionPlan.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        price: data.price,
        currency: data.currency || 'USD',
        billingCycle: data.billingCycle,
        capabilities: JSON.stringify(data.capabilities),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(plan)
  }

  async findById(id: string): Promise<SubscriptionPlanDTO | null> {
    const prisma = getPrisma()
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } })
    return plan ? this.toDTO(plan) : null
  }

  async findByCode(code: string): Promise<SubscriptionPlanDTO | null> {
    const prisma = getPrisma()
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code } })
    return plan ? this.toDTO(plan) : null
  }

  async findAll(activeOnly = false): Promise<SubscriptionPlanDTO[]> {
    const prisma = getPrisma()
    const where = activeOnly ? { status: 'active' as const } : {}
    const plans = await prisma.subscriptionPlan.findMany({ where, orderBy: { createdAt: 'asc' } })
    return plans.map(this.toDTO)
  }

  async update(id: string, data: Partial<SubscriptionPlanDTO>): Promise<SubscriptionPlanDTO> {
    const prisma = getPrisma()
    const updateData: any = { ...data }
    if (data.capabilities) updateData.capabilities = JSON.stringify(data.capabilities)
    const plan = await prisma.subscriptionPlan.update({ where: { id }, data: updateData })
    return this.toDTO(plan)
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.subscriptionPlan.delete({ where: { id } })
  }

  async getRecommendedPlans(): Promise<SubscriptionPlanDTO[]> {
    const prisma = getPrisma()
    const plans = await prisma.subscriptionPlan.findMany({
      where: { status: 'active' },
      orderBy: { price: 'asc' },
    })
    return plans.map(this.toDTO)
  }

  private toDTO(p: any): SubscriptionPlanDTO {
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description || undefined,
      price: p.price || undefined,
      currency: p.currency,
      billingCycle: p.billingCycle,
      capabilities: JSON.parse(p.capabilities),
      metadata: p.metadata ? JSON.parse(p.metadata) : undefined,
      schemaVersion: p.schemaVersion,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  }
}

export const planRepository = new PlanRepository()
