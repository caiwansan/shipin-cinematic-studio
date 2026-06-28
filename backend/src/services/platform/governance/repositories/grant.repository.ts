// ============================================================
// CapabilityGrant Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { CapabilityGrantDTO } from '../types.js'

export class GrantRepository {
  async create(data: { planId: string; capability: string; limits?: Record<string, any>; metadata?: Record<string, any> }): Promise<CapabilityGrantDTO> {
    const prisma = getPrisma()
    const grant = await prisma.capabilityGrant.create({
      data: {
        planId: data.planId,
        capability: data.capability,
        limits: data.limits ? JSON.stringify(data.limits) : null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(grant)
  }

  async findByPlan(planId: string): Promise<CapabilityGrantDTO[]> {
    const prisma = getPrisma()
    const grants = await prisma.capabilityGrant.findMany({ where: { planId } })
    return grants.map(this.toDTO)
  }

  async findByPlanAndCapability(planId: string, capability: string): Promise<CapabilityGrantDTO | null> {
    const prisma = getPrisma()
    const grant = await prisma.capabilityGrant.findUnique({
      where: { planId_capability: { planId, capability } },
    })
    return grant ? this.toDTO(grant) : null
  }

  async update(id: string, data: Partial<{ limits: Record<string, any> }>): Promise<CapabilityGrantDTO> {
    const prisma = getPrisma()
    const updateData: any = {}
    if (data.limits) updateData.limits = JSON.stringify(data.limits)
    const grant = await prisma.capabilityGrant.update({ where: { id }, data: updateData })
    return this.toDTO(grant)
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.capabilityGrant.delete({ where: { id } })
  }

  private toDTO(g: any): CapabilityGrantDTO {
    return {
      id: g.id,
      planId: g.planId,
      capability: g.capability,
      limits: g.limits ? JSON.parse(g.limits) : undefined,
      metadata: g.metadata ? JSON.parse(g.metadata) : undefined,
      createdAt: g.createdAt,
    }
  }
}

export const grantRepository = new GrantRepository()
