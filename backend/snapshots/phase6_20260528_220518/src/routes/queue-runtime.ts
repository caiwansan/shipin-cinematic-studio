import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/queue-runtime.ts — 队列管理与监控 API（管理端）
 * 已迁移到统一队列 (ai-runtime)
 */
import { FastifyInstance } from 'fastify'
import { unifiedQueue, getQueueStats, type TaskType } from '../queue/queue-manager.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function queueRuntimeRoutes(fastify: FastifyInstance) {
  // GET /api/admin/queue/status — 队列状态总览
  fastify.get('/api/admin/queue/status', { preHandler: [requireAdmin] }, async () => {
    const stats = await getQueueStats()
    return { success: true, queues: stats.queues, dlq: stats.dlq } satisfies ApiResponse<unknown>;

  })

  // POST /api/admin/queue/pause — 暂停统一队列
  fastify.post('/api/admin/queue/pause', { preHandler: [requireAdmin] }, async () => {
    await unifiedQueue.pause()
    return { success: true, message: '统一队列已暂停' } satisfies ApiResponse<unknown>;

  })

  // POST /api/admin/queue/resume — 恢复统一队列
  fastify.post('/api/admin/queue/resume', { preHandler: [requireAdmin] }, async () => {
    await unifiedQueue.resume()
    return { success: true, message: '统一队列已恢复' } satisfies ApiResponse<unknown>;

  })
}
