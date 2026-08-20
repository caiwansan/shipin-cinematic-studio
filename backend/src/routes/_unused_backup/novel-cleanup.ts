/**
 * routes/novel-cleanup.ts — 新书过期清理 API
 * POST /api/cron/novel-cleanup
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function novelCleanupRoutes(app: FastifyInstance) {
  app.post('/api/cron/novel-cleanup', async () => {
    const result = await prisma.novelPost.updateMany({
      where: { isNewBook: true, newBookUntil: { lte: new Date() } },
      data: { isNewBook: false },
    })
    return { success: true, data: { cleaned: result.count } }
  })
}
