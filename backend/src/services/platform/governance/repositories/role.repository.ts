// ============================================================
// Role Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { RoleDTO } from '../types.js'

export class RoleRepository {
  async create(data: { tenantId: string; code: string; name: string; description?: string; capabilities: string[]; metadata?: Record<string, any> }): Promise<RoleDTO> {
    const prisma = getPrisma()
    const role = await prisma.role.create({
      data: {
        tenantId: data.tenantId,
        code: data.code,
        name: data.name,
        description: data.description,
        capabilities: JSON.stringify(data.capabilities),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(role)
  }

  async findById(id: string): Promise<RoleDTO | null> {
    const prisma = getPrisma()
    const role = await prisma.role.findUnique({ where: { id } })
    return role ? this.toDTO(role) : null
  }

  async findByTenant(tenantId: string): Promise<RoleDTO[]> {
    const prisma = getPrisma()
    const roles = await prisma.role.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
    return roles.map(this.toDTO)
  }

  async findByCode(tenantId: string, code: string): Promise<RoleDTO | null> {
    const prisma = getPrisma()
    const role = await prisma.role.findUnique({ where: { tenantId_code: { tenantId, code } } })
    return role ? this.toDTO(role) : null
  }

  async update(id: string, data: Partial<{ name: string; description: string; capabilities: string[] }>): Promise<RoleDTO> {
    const prisma = getPrisma()
    const updateData: any = { ...data }
    if (data.capabilities) updateData.capabilities = JSON.stringify(data.capabilities)
    const role = await prisma.role.update({ where: { id }, data: updateData })
    return this.toDTO(role)
  }

  async assignToUser(userId: string, roleId: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.govUser.update({ where: { id: userId }, data: { role: roleId } })
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.role.delete({ where: { id } })
  }

  private toDTO(r: any): RoleDTO {
    return {
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      description: r.description || undefined,
      capabilities: JSON.parse(r.capabilities),
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}

export const roleRepository = new RoleRepository()
