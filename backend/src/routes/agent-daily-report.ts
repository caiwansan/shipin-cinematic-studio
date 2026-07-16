/**
 * Enterprise AI Workforce — Agent Daily Report API
 * AI员工日报接口
 */
import type { FastifyInstance } from 'fastify'
import { agentDailyReportService } from '../services/enterprise/agent-daily-report.service.js'

export async function agentDailyReportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/enterprise/:tenantId/daily-reports?date=YYYY-MM-DD
  app.get('/api/enterprise/:tenantId/daily-reports', async (request, reply) => {
    const { tenantId } = request.params as any
    const { date } = request.query as any
    try {
      const reports = await agentDailyReportService.getDailyReports({ tenantId, date })
      return { success: true, data: reports }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/enterprise/:tenantId/agents/:agentId/daily-report?date=YYYY-MM-DD
  app.get('/api/enterprise/:tenantId/agents/:agentId/daily-report', async (request, reply) => {
    const { tenantId, agentId } = request.params as any
    const { date } = request.query as any
    try {
      const reports = await agentDailyReportService.getDailyReports({ tenantId, date })
      const agentReport = reports.find(r => r.agentId === agentId)
      if (!agentReport) return reply.status(404).send({ success: false, error: 'Agent 不存在或无日报' })
      return { success: true, data: agentReport }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
