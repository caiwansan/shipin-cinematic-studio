// ============================================================
// HDZ Memory Repository — CRUD for HdzMemory
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface HdzMemoryDTO {
  id: string
  projectId: string
  type: string
  content: any
  version: number
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): HdzMemoryDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    type: record.type,
    content: record.content,
    version: record.version,
    createdAt: record.createdAt?.toISOString?.() || record.createdAt || '',
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt || '',
  }
}

export const hdzMemoryRepository = {
  async findUnique(where: any): Promise<HdzMemoryDTO | null> {
    const record = await prisma.hdzMemory.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findFirst(where: any, orderBy?: any): Promise<HdzMemoryDTO | null> {
    // Compat: support both { where, orderBy } and single-arg { where, orderBy, ... }
    const args = (typeof where === 'object' && where !== null && ('where' in where || 'orderBy' in where)) ? where : { where, orderBy }
    const record = await prisma.hdzMemory.findFirst(args)
    return record ? toDTO(record) : null
  },

  async findMany(where?: any, orderBy?: any): Promise<HdzMemoryDTO[]> {
    const args = (where && typeof where === 'object' && ('where' in where || 'orderBy' in where || 'skip' in where || 'take' in where || 'select' in where || 'include' in where)) ? where : { where, orderBy }
    const records = await prisma.hdzMemory.findMany(args)
    return records.map(toDTO)
  },

  async create(data: any): Promise<HdzMemoryDTO> {
    const record = await prisma.hdzMemory.create({ data })
    return toDTO(record)
  },

  async update(where: any, data: any): Promise<HdzMemoryDTO | null> {
    try {
      const record = await prisma.hdzMemory.update({ where, data })
      return toDTO(record)
    } catch {
      return null
    }
  },

  async delete(where: any): Promise<void> {
    await prisma.hdzMemory.delete({ where })
  },

  async count(where?: any): Promise<number> {
    return prisma.hdzMemory.count({ where })
  },

  async upsert(where: any, create: any, update: any): Promise<HdzMemoryDTO> {
    const record = await prisma.hdzMemory.upsert({ where, create, update })
    return toDTO(record)
  },
}
