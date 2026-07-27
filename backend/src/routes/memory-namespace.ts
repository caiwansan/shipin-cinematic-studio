/**
 * Memory Namespace Routes — ER-04-TASK-04
 * AI Employee Memory Isolation API
 *
 * GET  /api/enterprise/memory-namespaces/:orgId          → 列出命名空间
 * GET  /api/enterprise/memory-namespaces/:orgId/:agentId  → 获取命名空间
 * POST /api/enterprise/memory-namespaces/validate          → 校验访问
 * POST /api/enterprise/memory-namespaces/:orgId/create     → 创建命名空间
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { memoryNamespaceService } from '../services/enterprise/memory-namespace.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function memoryNamespaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * GET /api/enterprise/memory-namespaces/:orgId
   * 列出组织下所有 Memory Namespaces
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

      const namespaces = await memoryNamespaceService.listNamespaces(orgId)
      return reply.send({ code: 0, data: namespaces })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/memory-namespaces/:orgId/:agentId
   * 获取指定 Agent 的 Memory Namespace
   */
  app.get('/:orgId/:agentId', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const { orgId: targetOrgId, agentId } = request.params as { orgId: string; agentId: string }
      if (targetOrgId !== orgId) {
        return reply.status(403).send({ code: 403, message: 'FORBIDDEN' })
      }

      const namespace = await memoryNamespaceService.getNamespace(orgId, agentId)
      if (!namespace) {
        return reply.status(404).send({ code: 404, message: 'NAMESPACE_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: namespace })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/memory-namespaces/validate
   * 校验 Memory 访问是否合法
   */
  app.post('/validate', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { targetOrgId, targetAgentId, agentId } = body

      const result = memoryNamespaceService.validateAccess(
        orgId,
        agentId || '',
        targetOrgId,
        targetAgentId,
      )

      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/memory-namespaces/:orgId/create
   * 创建 Memory Namespace
   */
  app.post('/:orgId/create', async (request, reply) => {
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
      const { agentId } = body

      const namespace = await memoryNamespaceService.createNamespace(orgId, agentId)
      return reply.send({ code: 0, data: namespace })
    } catch (error: any) {
      if (error.message === 'HERMES_BINDING_NOT_FOUND') {
        return reply.status(404).send({ code: 404, message: 'HERMES_BINDING_NOT_FOUND' })
      }
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
