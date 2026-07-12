// ============================================================
// Publishable Claim Repository — CRUD for PublishableClaim
// ============================================================

import { prisma } from '../../../utils/index'

export const publishableClaimRepository = {
  async create(data: {
    projectId: string
    verificationId: string
    sourceActionId: string
    title: string
    contentType: string
    content: string
    status?: string
    version?: string
  }): Promise<any> {
    return prisma.publishableClaim.create({ data })
  },

  async findUnique(where: { id: string }): Promise<any | null> {
    return prisma.publishableClaim.findUnique({ where })
  },

  async findMany(where?: any, options?: { orderBy?: any; take?: number; skip?: number }): Promise<any[]> {
    return prisma.publishableClaim.findMany({ where, ...options })
  },

  async update(where: { id: string }, data: any): Promise<any | null> {
    try {
      return prisma.publishableClaim.update({ where, data })
    } catch {
      return null
    }
  },

  async delete(where: { id: string }): Promise<void> {
    await prisma.publishableClaim.delete({ where })
  },
}
