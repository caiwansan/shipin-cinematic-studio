// ============================================================
// Contract Repository — CapabilityContract CRUD via Prisma
// Service layer never directly touches Prisma.
// ============================================================

import { prisma } from '../../../../utils/index.js'
import type { CapabilityContract } from '../types.js'
import { Prisma } from '@prisma/client'

export class ContractRepository {
  async create(data: Partial<CapabilityContract>): Promise<CapabilityContract> {
    const created = await prisma.capabilityContract.create({
      data: {
        name: data.name!,
        displayName: data.displayName!,
        description: data.description || null,
        category: data.category!,
        version: data.version || '1.0.0',
        inputSchema: data.inputSchema || null,
        outputSchema: data.outputSchema || null,
        constraints: data.constraints || null,
        qualityProfile: data.qualityProfile || null,
        permissionProfile: data.permissionProfile || null,
        tags: data.tags || null,
        status: data.status || 'active',
        metadata: data.metadata || null,
        schemaVersion: data.schemaVersion || 1,
      },
    })
    return this.mapToContract(created)
  }

  async findById(id: string): Promise<CapabilityContract | null> {
    const record = await prisma.capabilityContract.findUnique({ where: { id } })
    return record ? this.mapToContract(record) : null
  }

  async findByName(name: string): Promise<CapabilityContract | null> {
    const record = await prisma.capabilityContract.findUnique({ where: { name } })
    return record ? this.mapToContract(record) : null
  }

  async findAll(filter?: {
    category?: string
    status?: string
    search?: string
    tags?: string[]
    limit?: number
    offset?: number
  }): Promise<{ items: CapabilityContract[]; total: number }> {
    const where: Prisma.CapabilityContractWhereInput = {}

    if (filter?.category) where.category = filter.category
    if (filter?.status) where.status = filter.status
    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search } },
        { displayName: { contains: filter.search } },
        { description: { contains: filter.search } },
      ]
    }
    if (filter?.tags && filter.tags.length > 0) {
      // Simple tag matching via contains (JSON array string)
      where.tags = {
        contains: filter.tags[0], // simplified — full array matching would need SQL
      }
    }

    const [items, total] = await Promise.all([
      prisma.capabilityContract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter?.limit || 50,
        skip: filter?.offset || 0,
      }),
      prisma.capabilityContract.count({ where }),
    ])

    return {
      items: items.map((r: any) => this.mapToContract(r)),
      total,
    }
  }

  async update(id: string, data: Partial<CapabilityContract>): Promise<CapabilityContract | null> {
    const existing = await prisma.capabilityContract.findUnique({ where: { id } })
    if (!existing) return null

    const updateData: Prisma.CapabilityContractUpdateInput = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.displayName !== undefined) updateData.displayName = data.displayName
    if (data.description !== undefined) updateData.description = data.description
    if (data.category !== undefined) updateData.category = data.category
    if (data.version !== undefined) updateData.version = data.version
    if (data.inputSchema !== undefined) updateData.inputSchema = data.inputSchema
    if (data.outputSchema !== undefined) updateData.outputSchema = data.outputSchema
    if (data.constraints !== undefined) updateData.constraints = data.constraints
    if (data.qualityProfile !== undefined) updateData.qualityProfile = data.qualityProfile
    if (data.permissionProfile !== undefined) updateData.permissionProfile = data.permissionProfile
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.status !== undefined) updateData.status = data.status
    if (data.metadata !== undefined) updateData.metadata = data.metadata
    if (data.schemaVersion !== undefined) updateData.schemaVersion = data.schemaVersion

    const updated = await prisma.capabilityContract.update({ where: { id }, data: updateData })
    return this.mapToContract(updated)
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.capabilityContract.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }

  async count(filter?: { category?: string; status?: string }): Promise<number> {
    const where: Prisma.CapabilityContractWhereInput = {}
    if (filter?.category) where.category = filter.category
    if (filter?.status) where.status = filter.status
    return prisma.capabilityContract.count({ where })
  }

  async getCategories(): Promise<string[]> {
    const results = await prisma.capabilityContract.findMany({
      select: { category: true },
      distinct: ['category'],
    })
    return results.map((r: { category: string }) => r.category)
  }

  private mapToContract(record: any): CapabilityContract {
    return {
      id: record.id,
      name: record.name,
      displayName: record.displayName,
      description: record.description,
      category: record.category,
      version: record.version,
      inputSchema: record.inputSchema,
      outputSchema: record.outputSchema,
      constraints: record.constraints,
      qualityProfile: record.qualityProfile,
      permissionProfile: record.permissionProfile,
      tags: record.tags,
      status: record.status,
      metadata: record.metadata,
      schemaVersion: record.schemaVersion,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }
}

export const contractRepository = new ContractRepository()
