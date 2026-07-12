// ============================================================
// User Model Config V2 Repository — CRUD for UserModelConfigV2
// ============================================================

import { prisma } from '../../../utils/index.js'

export const userModelConfigV2Repository = {
  async findUnique(where: any): Promise<any | null> {
    // 兼容两种传参格式：findUnique({ userId }) 或 findUnique({ where: { userId } })
    const condition = where?.where ? { where: where.where } : { where };
    const record = await prisma.userModelConfigV2.findUnique(condition);
    return record;
  },
}
