// ============================================================
// License Repository — KMKI-PLAT-012
// ============================================================

import { getPrisma } from './base.js'
import type { LicenseDTO } from '../types.js'

export class LicenseRepository {
  async create(data: {
    tenantId: string; licenseKey: string; status?: string; seats: number;
    modules: string[]; startDate: Date; endDate?: Date; metadata?: Record<string, any>
  }): Promise<LicenseDTO> {
    const prisma = getPrisma()
    const license = await prisma.license.create({
      data: {
        tenantId: data.tenantId,
        licenseKey: data.licenseKey,
        status: data.status || 'active',
        seats: data.seats,
        modules: JSON.stringify(data.modules),
        startDate: data.startDate,
        endDate: data.endDate,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    })
    return this.toDTO(license)
  }

  async findByTenant(tenantId: string): Promise<LicenseDTO[]> {
    const prisma = getPrisma()
    const licenses = await prisma.license.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
    return licenses.map(this.toDTO)
  }

  async findByKey(licenseKey: string): Promise<LicenseDTO | null> {
    const prisma = getPrisma()
    const license = await prisma.license.findUnique({ where: { licenseKey } })
    return license ? this.toDTO(license) : null
  }

  async update(id: string, data: Partial<{ status: string; seats: number; endDate: Date }>): Promise<LicenseDTO> {
    const prisma = getPrisma()
    const license = await prisma.license.update({ where: { id }, data })
    return this.toDTO(license)
  }

  private toDTO(l: any): LicenseDTO {
    return {
      id: l.id,
      tenantId: l.tenantId,
      licenseKey: l.licenseKey,
      status: l.status,
      seats: l.seats,
      modules: JSON.parse(l.modules),
      startDate: l.startDate,
      endDate: l.endDate || undefined,
      metadata: l.metadata ? JSON.parse(l.metadata) : undefined,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }
  }
}

export const licenseRepository = new LicenseRepository()
