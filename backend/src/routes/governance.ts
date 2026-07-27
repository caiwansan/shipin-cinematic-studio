/**
 * Engineering & Governance Adapter Routes — ER-05
 * OpenClaw as Engineering/Audit/Governance Agent
 *
 * POST /api/enterprise/governance/register     — 注册治理身份
 * GET  /api/enterprise/governance/identity/:orgId — 获取治理身份
 * POST /api/enterprise/governance/code-change  — 记录代码变更
 * POST /api/enterprise/governance/code-review  — 审核代码变更
 * GET  /api/enterprise/governance/pending/:orgId — 待审核变更
 * GET  /api/enterprise/governance/audit/:orgId  — 审计日志
 * GET  /api/enterprise/governance/audit/:orgId/stats — 审计统计
 * GET  /api/enterprise/governance/audit/:orgId/export — 导出审计报告
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { governanceAdapterService } from '../services/enterprise/governance-adapter.service.js'
import { codeGovernanceService } from '../services/enterprise/code-governance.service.js'
import { engineeringAuditService } from '../services/enterprise/engineering-audit.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function governanceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/enterprise/governance/register
   * 注册治理身份
   */
  app.post('/register', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const identity = await governanceAdapterService.registerIdentity({
        type: body?.type || 'ENGINEERING_AGENT',
        name: body?.name || 'OpenClaw Engineering',
        scope: body?.scope || 'SYSTEM_GOVERNANCE',
        organizationId: orgId,
        capabilities: body?.capabilities || ['code_review', 'architecture_review', 'audit'],
      })

      return reply.send({ code: 0, data: identity })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/governance/identity/:orgId
   * 获取治理身份
   */
  app.get('/identity/:orgId', async (request, reply) => {
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

      const identity = await governanceAdapterService.getIdentity(orgId)
      if (!identity) {
        return reply.status(404).send({ code: 404, message: 'GOVERNANCE_IDENTITY_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: identity })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/governance/code-change
   * 记录代码变更
   */
  app.post('/code-change', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { agentId, changeType, targetFile, description } = body

      if (!agentId || !changeType || !targetFile) {
        return reply.status(400).send({ code: 400, message: 'MISSING_PARAMS' })
      }

      const record = await codeGovernanceService.recordChange({
        organizationId: orgId,
        agentId,
        changeType,
        targetFile,
        description,
      })

      return reply.send({ code: 0, data: record })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * POST /api/enterprise/governance/code-review
   * 审核代码变更
   */
  app.post('/code-review', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const body = request.body as any
      const { changeId, status, reason } = body

      if (!changeId || !status) {
        return reply.status(400).send({ code: 400, message: 'MISSING_PARAMS' })
      }

      const result = await codeGovernanceService.reviewChange(changeId, {
        status,
        reviewer: user?.id || 'system',
        reason: reason || '',
      })

      if (!result) {
        return reply.status(404).send({ code: 404, message: 'CHANGE_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/governance/pending/:orgId
   * 获取待审核变更
   */
  app.get('/pending/:orgId', async (request, reply) => {
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

      const pending = await codeGovernanceService.getPendingChanges(orgId)
      return reply.send({ code: 0, data: pending })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/governance/audit/:orgId
   * 审计日志查询
   */
  app.get('/audit/:orgId', async (request, reply) => {
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

      const { agentId, action, startDate, endDate, limit } = request.query as any
      const entries = await engineeringAuditService.queryAudit({
        organizationId: orgId,
        agentId,
        action,
        startDate,
        endDate,
        limit: limit ? parseInt(limit) : undefined,
      })

      return reply.send({ code: 0, data: entries })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/governance/audit/:orgId/stats
   * 审计统计
   */
  app.get('/audit/:orgId/stats', async (request, reply) => {
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
      const stats = await engineeringAuditService.getAuditStats(orgId, agentId)
      return reply.send({ code: 0, data: stats })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/governance/audit/:orgId/export
   * 导出审计报告
   */
  app.get('/audit/:orgId/export', async (request, reply) => {
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

      const { startDate, endDate, format } = request.query as any
      const report = await engineeringAuditService.exportAuditReport(orgId, {
        startDate,
        endDate,
        format: format || 'json',
      })

      if (format === 'csv') {
        reply.header('Content-Type', 'text/csv')
        reply.header('Content-Disposition', 'attachment; filename="audit-report.csv"')
      } else {
        reply.header('Content-Type', 'application/json')
      }

      return reply.send(report)
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
