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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export const sceneDagRepository = {
  async findMany(where?: any): Promise<SceneDagDTO[]> {
    const records = await prisma.sceneDag.findMany({ where })
    return records.map(toDTO)
  },

  async upsert(where: any, create: any, update: any): Promise<SceneDagDTO> {
    const record = await prisma.sceneDag.upsert({ where, create, update })
    return toDTO(record)
  },
}
