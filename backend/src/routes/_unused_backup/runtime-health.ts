/**
 * Runtime Health Routes — ER-04-TASK-05
 * AI Employee Runtime Health Monitor API
 *
 * GET /api/enterprise/runtime-health/:orgId        → 完整健康状态
 * GET /api/enterprise/runtime-health/:orgId/metrics → 轻量指标
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { runtimeHealthService } from '../services/enterprise/runtime-health.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function runtimeHealthRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * GET /api/enterprise/runtime-health/:orgId
   * 获取完整 Runtime 健康状态
   */
  app.get('/:orgId', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const { orgId: targetOrgId } = request.params as { orgId: string }
      if (targetOrgId !== orgId) {
        return reply.status(403).send({ code: 403, message: 'FORBIDDEN' })
      }

      const health = await runtimeHealthService.getHealth(orgId)
      if (!health) {
        return reply.status(404).send({ code: 404, message: 'RUNTIME_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: health })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/runtime-health/:orgId/metrics
   * 获取轻量指标 (用于 Dashboard)
   */
  app.get('/:orgId/metrics', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const { orgId: targetOrgId } = request.params as { orgId: string }
      if (targetOrgId !== orgId) {
        return reply.status(403).send({ code: 403, message: 'FORBIDDEN' })
      }

      const metrics = await runtimeHealthService.getMetrics(orgId)
      if (!metrics) {
        return reply.status(404).send({ code: 404, message: 'RUNTIME_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: metrics })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
