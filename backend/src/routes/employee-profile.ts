/**
 * Employee Profile Routes — ER-02-TASK-01
 * AI Employee Profile View Layer API
 *
 * GET /api/enterprise/agent-profiles/:agentId/profile
 * 返回 AI 员工完整 Profile (View Layer, 无新增 Schema)
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 * 禁止 URL tenantId / body.organizationId / user.id fallback
 */
import type { FastifyInstance } from 'fastify'
import { employeeProfileService } from '../services/enterprise/employee-profile.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function employeeProfileRoutes(app: FastifyInstance) {
  // JWT 认证
  app.addHook('preHandler', app.authenticate)

  /**
   * GET /api/enterprise/agent-profiles/:agentId/profile
   * 获取 AI 员工完整 Profile
   */
  app.get('/:agentId/profile', async (request, reply) => {
    try {
      const user = request.user as any
      const { agentId } = request.params as { agentId: string }

      // Identity Resolution: JWT → organizationId
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      // 获取 Profile (View Layer 聚合)
      const profile = await employeeProfileService.getProfile(orgId, agentId)
      if (!profile) {
        return reply.status(404).send({ code: 404, message: 'AGENT_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: profile })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
