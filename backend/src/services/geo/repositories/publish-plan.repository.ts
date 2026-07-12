// ============================================================
// Publish Plan Repository — CRUD for PublishPlan
// ============================================================

import { prisma } from '../../../utils/index'

export const publishPlanRepository = {
  async create(data: {
    projectId: string
    title: string
    status?: string
    targetChannels?: any
    executionOrder?: any | null
  }): Promise<any> {
    return prisma.publishPlan.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        status: data.status || 'draft',
        targetChannels: data.targetChannels || [],
        executionOrder: data.executionOrder || null,
      },
    })
  },

  async findUnique(where: { id: string }, options?: { include?: any }): Promise<any | null> {
    return prisma.publishPlan.findUnique({ where, ...options })
  },

  async findMany(where?: any, options?: { orderBy?: any; take?: number; skip?: number }): Promise<any[]> {
    return prisma.publishPlan.findMany({ where, ...options })
  },

  async update(where: { id: string }, data: any): Promise<any | null> {
    try {
      return prisma.publishPlan.update({ where, data })
    } catch {
      return null
    }
  },

  async delete(where: { id: string }): Promise<void> {
    await prisma.publishPlan.delete({ where })
  },
}
