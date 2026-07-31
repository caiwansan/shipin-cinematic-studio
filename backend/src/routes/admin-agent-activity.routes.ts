/**
 * routes/admin-agent-activity.routes.ts — Sprint-RECRUITMENT-REALITY-04 T02
 *
 * Agent Activity Center API（Admin）
 *  - GET /api/admin/enterprise/agent-activity?days=7&organizationId=
 */

import { FastifyInstance, FastifyReply } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { getActivityCenter, getRoiReport, getDailyReport } from '../services/enterprise/agent-activity.service.js'

export default async function adminAgentActivityRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/enterprise/agent-activity', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const q = (request.query || {}) as { days?: string; organizationId?: string }
    const days = q.days ? parseInt(q.days, 10) : 7
    const result = await getActivityCenter({ days, organizationId: q.organizationId || undefined })
    return { success: true, data: result }
  })

  // Sprint-05 T02: AI Workforce ROI Report
  // GET /api/admin/enterprise/roi-report?days=30&organizationId=
  fastify.get('/api/admin/enterprise/roi-report', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const q = (request.query || {}) as { days?: string; organizationId?: string }
    const days = q.days ? parseInt(q.days, 10) : 30
    const result = await getRoiReport({ days, organizationId: q.organizationId || undefined })
    return { success: true, data: result }
  })

  // Sprint-06 T02: AI 员工工作日报
  // GET /api/admin/enterprise/daily-report?organizationId=&date=YYYY-MM-DD（默认昨日）
  fastify.get('/api/admin/enterprise/daily-report', { preHandler: [requireAdmin] }, async (request: any) => {
    const q = (request.query || {}) as { days?: string; organizationId?: string; date?: string }
    const result = await getDailyReport({ organizationId: q.organizationId || undefined, date: q.date || undefined })
    return { success: true, data: result }
  })
}
