// ============================================================
// Scene DAG Repository — CRUD for SceneDag
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface SceneDagDTO {
  id: string
  projectId: string
  sceneId: string
  chapterNo: number
  sceneNo: number
  dagJson: any
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): SceneDagDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    sceneId: record.sceneId,
    chapterNo: record.chapterNo,
    sceneNo: record.sceneNo,
    dagJson: record.dagJson || {},
    createdAt: record.createdAt?.toISOString?.() || '',
    updatedAt: record.updatedAt?.toISOString?.() || '',
  }
}

export const sceneDagRepository = {
  async findMany(where?: any): Promise<SceneDagDTO[]> {
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
          const records = await prisma.sceneDag.findMany(args)
          return records.map(toDTO)
        }
        const records = await prisma.sceneDag.findMany(where)
        return records.map(toDTO)
      }
    }
    const records = await prisma.sceneDag.findMany({ where })
    return records.map(toDTO)
  },

  async upsert(where: any, create: any, update: any): Promise<SceneDagDTO> {
    const record = await prisma.sceneDag.upsert({ where, create, update })
    return toDTO(record)
  },
}
