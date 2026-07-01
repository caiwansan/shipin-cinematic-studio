// ============================================================
// Verification Result Repository — CRUD for VerificationResult
// ============================================================

import { prisma } from '../../../utils/index'

export const verificationResultRepository = {
  async findMany(where: any, options?: { orderBy?: any; take?: number }): Promise<any[]> {
    // Support both (where, options) and ({ where, orderBy, take }) signatures
    const effectiveWhere = where.where || where
    const effectiveOptions = options || (where.where ? { orderBy: where.orderBy, take: where.take } : undefined)
    return prisma.verificationResult.findMany({ where: effectiveWhere, ...effectiveOptions })
  },
}
