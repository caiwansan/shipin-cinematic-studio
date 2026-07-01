// ============================================================
// GEO Score Snapshot Repository — CRUD for GEOScoreSnapshot
// ============================================================

import { prisma } from '../../../utils/index'

export const geoScoreSnapshotRepository = {
  async create(data: any): Promise<any> {
    return prisma.gEOScoreSnapshot.create({ data })
  },

  async findMany(where: any, options?: { orderBy?: any; select?: any }): Promise<any[]> {
    return prisma.gEOScoreSnapshot.findMany({ where, ...options })
  },
}
