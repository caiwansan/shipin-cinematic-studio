// ============================================================
// GEO Watcher Routes — 前端检视器数据源
// Stage 3.2.1 — watcher_events 查询接口
// ============================================================

import { FastifyInstance } from 'fastify'
import { prisma } from '../../../utils/index.js'

export default async function geoWatcherRoutes(fastify: FastifyInstance) {
  // GET /api/geo/watcher/recent — 最近的 watcher 事件
  fastify.get('/api/geo/watcher/recent', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as any
    const entityId = query?.entityId as string | undefined

    try {
      let rows: any[]
      if (entityId) {
        rows = await prisma.$queryRawUnsafe(
          `SELECT id, entity, entity_id, operation, status, latency_ms, error, created_at::text
           FROM dual_write_watcher_events
           WHERE entity_id = $1::uuid
           ORDER BY created_at DESC
           LIMIT 50`,
          entityId
        )
      } else {
        rows = await prisma.$queryRawUnsafe(
          `SELECT id::text, entity, entity_id::text, operation, status, latency_ms, error, created_at::text
           FROM dual_write_watcher_events
           ORDER BY created_at DESC
           LIMIT 50`
        )
      }
      return { success: true, data: rows, events: rows }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/watcher/summary — 摘要统计
  fastify.get('/api/geo/watcher/summary', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const counts = await prisma.$queryRawUnsafe<Array<{ status: string; count: bigint }>>(
        `SELECT status, COUNT(*) as count FROM dual_write_watcher_events GROUP BY status`
      )
      const summary: Record<string, number> = {}
      for (const row of counts) {
        summary[row.status] = Number(row.count)
      }
      return { success: true, data: summary }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/watcher/drift — 漂移检测结果
  fastify.get('/api/geo/watcher/drift', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const driftRows = await prisma.$queryRawUnsafe<Array<{ entity: string; entity_id: string; diff: string; created_at: string }>>(
        `SELECT entity, entity_id::text, diff, created_at::text
         FROM dual_write_watcher_events
         WHERE diff IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 20`
      )
      return { success: true, data: driftRows, mismatches: driftRows }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
