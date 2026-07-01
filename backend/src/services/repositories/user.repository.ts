// ============================================================
// User Repository — CRUD for User
// ============================================================

import { prisma } from '../../utils/index.js'

export const userRepository = {
  async findUnique(where: any, select?: any) {
    return prisma.user.findUnique({ where, ...(select ? { select } : {}) })
  },

  async findMany(where: any) {
    return prisma.user.findMany({ where })
  },

  async update(where: any, data: any) {
    return prisma.user.update({ where, data })
  },

  async count(where: any) {
    return prisma.user.count({ where })
  },
}
