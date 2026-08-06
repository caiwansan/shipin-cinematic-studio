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

  // S6.4 B1: Billing Overview（只读, 企业价值可视化; 非支付）
  // 席位推导（产品视图, 不修 max_agents）: 实际员工数 = capabilityCodes 数量; 1=Basic/3=Professional/10=Enterprise
  // capabilities 必须来自 agent_definition（F1, 禁手写）; 禁 ROI 承诺
  app.get('/api/admin/billing/overview', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const orgId = await requireOrgAdmin(request, reply)
      if (!orgId) return
      const { getEmployeeUsageMeter } = await import('../ecosystem/skill-orchestrator.js')
      const ent = await prisma.enterpriseEntitlement.findFirst({
        where: { organizationId: orgId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)
      const codes = (() => {
        try { const c = ent?.capabilityCodes; return Array.isArray(c) ? c : [] } catch { return [] }
      })()
      // 席位推导（产品视图）: 1=Basic / 3=Professional / 10=Enterprise
      const tier = codes.length <= 1 ? 'Basic' : codes.length <= 3 ? 'Professional' : 'Enterprise'
      const limit = codes.length <= 1 ? 1 : codes.length <= 3 ? 3 : 10
      const defs = codes.length
        ? await prisma.agentDefinition.findMany({ where: { code: { in: codes } }, select: { code: true, name: true, capabilities: true } }).catch(() => [])
        : []
      const defMap = new Map((defs as any[]).map((d) => [d.code, d]))
      const employees = []
      let totalExecutions = 0
      let activeEmployees = 0
      for (const code of codes) {
        const d = defMap.get(code)
        const caps = (() => { try { const c = JSON.parse(d?.capabilities || '[]'); return Array.isArray(c) ? c : [] } catch { return [] } })()
        const meter = await getEmployeeUsageMeter(request.user.id, code).catch(() => null)
        const executions = meter?.executions || 0
        totalExecutions += executions
        if (executions > 0) activeEmployees++
        employees.push({
          code,
          name: d?.name || code,
          capabilities: caps, // F1: agent_definition 唯能力源
          usage: { executions, successful: meter?.successful || 0, failed: meter?.failed || 0 },
        })
      }
      // 插件增强摘要
      const licenses = await prisma.ecologyLicense.findMany({ where: { organizationId: orgId, status: 'ACTIVE' }, select: { pluginId: true } }).catch(() => [])
      const pluginIds = licenses.map((l: any) => l.pluginId)
      const plugins = pluginIds.length
        ? await prisma.ecologyPlugin.findMany({ where: { id: { in: pluginIds } }, select: { pluginId: true, manifest: true } }).catch(() => [])
        : []
      const pluginItems = (plugins as any[]).map((p) => ({
        code: p.pluginId,
        enhancements: Array.isArray((p.manifest as any)?.enhancements) ? (p.manifest as any).enhancements.map((e: any) => e.type) : [],
      }))
      return reply.send({
        code: 0,
        data: {
          plan: { tier, employeeLimit: limit, employeeCount: codes.length, source: 'derived' },
          employees,
          plugins: pluginItems,
          activity: { totalExecutions, activeEmployees, enabledEnhancements: pluginItems.reduce((n: number, p: any) => n + p.enhancements.length, 0) },
        },
      })
    } catch (e: any) {
      request.log.error(e, 'admin billing overview failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
