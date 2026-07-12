// ============================================================
// HDZ Style DNA Repository — CRUD for HdzStyleDna
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface HdzStyleDnaDTO {
  id: string
  projectId: string
  sourceText: string | null
  fingerprint: any
  createdAt: string
  updatedAt: string
}

function toDTO(record: any): HdzStyleDnaDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    sourceText: record.sourceText || null,
    fingerprint: record.fingerprint || {},
    createdAt: record.createdAt?.toISOString?.() || '',
    updatedAt: record.updatedAt?.toISOString?.() || '',
  }
}

export const hdzStyleDnaRepository = {
  async findUnique(where: any): Promise<HdzStyleDnaDTO | null> {
    const record = await prisma.hdzStyleDna.findUnique({ where })
    return record ? toDTO(record) : null
  },

  async findFirst(where: any, orderBy?: any): Promise<HdzStyleDnaDTO | null> {
    // Compat: support both { where, orderBy } and single-arg { where, orderBy, ... }
    const args = (typeof where === 'object' && where !== null && ('where' in where || 'orderBy' in where)) ? where : { where, orderBy }
    const record = await prisma.hdzStyleDna.findFirst(args)
    return record ? toDTO(record) : null
  },

  async upsert(where: any, create: any, update: any): Promise<HdzStyleDnaDTO> {
    const record = await prisma.hdzStyleDna.upsert({ where, create, update })
    return toDTO(record)
  },
}
