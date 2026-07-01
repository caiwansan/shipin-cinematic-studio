// ============================================================
// Membership Repository — CRUD for Membership
// ============================================================

import { prisma } from '../../utils/index.js'

export const membershipRepository = {
  async findUnique(where: any, select?: any) {
    return prisma.membership.findUnique({ where, ...(select ? { select } : {}) })
  },

  async findMany(where: any) {
    return prisma.membership.findMany({ where })
  },

  async count(where: any) {
    return prisma.membership.count({ where })
  },
}
