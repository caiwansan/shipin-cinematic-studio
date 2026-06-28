// ============================================================
// Policy Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { PolicyDTO } from '../types.js'

export class PolicyRepository {
  async create(data: {
    code: string; name: string; type: string; rules: Record<string, any>;
    tenantId?: string; enabled?: boolean; priority?: number; metadata?: Record<string, any>
  }): Promise<PolicyDTO> {
    const prisma = getPrisma()
    const policy = await prisma.policy.create({
      data: {
        tenantId: data.tenantId,
        code: data.code,
        name: data.name,
        type: data.type,
        rules: JSON.stringify(data.rules),
        enabled: data.enabled ?? true,
        priority: data.priority ?? 0,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(policy)
  }

  async findById(id: string): Promise<PolicyDTO | null> {
    const prisma = getPrisma()
    const policy = await prisma.policy.findUnique({ where: { id } })
    return policy ? this.toDTO(policy) : null
  }

  async findByCode(code: string): Promise<PolicyDTO | null> {
    const prisma = getPrisma()
    const policy = await prisma.policy.findUnique({ where: { code } })
    return policy ? this.toDTO(policy) : null
  }

  async findActiveByTenant(tenantId: string): Promise<PolicyDTO[]> {
    const prisma = getPrisma()
    const policies = await prisma.policy.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        enabled: true,
      },
      orderBy: { priority: 'desc' },
    })
    return policies.map(this.toDTO)
  }

  async findGlobalPolicies(): Promise<PolicyDTO[]> {
    const prisma = getPrisma()
    const policies = await prisma.policy.findMany({
      where: { tenantId: null, enabled: true },
      orderBy: { priority: 'desc' },
    })
    return policies.map(this.toDTO)
  }

  async update(id: string, data: Partial<{ name: string; rules: Record<string, any>; enabled: boolean; priority: number }>): Promise<PolicyDTO> {
    const prisma = getPrisma()
    const updateData: any = { ...data }
    if (data.rules) updateData.rules = JSON.stringify(data.rules)
    const policy = await prisma.policy.update({ where: { id }, data: updateData })
    return this.toDTO(policy)
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.policy.delete({ where: { id } })
  }

  private toDTO(p: any): PolicyDTO {
    return {
      id: p.id,
      tenantId: p.tenantId || undefined,
      code: p.code,
      name: p.name,
      type: p.type,
      rules: JSON.parse(p.rules),
      enabled: p.enabled,
      priority: p.priority,
      metadata: p.metadata ? JSON.parse(p.metadata) : undefined,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  }
}

export const policyRepository = new PolicyRepository()
