// ============================================================
// Growth Memory Repository — CRUD for GrowthMemory
// ============================================================

import { prisma } from '../../../utils/index'

export const growthMemoryRepository = {
  async create(data: any): Promise<any> {
    return prisma.growthMemory.create({ data })
  },

  async findUnique(where: { id: string }): Promise<any | null> {
    return prisma.growthMemory.findUnique({ where })
  },

  async findMany(where?: any, options?: { orderBy?: any; take?: number; skip?: number }): Promise<any[]> {
    return prisma.growthMemory.findMany({ where, ...options })
  },

  async update(where: { id: string }, data: any): Promise<any | null> {
    try {
      return prisma.growthMemory.update({ where, data })
    } catch {
      return null
    }
  },
}
