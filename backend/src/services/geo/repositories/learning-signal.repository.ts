// ============================================================
// Learning Signal Repository — CRUD for LearningSignal
// ============================================================

import { prisma } from '../../../utils/index'

export const learningSignalRepository = {
  async create(data: {
    source: string
    signalType: string
    originalValue: number
    normalizedValue: number
    weight?: number
    weightedValue?: number
    industry?: string | null
    optimizationType?: string | null
    reason?: string | null
    executionId?: string | null
  }): Promise<any> {
    return prisma.learningSignal.create({
      data: {
        source: data.source,
        signalType: data.signalType,
        originalValue: data.originalValue,
        normalizedValue: data.normalizedValue,
        weight: data.weight ?? 1.0,
        weightedValue: data.weightedValue ?? data.normalizedValue,
        industry: data.industry ?? null,
        optimizationType: data.optimizationType ?? null,
        reason: data.reason ?? null,
        executionId: data.executionId ?? null,
      },
    })
  },

  async findUnique(where: { id: string }): Promise<any | null> {
    return prisma.learningSignal.findUnique({ where })
  },

  async findMany(where?: any, options?: { orderBy?: any; take?: number; skip?: number }): Promise<any[]> {
    return prisma.learningSignal.findMany({ where, ...options })
  },

  async count(where?: any): Promise<number> {
    return prisma.learningSignal.count({ where })
  },

  async groupBy(by: string[], options?: { _count?: any }): Promise<any[]> {
    return prisma.learningSignal.groupBy({ by: by as any, ...options } as any)
  },
}
