// ============================================================
// Knowledge Package Repository — Minimal for Showcase
// ============================================================

import { prisma } from '../../../utils/index'

export const knowledgePackageRepository = {
  async count(where?: any): Promise<number> {
    return prisma.knowledgePackage.count({ where })
  },
}
