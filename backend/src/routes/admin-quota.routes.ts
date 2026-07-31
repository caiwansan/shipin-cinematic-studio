/**
 * routes/admin-quota.routes.ts — Sprint-RECRUITMENT-REALITY-04 T03
 *
 * AI 员工额度 API（Admin）
 *  - GET  /api/admin/enterprise/quotas                 全企业配额总览
 *  - GET  /api/admin/enterprise/quotas/:organizationId 单企业配额
 *  - POST /api/admin/enterprise/quotas/recalc/:organizationId 重算用量
 */

import { FastifyInstance, FastifyReply } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { getQuotaOverview, getOrganizationQuota, recalcQuotaUsage } from '../services/enterprise/quota.service.js'

export default async function adminQuotaRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/enterprise/quotas', { preHandler: [requireAdmin] }, async () => {
    const rows = await getQuotaOverview()
    return { success: true, data: rows }
  })

  fastify.get('/api/admin/enterprise/quotas/:organizationId', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { organizationId } = request.params as { organizationId: string }
    const data = await getOrganizationQuota(organizationId)
    return { success: true, data }
  })

  fastify.post('/api/admin/enterprise/quotas/recalc/:organizationId', { preHandler: [requireAdmin] }, async (request: any, reply: FastifyReply) => {
    const { organizationId } = request.params as { organizationId: string }
    const data = await recalcQuotaUsage(organizationId)
    return { success: true, data }
  })
}
