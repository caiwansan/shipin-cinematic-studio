// ============================================================
// Timeline API — GEO Workspace 事件投影 API
//
// 统一入口：GET /api/geo/timeline
// 所有业务事件（Optimization / Knowledge / Verification / Health）
// 通过 Timeline Engine 投影返回
// ============================================================

import { FastifyInstance } from 'fastify'
import { timelineEngine } from './timeline.js'

export async function geoWorkspaceTimelineRoutes(app: FastifyInstance) {
  // ── 项目时间线 ──
  // GET /api/geo/timeline?projectId=xxx&limit=50
  app.get('/api/geo/timeline', async (req, reply) => {
    const { projectId, limit } = req.query as { projectId?: string; limit?: string }

    if (!projectId) {
      return reply.status(400).send({ success: false, error: 'projectId required' })
    }

    const events = await timelineEngine.getProjectTimeline(
      projectId,
      limit ? parseInt(limit, 10) : 50
    )

    return { success: true, data: events }
  })
}
