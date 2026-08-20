/**
 * Memory Intelligence Routes — ER-03
 * Enterprise Memory Classification + Governance + Outcome Bridge
 *
 * POST /api/enterprise/memory/classify       — 分类并存储记忆
 * POST /api/enterprise/memory/govern         — 创建治理规则
 * GET  /api/enterprise/memory/govern/:orgId  — 获取治理规则
 * GET  /api/enterprise/memory/:orgId         — 查询记忆
 * GET  /api/enterprise/memory/:orgId/stats   — 记忆统计
 * POST /api/enterprise/memory/outcome-bridge — 成果桥接
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { memoryIntelligenceService } from '../services/enterprise/memory-intelligence.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function memoryIntelligenceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/enterprise/memory/classify
   * 分类并存储记忆
   */
  app.post('/classify', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { agentId, content, source, sessionId, taskId } = body

      if (!agentId || !content || !source) {
        return reply.status(400).send({ code: 400, message: 'MISSING_PARAMS' })
      }

      const record = await memoryIntelligenceService.storeMemory(orgId, agentId, content, {
        source,
        sessionId,
        taskId,
      })

      return reply.send({ code: 0, data: record })
    } catch (error: any) {
      if (error.message?.startsWith('MEMORY_GOVERNANCE_DENIED')) {
        return reply.status(403).send({ code: 403, message: error.message })
      }
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/memory/govern
   * 创建治理规则
   */
  app.post('/govern', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { agentId, agentRole, allowedTypes, deniedTypes, maxRetentionDays } = body

      const rule = await memoryIntelligenceService.createGovernanceRule({
        organizationId: orgId,
        agentId,
        agentRole,
        allowedTypes: allowedTypes || [],
        deniedTypes: deniedTypes || [],
        maxRetentionDays: maxRetentionDays || 90,
      })

      return reply.send({ code: 0, data: rule })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/memory/govern/:orgId
   * 获取治理规则
   */
  app.get('/govern/:orgId', async (request, reply) => {
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

      const rules = await memoryIntelligenceService.getGovernanceRules(orgId)
      return reply.send({ code: 0, data: rules })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/memory/:orgId
   * 查询记忆
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

      const { agentId, category, type, limit } = request.query as any
      const memories = await memoryIntelligenceService.queryMemories(orgId, agentId, {
        category,
        type,
        limit: limit ? parseInt(limit) : undefined,
      })

      return reply.send({ code: 0, data: memories })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/memory/:orgId/stats
   * 记忆统计
   */
  app.get('/:orgId/stats', async (request, reply) => {
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

      const { agentId } = request.query as any
      if (!agentId) {
        return reply.status(400).send({ code: 400, message: 'MISSING_AGENT_ID' })
      }

      const stats = await memoryIntelligenceService.getMemoryStats(orgId, agentId)
      return reply.send({ code: 0, data: stats })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/memory/outcome-bridge
   * 成果桥接: Outcome → Experience → Memory
   */
  app.post('/outcome-bridge', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { agentId, outcomeId } = body

      if (!agentId || !outcomeId) {
        return reply.status(400).send({ code: 400, message: 'MISSING_PARAMS' })
      }

      const record = await memoryIntelligenceService.bridgeOutcomeToMemory(orgId, agentId, outcomeId)
      if (!record) {
        return reply.status(404).send({ code: 404, message: 'OUTCOME_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: record })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
