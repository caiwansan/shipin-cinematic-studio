/**
 * routes/novel-cron.ts — 小说自动发布定时任务 API
 *
 * 供 cron scheduler 调用的接口
 * POST /api/cron/novel-publish
 */

import type { FastifyInstance } from 'fastify'
import { autoPublishNovels } from '../services/novel-publisher.js'

export default async function novelCronRoutes(app: FastifyInstance) {
  app.post('/api/cron/novel-publish', async () => {
    const result = await autoPublishNovels()
    return { success: true, data: result }
  })
}
