// ============================================================
// Contract Repository — ResourceContract CRUD
// KMKI-PLAT-008
// ============================================================

import { PrismaClient } from '@prisma/client'
import type { ResourceContract } from '../types'
import { RepositoryError } from '@platform/errors/platform-errors'

const prisma = new PrismaClient()

export const contractRepository = {
  async create(data: Omit<ResourceContract, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<ResourceContract> {
    try {
      const record = await prisma.resourceContract.create({
        data: { ...data, schemaVersion: 1 },
      })
      return record as unknown as ResourceContract
    } catch (err: any) {
      throw new RepositoryError('Failed to create ResourceContract', { cause: err.message })
    }
  },

  async findById(id: string): Promise<ResourceContract | null> {
    try {
      const record = await prisma.resourceContract.findUnique({ where: { id } })
      return record as unknown as ResourceContract | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find ResourceContract', { cause: err.message })
    }
  },

  async findByName(name: string): Promise<ResourceContract | null> {
    try {
      const record = await prisma.resourceContract.findUnique({ where: { name } })
      return record as unknown as ResourceContract | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find ResourceContract by name', { cause: err.message })
    }
  },

  async list(params?: { type?: string; vendor?: string; status?: string; search?: string; limit?: number; offset?: number }): Promise<{ items: ResourceContract[]; total: number }> {
    try {
      const where: any = {}
      if (params?.type) where.type = params.type
      if (params?.vendor) where.vendor = params.vendor
      if (params?.status) where.status = params.status
      if (params?.search) {
        where.OR = [
          { name: { contains: params.search } },
          { description: { contains: params.search } },
        ]
      }

      const [items, total] = await Promise.all([
        prisma.resourceContract.findMany({
          where,
          take: params?.limit || 50,
          skip: params?.offset || 0,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.resourceContract.count({ where }),
      ])
      return { items: items as unknown as ResourceContract[], total }
    } catch (err: any) {
      throw new RepositoryError('Failed to list ResourceContracts', { cause: err.message })
    }
  },

  async update(id: string, data: Partial<ResourceContract>): Promise<ResourceContract> {
    try {
      const record = await prisma.resourceContract.update({
        where: { id },
        data,
      })
      return record as unknown as ResourceContract
    } catch (err: any) {
      throw new RepositoryError('Failed to update ResourceContract', { cause: err.message })
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await prisma.resourceContract.delete({ where: { id } })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete ResourceContract', { cause: err.message })
    }
  },

  async countByType(): Promise<Record<string, number>> {
    try {
      const records = await prisma.resourceContract.groupBy({
        by: ['type'],
        _count: { id: true },
      })
      const result: Record<string, number> = {}
      for (const r of records) {
        result[r.type] = r._count.id
      }
      return result
    } catch (err: any) {
      throw new RepositoryError('Failed to count by type', { cause: err.message })
    }
  },
}
