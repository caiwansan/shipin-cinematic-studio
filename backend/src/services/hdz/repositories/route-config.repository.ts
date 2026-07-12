// ============================================================
// Route Config Repository — CRUD for RouteConfig
// ============================================================

import { prisma } from '../../../utils/index.js'

export const routeConfigRepository = {
  async findFirst(where: any): Promise<any | null> {
    const record = await prisma.routeConfig.findFirst({ where: where?.where || where })
    return record
  },
}
