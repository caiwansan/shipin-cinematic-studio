// ============================================================
// Matrix Repository — ResourceCapabilityMatrix CRUD
// KMKI-PLAT-008: Capability × Resource Matrix
// ============================================================

import { PrismaClient } from '@prisma/client'
import type { ResourceCapabilityMatrix } from '../types'
import { RepositoryError } from '@platform/errors/platform-errors'

const prisma = new PrismaClient()

export const matrixRepository = {
  async upsert(data: {
    resourceId: string
    capabilityId: string
    supported: boolean
    qualityScore?: number
    costMultiplier?: number
    metadata?: string
  }): Promise<ResourceCapabilityMatrix> {
    try {
      const record = await prisma.resourceCapabilityMatrix.upsert({
        where: { resourceId_capabilityId: { resourceId: data.resourceId, capabilityId: data.capabilityId } },
        create: data,
        update: data,
      })
      return record as unknown as ResourceCapabilityMatrix
    } catch (err: any) {
      throw new RepositoryError('Failed to upsert ResourceCapabilityMatrix', { cause: err.message })
    }
  },

  async findByResourceAndCapability(resourceId: string, capabilityId: string): Promise<ResourceCapabilityMatrix | null> {
    try {
      const record = await prisma.resourceCapabilityMatrix.findUnique({
        where: { resourceId_capabilityId: { resourceId, capabilityId } },
      })
      return record as unknown as ResourceCapabilityMatrix | null
    } catch (err: any) {
      throw new RepositoryError('Failed to find matrix entry', { cause: err.message })
    }
  },

  async findByCapabilityId(capabilityId: string): Promise<ResourceCapabilityMatrix[]> {
    try {
      const records = await prisma.resourceCapabilityMatrix.findMany({
        where: { capabilityId, supported: true },
        orderBy: { qualityScore: 'desc' },
      })
      return records as unknown as ResourceCapabilityMatrix[]
    } catch (err: any) {
      throw new RepositoryError('Failed to find by capability', { cause: err.message })
    }
  },

  async findByResourceId(resourceId: string): Promise<ResourceCapabilityMatrix[]> {
    try {
      const records = await prisma.resourceCapabilityMatrix.findMany({
        where: { resourceId },
      })
      return records as unknown as ResourceCapabilityMatrix[]
    } catch (err: any) {
      throw new RepositoryError('Failed to find by resource', { cause: err.message })
    }
  },

  async listAll(): Promise<ResourceCapabilityMatrix[]> {
    try {
      const records = await prisma.resourceCapabilityMatrix.findMany()
      return records as unknown as ResourceCapabilityMatrix[]
    } catch (err: any) {
      throw new RepositoryError('Failed to list matrix entries', { cause: err.message })
    }
  },

  async delete(resourceId: string, capabilityId: string): Promise<void> {
    try {
      await prisma.resourceCapabilityMatrix.delete({
        where: { resourceId_capabilityId: { resourceId, capabilityId } },
      })
    } catch (err: any) {
      throw new RepositoryError('Failed to delete matrix entry', { cause: err.message })
    }
  },

  async getCapabilityResourceMap(): Promise<Record<string, string[]>> {
    try {
      const records = await prisma.resourceCapabilityMatrix.findMany({
        where: { supported: true },
        select: { capabilityId: true, resourceId: true },
      })
      const map: Record<string, string[]> = {}
      for (const r of records) {
        if (!map[r.capabilityId]) map[r.capabilityId] = []
        map[r.capabilityId].push(r.resourceId)
      }
      return map
    } catch (err: any) {
      throw new RepositoryError('Failed to build capability-resource map', { cause: err.message })
    }
  },
}
