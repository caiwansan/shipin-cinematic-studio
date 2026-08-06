/**
 * S6.3 Enterprise Admin Console Reality — 企业管理员 API
 * 身份权威 = JWT → organizationId（getOrganizationIdForUser）→ 管理员校验（Organization.ownerId）
 * 禁止: tenantId 参数 / 客户端自报（S4.4 身份权威原则）
 * 只读（管理员视角）: 员工授权 / 员工用量 / 插件授权
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

/** 企业管理员判定（纯函数）: org 的 owner 即企业管理员 */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  if (!userId || !orgId) return false
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { ownerId: true } }).catch(() => null)
  return org?.ownerId === userId
}

export async function registerEnterpriseAdminRoutes(app: FastifyInstance) {
  // 统一: JWT → orgId → isOrgAdmin
  async function requireOrgAdmin(request: any, reply: any): Promise<string | null> {
    const userId = request.user?.id
    if (!userId) { reply.code(401).send({ error: 'UNAUTHORIZED' }); return null }
    const { getOrganizationIdForUser } = await import('../services/enterprise/organization/identity-bootstrap.service.js')
    const orgId = await getOrganizationIdForUser(userId).catch(() => null)
    if (!orgId) { reply.code(403).send({ error: 'NO_ORGANIZATION' }); return null }
    const admin = await isOrgAdmin(userId, String(orgId))
    if (!admin) { reply.code(403).send({ error: 'FORBIDDEN', message: '非企业管理员' }); return null }
    return String(orgId)
  }

  // EA2/EA3: 企业员工授权 + 用量总览
  app.get('/api/admin/employees', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const orgId = await requireOrgAdmin(request, reply)
      if (!orgId) return
      const ent = await prisma.enterpriseEntitlement.findFirst({
        where: { organizationId: orgId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)
      const codes = (() => {
        try { const c = ent?.capabilityCodes; return Array.isArray(c) ? c : [] } catch { return [] }
      })()
      const { getEmployeeUsageMeter } = await import('../ecosystem/skill-orchestrator.js')
      const employees = []
      for (const code of codes) {
        const meter = await getEmployeeUsageMeter(request.user.id, code).catch(() => null)
        employees.push({
          employeeCode: code,
          authorized: true,
          usage: meter ? { executions: meter.executions, successful: meter.successful, failed: meter.failed } : null,
        })
      }
      return reply.send({ code: 0, data: { organizationId: orgId, employees } })
    } catch (e: any) {
      request.log.error(e, 'admin employees failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // 单员工用量（管理员视角）
  app.get('/api/admin/employees/:code/usage', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const orgId = await requireOrgAdmin(request, reply)
      if (!orgId) return
      const { getEmployeeUsageMeter } = await import('../ecosystem/skill-orchestrator.js')
      const meter = await getEmployeeUsageMeter(request.user.id, request.params.code)
      return reply.send({ code: 0, data: { organizationId: orgId, employeeCode: request.params.code, ...meter } })
    } catch (e: any) {
      request.log.error(e, 'admin employee usage failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // EA4: 企业插件授权（EcologyLicense + 插件名/enhancements 摘要）
  app.get('/api/admin/plugins', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const orgId = await requireOrgAdmin(request, reply)
      if (!orgId) return
      const licenses = await prisma.ecologyLicense.findMany({
        where: { organizationId: orgId },
        select: { pluginId: true, pluginVersion: true, status: true, licenseType: true, expireAt: true },
      }).catch(() => [])
      const pluginIds = licenses.map((l: any) => l.pluginId)
      const plugins = pluginIds.length
        ? await prisma.ecologyPlugin.findMany({ where: { id: { in: pluginIds } }, select: { id: true, pluginId: true, name: true, manifest: true } }).catch(() => [])
        : []
      const pluginMap = new Map((plugins as any[]).map((p) => [p.id, p]))
      const items = licenses.map((l: any) => {
        const p = pluginMap.get(l.pluginId)
        const enhs = Array.isArray((p?.manifest as any)?.enhancements) ? (p?.manifest as any).enhancements.map((e: any) => e.type) : []
        return { licenseStatus: l.status, pluginCode: p?.pluginId || null, name: p?.name || null, licenseType: l.licenseType, expireAt: l.expireAt, enhancements: enhs }
      })
      return reply.send({ code: 0, data: { organizationId: orgId, plugins: items } })
    } catch (e: any) {
      request.log.error(e, 'admin plugins failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
