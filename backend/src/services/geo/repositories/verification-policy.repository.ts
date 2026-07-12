// ============================================================
// Verification Policy Repository — CRUD for VerificationPolicy
// ============================================================

import { prisma } from '../../../utils/index'

export const verificationPolicyRepository = {
  async findMany(where?: any, options?: { orderBy?: any }): Promise<any[]> {
    return prisma.verificationPolicy.findMany({ where, ...options })
  },

  async findFirst(where?: any): Promise<any | null> {
    return prisma.verificationPolicy.findFirst({ where })
  },

  async create(data: any): Promise<any> {
    return prisma.verificationPolicy.create({ data })
  },

  async update(where: { id: string }, data: any): Promise<any | null> {
    try {
      return prisma.verificationPolicy.update({ where, data })
    } catch {
      return null
    }
  },
}
