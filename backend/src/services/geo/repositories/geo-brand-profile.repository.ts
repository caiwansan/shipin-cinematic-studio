// ============================================================
// GEO Brand Profile Repository — CRUD for GeoBrandProfile
// ============================================================

import { prisma } from '../../../utils/index'

export const geoBrandProfileRepository = {
  async count(where: any): Promise<number> {
    const effectiveWhere = where.where || where
    return prisma.geoBrandProfile.count({ where: effectiveWhere })
  },

  async findFirst(where: any, orderByOrOptions?: any): Promise<any | null> {
    // Support both (where, options) and ({ where, ... }) signatures
    const effectiveWhere = where.where || where
    const effectiveOptions = orderByOrOptions || (where.where ? { orderBy: where.orderBy, select: where.select } : undefined)
    if (effectiveOptions && effectiveOptions.select) {
      return prisma.geoBrandProfile.findFirst({ where: effectiveWhere, ...effectiveOptions })
    }
    return prisma.geoBrandProfile.findFirst({ where: effectiveWhere, orderBy: effectiveOptions })
  },
}
