// ============================================================
// GovUser Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { GovUserDTO } from '../types.js'

export class GovUserRepository {
  async create(data: { tenantId: string; email?: string; name: string; role?: string; metadata?: Record<string, any> }): Promise<GovUserDTO> {
    const prisma = getPrisma()
    const user = await prisma.govUser.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        name: data.name,
        role: data.role,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(user)
  }

  async findById(id: string): Promise<GovUserDTO | null> {
    const prisma = getPrisma()
    const user = await prisma.govUser.findUnique({ where: { id } })
    return user ? this.toDTO(user) : null
  }

  async findByTenant(tenantId: string): Promise<GovUserDTO[]> {
    const prisma = getPrisma()
    const users = await prisma.govUser.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return users.map(this.toDTO)
  }

  async update(id: string, data: Partial<{ name: string; email: string; role: string; status: string }>): Promise<GovUserDTO> {
    const prisma = getPrisma()
    const user = await prisma.govUser.update({ where: { id }, data })
    return this.toDTO(user)
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrisma()
    await prisma.govUser.delete({ where: { id } })
  }

  private toDTO(u: any): GovUserDTO {
    return {
      id: u.id,
      tenantId: u.tenantId,
      email: u.email || undefined,
      name: u.name,
      role: u.role || undefined,
      status: u.status,
      metadata: u.metadata ? JSON.parse(u.metadata) : undefined,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }
  }
}

export const govUserRepository = new GovUserRepository()
