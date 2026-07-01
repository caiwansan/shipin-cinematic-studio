// ============================================================
// User Model Config V2 Repository — CRUD for UserModelConfigV2
// ============================================================

import { prisma } from '../../../utils/index.js'

export const userModelConfigV2Repository = {
  async findUnique(where: any): Promise<any | null> {
    const record = await prisma.userModelConfigV2.findUnique({ where })
    return record
  },
}
