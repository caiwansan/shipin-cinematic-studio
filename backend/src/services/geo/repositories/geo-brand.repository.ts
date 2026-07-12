// ============================================================
// GEO Brand Repository — Minimal for Showcase
// ============================================================

import { prisma } from '../../../utils/index'

export const geoBrandRepository = {
  async count(where?: any): Promise<number> {
    return prisma.gEOBrand.count({ where })
  },
}
