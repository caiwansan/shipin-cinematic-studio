// ============================================================
// Entity Registry Repository — CRUD for EntityRegistry
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface EntityRegistryDTO {
  id: string
  projectId: string
  entityType: string
  name: string
  aliases: string[]
  createdAt: string
}

function toDTO(record: any): EntityRegistryDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    entityType: record.entityType,
    name: record.name,
    aliases: record.aliases || [],
    createdAt: record.createdAt.toISOString(),
  }
}

export const entityRegistryRepository = {
  async findUnique(where: any): Promise<EntityRegistryDTO | null> {
    const record = await prisma.entityRegistry.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findMany(where?: any): Promise<EntityRegistryDTO[]> {
    const records = await prisma.entityRegistry.findMany({ where })
    return records.map(toDTO)
  },

  async create(data: any): Promise<EntityRegistryDTO> {
    const record = await prisma.entityRegistry.create({ data })
    return toDTO(record)
  },

  async update(where: any, data: any): Promise<EntityRegistryDTO | null> {
    try {
      const record = await prisma.entityRegistry.update({ where, data })
      return toDTO(record)
    } catch {
      return null
    }
  },

  async delete(where: any): Promise<void> {
    await prisma.entityRegistry.delete({ where })
  },
}
