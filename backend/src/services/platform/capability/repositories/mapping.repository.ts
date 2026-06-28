// ============================================================
// Provider Mapping Repository — CapabilityProviderMapping CRUD
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { CapabilityContract } from '../types.js'
import { Prisma } from '@prisma/client'

export interface ProviderMappingRecord {
  id: string
  capabilityId: string
  provider: string
  priority: number
  config: string | null
  status: string
  createdAt: string
  updatedAt: string
  capability?: CapabilityContract
}

export class MappingRepository {
  async create(data: {
    capabilityId: string
    provider: string
    priority?: number
    config?: Record<string, unknown>
    status?: string
  }): Promise<ProviderMappingRecord> {
    const created = await prisma.capabilityProviderMapping.create({
      data: {
        capabilityId: data.capabilityId,
        provider: data.provider,
        priority: data.priority || 0,
        config: data.config ? JSON.stringify(data.config) : null,
        status: data.status || 'active',
      },
    })
    return this.mapToRecord(created)
  }

  async findById(id: string): Promise<ProviderMappingRecord | null> {
    const record = await prisma.capabilityProviderMapping.findUnique({
      where: { id },
      include: { capability: true },
    })
    return record ? this.mapToRecord(record) : null
  }

  async findByCapabilityId(capabilityId: string): Promise<ProviderMappingRecord[]> {
    const records = await prisma.capabilityProviderMapping.findMany({
      where: { capabilityId },
      orderBy: { priority: 'asc' },
    })
    return records.map((r: any) => this.mapToRecord(r))
  }

  async findActiveByCapabilityId(capabilityId: string): Promise<ProviderMappingRecord[]> {
    const records = await prisma.capabilityProviderMapping.findMany({
      where: { capabilityId, status: 'active' },
      orderBy: { priority: 'asc' },
    })
    return records.map((r: any) => this.mapToRecord(r))
  }

  async findAll(filter?: {
    provider?: string
    status?: string
    capabilityId?: string
  }): Promise<ProviderMappingRecord[]> {
    const where: Prisma.CapabilityProviderMappingWhereInput = {}
    if (filter?.provider) where.provider = filter.provider
    if (filter?.status) where.status = filter.status
    if (filter?.capabilityId) where.capabilityId = filter.capabilityId

    const records = await prisma.capabilityProviderMapping.findMany({
      where,
      orderBy: [{ capabilityId: 'asc' }, { priority: 'asc' }],
    })
    return records.map((r: any) => this.mapToRecord(r))
  }

  async update(id: string, data: {
    provider?: string
    priority?: number
    config?: Record<string, unknown>
    status?: string
  }): Promise<ProviderMappingRecord | null> {
    const existing = await prisma.capabilityProviderMapping.findUnique({ where: { id } })
    if (!existing) return null

    const updateData: Prisma.CapabilityProviderMappingUpdateInput = {}
    if (data.provider !== undefined) updateData.provider = data.provider
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.config !== undefined) updateData.config = JSON.stringify(data.config)
    if (data.status !== undefined) updateData.status = data.status

    const updated = await prisma.capabilityProviderMapping.update({ where: { id }, data: updateData })
    return this.mapToRecord(updated)
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.capabilityProviderMapping.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }

  async deleteByCapabilityId(capabilityId: string): Promise<number> {
    const result = await prisma.capabilityProviderMapping.deleteMany({
      where: { capabilityId },
    })
    return result.count
  }

  private mapToRecord(record: any): ProviderMappingRecord {
    return {
      id: record.id,
      capabilityId: record.capabilityId,
      provider: record.provider,
      priority: record.priority,
      config: record.config,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      capability: record.capability ? {
        id: record.capability.id,
        name: record.capability.name,
        displayName: record.capability.displayName,
        description: record.capability.description,
        category: record.capability.category,
        version: record.capability.version,
        inputSchema: record.capability.inputSchema,
        outputSchema: record.capability.outputSchema,
        constraints: record.capability.constraints,
        qualityProfile: record.capability.qualityProfile,
        permissionProfile: record.capability.permissionProfile,
        tags: record.capability.tags,
        status: record.capability.status,
        metadata: record.capability.metadata,
        schemaVersion: record.capability.schemaVersion,
        createdAt: record.capability.createdAt.toISOString(),
        updatedAt: record.capability.updatedAt.toISOString(),
      } : undefined,
    }
  }
}

export const mappingRepository = new MappingRepository()
