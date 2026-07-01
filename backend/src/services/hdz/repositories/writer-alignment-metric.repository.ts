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
    createdAt: record.createdAt.toISOString(),
  }
}

export const writerAlignmentMetricRepository = {
  async findMany(where?: any): Promise<WriterAlignmentMetricDTO[]> {
    const records = await prisma.writerAlignmentMetric.findMany({ where })
    return records.map(toDTO)
  },

  async create(data: any): Promise<WriterAlignmentMetricDTO> {
    const record = await prisma.writerAlignmentMetric.create({ data })
    return toDTO(record)
  },
}
