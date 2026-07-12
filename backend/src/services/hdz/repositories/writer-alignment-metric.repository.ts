// ============================================================
// Writer Alignment Metric Repository — CRUD for WriterAlignmentMetric
// ============================================================

import { prisma } from '../../../utils/index.js'

export interface WriterAlignmentMetricDTO {
  id: string
  projectId: string
  chapterId: string | null
  scoreJson: any
  shadowStateDelta: any
  createdAt: string
}

function toDTO(record: any): WriterAlignmentMetricDTO {
  return {
    id: record.id,
    projectId: record.projectId,
    chapterId: record.chapterId || null,
    scoreJson: record.scoreJson || {},
    shadowStateDelta: record.shadowStateDelta || null,
    createdAt: record.createdAt?.toISOString?.() || '',
  }
}

export const writerAlignmentMetricRepository = {
  async findMany(where?: any): Promise<WriterAlignmentMetricDTO[]> {
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
          const records = await prisma.writerAlignmentMetric.findMany(args)
          return records.map(toDTO)
        }
        const records = await prisma.writerAlignmentMetric.findMany(where)
        return records.map(toDTO)
      }
    }
    const records = await prisma.writerAlignmentMetric.findMany({ where })
    return records.map(toDTO)
  },

  async create(data: any): Promise<WriterAlignmentMetricDTO> {
    const record = await prisma.writerAlignmentMetric.create({ data })
    return toDTO(record)
  },
}
