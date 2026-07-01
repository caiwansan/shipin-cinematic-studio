// ============================================================
// API Key Repository — CRUD for ApiKey
// ============================================================

import { prisma } from '../../../utils/index'

export const apiKeyRepository = {
  async findUnique(where: any): Promise<any | null> {
    return prisma.apiKey.findUnique({ where })
  },
}
