// ============================================================
// GovOrganization Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { GovOrganizationDTO } from '../types.js'

export class GovOrganizationRepository {
  async create(data: { tenantId: string; name: string; type: string; parentId?: string; metadata?: Record<string, any> }): Promise<GovOrganizationDTO> {
    const prisma = getPrisma()
    const org = await prisma.govOrganization.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        type: data.type,
        parentId: data.parentId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(org)
  }

  async findById(id: string): Promise<GovOrganizationDTO | null> {
    const prisma = getPrisma()
    const org = await prisma.govOrganization.findUnique({ where: { id } })
    return org ? this.toDTO(org) : null
  }

  async findByTenant(tenantId: string): Promise<GovOrganizationDTO[]> {
    const prisma = getPrisma()
    const orgs = await prisma.govOrganization.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
    return orgs.map(this.toDTO)
  }

  async getTree(orgId: string): Promise<GovOrganizationDTO[]> {
    const org = await this.findById(orgId)
    if (!org) return []
    const prisma = getPrisma()
    const children = await prisma.govOrganization.findMany({
      where: { parentId: orgId },
      orderBy: { createdAt: 'asc' },
    })
    const result: GovOrganizationDTO[] = [org]
    for (const child of children) {
      const subtree = await this.getTree(child.id)
      result.push(...subtree)
    }
    return result
  }

  async update(id: string, data: Partial<{ name: string; status: string; parentId: string }>): Promise<GovOrganizationDTO> {
    const prisma = getPrisma()
    const org = await prisma.govOrganization.update({ where: { id }, data })
    return this.toDTO(org)
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.govOrganization.delete({ where: { id } })
  }

  private toDTO(o: any): GovOrganizationDTO {
    return {
      id: o.id,
      tenantId: o.tenantId,
      name: o.name,
      type: o.type,
      parentId: o.parentId || undefined,
      status: o.status,
      metadata: o.metadata ? JSON.parse(o.metadata) : undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }
  }
}

export const govOrganizationRepository = new GovOrganizationRepository()
