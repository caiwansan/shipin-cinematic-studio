// ============================================================
// User Model Config Repository — CRUD for UserModelConfigV2
// ============================================================

import { prisma } from '../../../utils/index'

export const userModelConfigRepository = {
  async findUnique(where: any): Promise<any | null> {
    return prisma.userModelConfigV2.findUnique({ where })
  },
}
