// ============================================================
// Tenant Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { TenantDTO, CreateTenantInput } from '../types.js'

export class TenantRepository {
  async create(input: CreateTenantInput): Promise<TenantDTO> {
    const prisma = getPrisma()
    const tenant = await prisma.tenant.create({
      data: {
        name: input.name,
        type: input.type,
        status: 'active',
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    })
    return this.toDTO(tenant)
  }

  async findById(id: string): Promise<TenantDTO | null> {
    const prisma = getPrisma()
    const tenant = await prisma.tenant.findUnique({ where: { id } })
    return tenant ? this.toDTO(tenant) : null
  }

  async findAll(): Promise<TenantDTO[]> {
    const prisma = getPrisma()
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
    return tenants.map(this.toDTO)
  }

  async update(id: string, data: Partial<CreateTenantInput & { status: string }>): Promise<TenantDTO> {
    const prisma = getPrisma()
    const updateData: any = { ...data }
    if (data.metadata) updateData.metadata = JSON.stringify(data.metadata)
    const tenant = await prisma.tenant.update({ where: { id }, data: updateData })
    return this.toDTO(tenant)
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.tenant.delete({ where: { id } })
  }

  private toDTO(t: any): TenantDTO {
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      metadata: t.metadata ? JSON.parse(t.metadata) : undefined,
      schemaVersion: t.schemaVersion,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }
  }
}

export const tenantRepository = new TenantRepository()
