/**
 * Hermes Profile Routes — ER-04-TASK-01
 * AI Employee Runtime Binding API
 *
 * POST   /api/enterprise/hermes-profiles/bind      → 创建绑定
 * GET    /api/enterprise/hermes-profiles/:orgId     → 查询组织绑定
 * GET    /api/enterprise/hermes-profiles/:orgId/list → 列出所有绑定
 * PUT    /api/enterprise/hermes-profiles/:orgId     → 更新状态
 * DELETE /api/enterprise/hermes-profiles/:orgId     → 删除绑定
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 * 禁止 URL tenantId / body.organizationId / user.id fallback
 */
import type { FastifyInstance } from 'fastify'
import { hermesProfileService } from '../services/enterprise/hermes-profile.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function hermesProfileRoutes(app: FastifyInstance) {
  // JWT 认证
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/enterprise/hermes-profiles/bind
   * 创建 Hermes Profile Binding
   */
  app.post('/bind', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const binding = await hermesProfileService.createBinding({
        organizationId: orgId,
        workspaceId: body?.workspaceId,
        hermesProfileId: body?.hermesProfileId,
        identityProvider: body?.identityProvider || 'hermes',
        toolAllowList: body?.toolAllowList || [],
      })

      return reply.send({ code: 0, data: binding })
    } catch (error: any) {
      if (error.message === 'BINDING_ALREADY_EXISTS') {
        return reply.status(409).send({ code: 409, message: 'BINDING_ALREADY_EXISTS' })
      }
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/hermes-profiles/:orgId
   * 获取组织的 Hermes Binding
   */
  app.get('/:orgId', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const { orgId: targetOrgId } = request.params as { orgId: string }
      // 仅允许查询自己的组织
      if (targetOrgId !== orgId) {
        return reply.status(403).send({ code: 403, message: 'FORBIDDEN' })
      }

      const binding = await hermesProfileService.getBindingByOrg(orgId)
      if (!binding) {
        return reply.status(404).send({ code: 404, message: 'BINDING_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: binding })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/hermes-profiles/:orgId/list
   * 列出组织的所有 Bindings
   */
  app.get('/:orgId/list', async (request, reply) => {
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

      const bindings = await hermesProfileService.listBindings(orgId)
      return reply.send({ code: 0, data: bindings })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * PUT /api/enterprise/hermes-profiles/:orgId
   * 更新 Binding 状态
   */
  app.put('/:orgId', async (request, reply) => {
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

      const body = request.body as any
      const { status, soulMdContent, toolAllowList } = body

      let result: any = null

      if (status) {
        result = await hermesProfileService.updateStatus(orgId, status)
      } else if (soulMdContent) {
        result = await hermesProfileService.updateSoulContent(orgId, soulMdContent)
      } else if (toolAllowList) {
        result = await hermesProfileService.updateToolAllowList(orgId, toolAllowList)
      }

      if (!result) {
        return reply.status(400).send({ code: 400, message: 'NO_UPDATE_FIELD' })
      }

      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * DELETE /api/enterprise/hermes-profiles/:orgId
   * 删除 Binding
   */
  app.delete('/:orgId', async (request, reply) => {
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

      const success = await hermesProfileService.deleteBinding(orgId)
      if (!success) {
        return reply.status(404).send({ code: 404, message: 'BINDING_NOT_FOUND' })
      }

      return reply.send({ code: 0, message: 'DELETED' })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
