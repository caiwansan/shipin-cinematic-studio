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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const worldStateRepository = {
  async findUnique(where: any): Promise<WorldStateDTO | null> {
    const record = await prisma.worldState.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findMany(where?: any): Promise<WorldStateDTO[]> {
    const records = await prisma.worldState.findMany({ where })
    return records.map(toDTO)
  },

  async upsert(where: any, create: any, update: any): Promise<WorldStateDTO> {
    const record = await prisma.worldState.upsert({ where, create, update })
    return toDTO(record)
  },
}
