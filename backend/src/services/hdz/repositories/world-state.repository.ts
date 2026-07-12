// ============================================================
// World State Repository — CRUD for WorldState
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface WorldStateDTO {
  id: string
  projectId: string
  entityId: string
  stateJson: any
  version: number
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): WorldStateDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    entityId: record.entityId,
    stateJson: record.stateJson || {},
    version: record.version,
    createdAt: record.createdAt?.toISOString?.() || '',
    updatedAt: record.updatedAt?.toISOString?.() || '',
  }
}

export const worldStateRepository = {
  async findUnique(where: any): Promise<WorldStateDTO | null> {
    const record = await prisma.worldState.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findMany(where?: any): Promise<WorldStateDTO[]> {
    // Support both (where) and ({ where, orderBy, skip, take, select, include }) signatures
    if (typeof where === 'object' && where !== null) {
      const prismaKeys = ['where', 'orderBy', 'skip', 'take', 'select', 'include', 'cursor', 'distinct']
      const hasPrismaKey = prismaKeys.some(k => k in where)
      if (hasPrismaKey) {
        if (!('where' in where)) {
          const { orderBy, skip, take, select, include, cursor, distinct, ...filters } = where
          const args: any = { where: filters }
          if (orderBy) args.orderBy = orderBy
          if (skip !== undefined) args.skip = skip
          if (take !== undefined) args.take = take
          if (select) args.select = select
          if (include) args.include = include
          const records = await prisma.worldState.findMany(args)
          return records.map(toDTO)
        }
        const records = await prisma.worldState.findMany(where)
        return records.map(toDTO)
      }
    }
    const records = await prisma.worldState.findMany({ where })
    return records.map(toDTO)
  },

  async upsert(where: any, create: any, update: any): Promise<WorldStateDTO> {
    const record = await prisma.worldState.upsert({ where, create, update })
    return toDTO(record)
  },
}
