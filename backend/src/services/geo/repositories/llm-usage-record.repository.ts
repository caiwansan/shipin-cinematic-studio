// ============================================================
// LLM Usage Record Repository — CRUD for LLMUsageRecord
// ============================================================

import { prisma } from '../../../utils/index'

export const llmUsageRecordRepository = {
  async create(data: any): Promise<any> {
    return prisma.lLMUsageRecord.create({ data })
  },

  async findMany(where: any, options?: { orderBy?: any; take?: number; skip?: number }): Promise<any[]> {
    return prisma.lLMUsageRecord.findMany({ where, ...options })
  },

  async findUnique(where: any): Promise<any | null> {
    return prisma.lLMUsageRecord.findUnique({ where })
  },

  async count(where: any): Promise<number> {
    const effectiveWhere = where.where || where
    return prisma.lLMUsageRecord.count({ where: effectiveWhere })
  },
}
