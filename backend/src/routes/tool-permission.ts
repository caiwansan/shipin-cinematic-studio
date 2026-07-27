/**
 * Tool Permission Routes — ER-04-TASK-03
 * AI Employee Tool Permission Matrix API
 *
 * POST /api/enterprise/tool-permissions/generate  → 生成权限矩阵
 * POST /api/enterprise/tool-permissions/sync       → 同步到 Binding
 * GET  /api/enterprise/tool-permissions/:orgId     → 获取当前权限
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { toolPermissionService } from '../services/enterprise/tool-permission.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function toolPermissionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/enterprise/tool-permissions/generate
   * 生成 Tool Permission Matrix
   */
  app.post('/generate', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const matrix = await toolPermissionService.generateMatrix(orgId, body?.agentId)

      return reply.send({ code: 0, data: matrix })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/tool-permissions/sync
   * 同步 Tool Allow List 到 Hermes Binding
   */
  app.post('/sync', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const matrix = await toolPermissionService.syncToBinding(orgId, body?.agentId)

      return reply.send({ code: 0, data: matrix })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/tool-permissions/:orgId
   * 获取当前 Binding 的 Tool Allow List
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

      const tools = await toolPermissionService.getBindingTools(orgId)
      return reply.send({ code: 0, data: { toolAllowList: tools } })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
