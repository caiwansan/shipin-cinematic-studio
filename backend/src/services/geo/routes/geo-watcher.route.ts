// ============================================================
// GEO Watcher Routes — 前端检视器数据源
// Stage 3.2.1 — watcher_events 查询接口
// ============================================================

import { FastifyInstance } from 'fastify'
import { geoWatcherRepository } from '../repositories/geo-watcher.repository.js'

export default async function geoWatcherRoutes(fastify: FastifyInstance) {
  // GET /api/geo/watcher/recent — 最近的 watcher 事件
  fastify.get('/api/geo/watcher/recent', { preHandler: [] }, async (request, reply) => {
    const query = request.query as any
    const entityId = query?.entityId as string | undefined

    try {
      const rows = await geoWatcherRepository.findRecent(entityId)
      return { success: true, data: rows, events: rows }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/watcher/summary — 摘要统计
  fastify.get('/api/geo/watcher/summary', { preHandler: [] }, async (request, reply) => {
    try {
      const summary = await geoWatcherRepository.getSummary()
      return { success: true, data: summary }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/watcher/drift — 漂移检测结果
  fastify.get('/api/geo/watcher/drift', { preHandler: [] }, async (request, reply) => {
    try {
      const driftRows = await geoWatcherRepository.getDrift()
      return { success: true, data: driftRows, mismatches: driftRows }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
