/**
 * Enterprise Security Audit Routes — GA-05
 * Production Security Audit + Tenant Isolation Verification
 *
 * GET  /api/enterprise/security/audit        — 执行完整安全审计
 * GET  /api/enterprise/security/tenant       — Tenant Isolation 检查
 * GET  /api/enterprise/security/runtime      — Runtime Reliability 检查
 * GET  /api/enterprise/security/cost         — Cost Guard 检查
 * GET  /api/enterprise/security/permission   — Permission Security 检查
 * GET  /api/enterprise/security/channel      — Channel Security 检查
 *
 * Identity: JWT → getOrganizationIdForUser() → organizationId
 */
import type { FastifyInstance } from 'fastify'
import { securityAuditService } from '../services/enterprise/security-audit.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function securityRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * GET /api/enterprise/security/audit
   * 完整安全审计
   */
  app.get('/audit', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const result = await securityAuditService.performAudit(orgId)
      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/security/tenant
   * Tenant Isolation 检查
   */
  app.get('/tenant', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const result = await securityAuditService.auditTenantIsolation(orgId)
      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/security/runtime
   * Runtime Reliability 检查
   */
  app.get('/runtime', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const result = await securityAuditService.auditRuntimeReliability(orgId)
      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/security/cost
   * Cost Guard 检查
   */
  app.get('/cost', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const result = await securityAuditService.auditCostGuard(orgId)
      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/security/permission
   * Permission Security 检查
   */
  app.get('/permission', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const result = await securityAuditService.auditPermissionSecurity(orgId)
      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  /**
   * GET /api/enterprise/security/channel
   * Channel Security 检查
   */
  app.get('/channel', async (request, reply) => {
    try {
      const user = request.user as any
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const result = await securityAuditService.auditChannelSecurity(orgId)
      return reply.send({ code: 0, data: result })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}
