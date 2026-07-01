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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const hdzMemoryRepository = {
  async findUnique(where: any): Promise<HdzMemoryDTO | null> {
    const record = await prisma.hdzMemory.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findFirst(where: any, orderBy?: any): Promise<HdzMemoryDTO | null> {
    const record = await prisma.hdzMemory.findFirst({ where, orderBy })
    return record ? toDTO(record) : null
  },

  async findMany(where?: any, orderBy?: any): Promise<HdzMemoryDTO[]> {
    const records = await prisma.hdzMemory.findMany({ where, orderBy })
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
