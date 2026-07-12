// ============================================================
// Publish Plan To Claim Repository — CRUD for PublishPlanToClaim
// ============================================================

import { prisma } from '../../../utils/index'

export const publishPlanToClaimRepository = {
  async createMany(data: Array<{ planId: string; claimId: string }>): Promise<any> {
    return prisma.publishPlanToClaim.createMany({ data })
  },

  async delete(where: { planId_claimId: { planId: string; claimId: string } }): Promise<void> {
    await prisma.publishPlanToClaim.delete({ where })
  },

  async findMany(where?: any): Promise<any[]> {
    return prisma.publishPlanToClaim.findMany({ where })
  },
}
