// ============================================================
// Credential Repository — ResourceCredential management
// KMKI-PLAT-008: BYO API Key credential lifecycle
// ============================================================

import { PrismaClient } from '@prisma/client'
import type { ResourceCredential } from '../types'
import { RepositoryError } from '@platform/errors/platform-errors'

const prisma = new PrismaClient()

export const credentialRepository = {
  async create(data: Omit<ResourceCredential, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<ResourceCredential> {
    try {
      const record = await prisma.resourceCredential.create({
        data: { ...data, schemaVersion: 1 },
      })
      return record as unknown as ResourceCredential
    } catch (err: any) {
      throw new RepositoryError('Failed to create ResourceCredential', { cause: err.message })
    }
  },

  async findById(id: string): Promise<ResourceCredential | null> {
    try {
      const record = await prisma.resourceCredential.findUnique({ where: { id } })
      return record as unknown as ResourceCredential | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find ResourceCredential', { cause: err.message })
    }
  },

  async findByResourceAndTenant(resourceId: string, tenantId: string, workspaceId?: string): Promise<ResourceCredential | null> {
    try {
      const record = await prisma.resourceCredential.findUnique({
        where: { resourceId_tenantId_workspaceId: { resourceId, tenantId, workspaceId: workspaceId || '' } },
      })
      return record as unknown as ResourceCredential | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find credential by resource and tenant', { cause: err.message })
    }
  },

  async listByTenant(tenantId: string, params?: { resourceId?: string; status?: string }): Promise<ResourceCredential[]> {
    try {
      const where: any = { tenantId }
      if (params?.resourceId) where.resourceId = params.resourceId
      if (params?.status) where.status = params.status

      const records = await prisma.resourceCredential.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      })
      return records as unknown as ResourceCredential[]
    } catch (err: any) {
      throw new RepositoryError('Failed to list credentials by tenant', { cause: err.message })
    }
  },

  async listByResourceId(resourceId: string): Promise<ResourceCredential[]> {
    try {
      const records = await prisma.resourceCredential.findMany({
        where: { resourceId },
        orderBy: { createdAt: 'desc' },
      })
      return records as unknown as ResourceCredential[]
    } catch (err: any) {
      throw new RepositoryError('Failed to list credentials by resource', { cause: err.message })
    }
  },

  async update(id: string, data: Partial<ResourceCredential>): Promise<ResourceCredential> {
    try {
      const record = await prisma.resourceCredential.update({
        where: { id },
        data,
      })
      return record as unknown as ResourceCredential
    } catch (err: any) {
      throw new RepositoryError('Failed to update ResourceCredential', { cause: err.message })
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await prisma.resourceCredential.delete({ where: { id } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete ResourceCredential', { cause: err.message })
    }
  },

  async findExpiringSoon(hoursThreshold: number = 72): Promise<ResourceCredential[]> {
    try {
      const threshold = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000)
      const records = await prisma.resourceCredential.findMany({
        where: {
          expiresAt: { lte: threshold, not: null },
          status: 'active',
        },
      })
      return records as unknown as ResourceCredential[]
    } catch (err: any) {
      throw new RepositoryError('Failed to find expiring credentials', { cause: err.message })
    }
  },
}
