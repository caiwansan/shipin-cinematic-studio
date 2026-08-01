/**
 * Enterprise Readonly — 企业侧只读查询（展示框架的真实数据源）
 *
 * Sprint-MEDIA-UX-01: 新媒体工作台「执行记录/能力目录」展示的真实数据源
 * - 只读，不写任何数据
 * - 归属强制：organizationId 来自 JWT 身份解析，禁止跨企业查询
 * - 复用 agent_outcome（统一结果层 SSOT）+ usage_logs（成本归因）+ CapabilityContract（能力目录）
 * - 无数据显示空数组，前端展示空态（禁 mock）
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

/** Unified identity resolver: get orgId from JWT user. */
async function resolveOrgId(request: any): Promise<string> {
  const user = request.user as any
  const userId = user?.id
  if (!userId) return ''

  if (user?.tenantId && user.tenantId !== userId) {
    return user.tenantId
  }

  try {
    const orgId = await getOrganizationIdForUser(userId)
    return orgId || ''
  } catch {
    return userId
  }
}

export async function registerEnterpriseOutcomeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  /**
   * GET /api/enterprise/outcomes
   * 企业侧真实执行结果（agent_outcome）+ 成本归因（usage_logs）
   *
   * Query:
   *   workspace (可选) 过滤业务线，如 media / recruitment / career；缺省查企业全部
   *   days      (可选) 时间窗口，默认 30
   *   limit     (可选) 条数上限，默认 20
   */
  app.get('/', async (request: any, reply: any) => {
    try {
      const organizationId = await resolveOrgId(request)
      if (!organizationId) {
        return reply.code(401).send({ code: 401, message: '无企业身份，无法查询执行记录' })
      }

      const query = request.query as { workspace?: string; days?: string; limit?: string }
      const workspace = query.workspace?.trim() || undefined
      const days = Math.min(Math.max(parseInt(query.days || '30', 10) || 30, 1), 365)
      const limit = Math.min(Math.max(parseInt(query.limit || '20', 10) || 20, 1), 100)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const where: any = {
        organizationId: organizationId as any,
        createdAt: { gte: since },
      }
      if (workspace) where.workspace = workspace

      const [items, byTypeAgg, usageAgg] = await Promise.all([
        prisma.agentOutcome.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            workspace: true,
            outcomeType: true,
            metricValue: true,
            metadata: true,
            createdAt: true,
            agentInstanceId: true,
          },
        }),
        prisma.agentOutcome.groupBy({
          by: ['outcomeType'],
          where,
          _count: { _all: true },
          _sum: { metricValue: true },
        }),
        prisma.usageLog.aggregate({
          where: { organizationId: organizationId as any, createdAt: { gte: since } },
          _sum: { cost: true },
          _count: { _all: true },
        }),
      ])

      const byType = byTypeAgg
        .map((g: any) => ({
          outcomeType: g.outcomeType,
          count: g._count?._all ?? 0,
          metricSum: g._sum?.metricValue ?? 0,
        }))
        .sort((a: any, b: any) => b.count - a.count)

      return reply.send({
        code: 0,
        data: {
          generatedAt: new Date().toISOString(),
          windowDays: days,
          workspace: workspace || 'all',
          total: items.length,
          items,
          byType,
          usage: {
            totalCost: usageAgg._sum.cost ?? 0,
            executions: usageAgg._count._all,
          },
        },
      })
    } catch (err: any) {
      request.log?.error?.(err)
      return reply.code(500).send({ code: 500, message: '查询执行记录失败', detail: String(err?.message || err).slice(0, 200) })
    }
  })
}
