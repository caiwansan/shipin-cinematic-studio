// ============================================================
// Audit Route — KMKI-PLAT-012
// ============================================================

import type { FastifyInstance } from 'fastify'
import { governanceService } from '../../../services/platform/governance/governance.service.js'

export default async function auditRoute(app: FastifyInstance): Promise<void> {
  // Log an action (internal use, but exposed for other runtimes)
  app.post('/api/platform/governance/audit/log', async (req, reply) => {
    const { action, tenantId, resource, resourceId, details } = req.body as any
    const log = await governanceService.audit.log(action, tenantId, resource, resourceId, details, (req as any).userId)
    return reply.code(201).send({ success: true, data: log })
  })

  // Query audit logs
  app.get('/api/platform/governance/audit/query/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { action, resource, userId, fromDate, toDate, limit, offset } = req.query as any
    const result = await governanceService.audit.queryAudit({
      tenantId,
      action: action as string,
      resource: resource as string,
      userId: userId as string,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    })
    return { success: true, data: result }
  })

  // Get recent audits
  app.get('/api/platform/governance/audit/recent/:tenantId', async (req, reply) => {
    const { tenantId } = req.params as any
    const { limit } = req.query as any
    const logs = await governanceService.audit.getRecent(tenantId, limit ? parseInt(limit) : 20)
    return { success: true, data: logs }
  })
}
