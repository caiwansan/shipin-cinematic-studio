// ============================================================
// HDZ Character Repository — CRUD for HdzCharacter
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface HdzCharacterDTO {
  id: string
  projectId: string
  name: string
  role: string
  properties: any
  relations: any
  arc: string | null
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): HdzCharacterDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    role: record.role,
    properties: record.properties || {},
    relations: record.relations || [],
    arc: record.arc || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const hdzCharacterRepository = {
  async findUnique(where: any): Promise<HdzCharacterDTO | null> {
    const record = await prisma.hdzCharacter.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findFirst(where: any, orderBy?: any): Promise<HdzCharacterDTO | null> {
    const record = await prisma.hdzCharacter.findFirst({ where, orderBy })
    return record ? toDTO(record) : null
  },

  async findMany(where?: any, orderBy?: any): Promise<HdzCharacterDTO[]> {
    const records = await prisma.hdzCharacter.findMany({ where, orderBy })
    return records.map(toDTO)
  },

  async create(data: any): Promise<HdzCharacterDTO> {
    const record = await prisma.hdzCharacter.create({ data })
    return toDTO(record)
  },

  async update(where: any, data: any): Promise<HdzCharacterDTO | null> {
    try {
      const record = await prisma.hdzCharacter.update({ where, data })
      return toDTO(record)
    } catch {
      return null
    }
  },

  async delete(where: any): Promise<void> {
    await prisma.hdzCharacter.delete({ where })
  },

  async count(where?: any): Promise<number> {
    return prisma.hdzCharacter.count({ where })
  },
}
