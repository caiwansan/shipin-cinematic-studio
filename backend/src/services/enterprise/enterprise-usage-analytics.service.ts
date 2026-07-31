/**
 * enterprise-usage-analytics.service.ts — Sprint-10B Usage Intelligence Layer
 *
 * AI Employee 商业计量聚合服务。
 *
 * 原则：
 *   - ❌ 不新建表
 *   - ❌ 不复制数据
 *   - ✅ EnterpriseAgentTask 为主源
 *   - ✅ UsageLog 为辅助补全（provider 明细）
 *
 * 提供：
 *   - getOrganizationUsage()   — 企业维度汇总
 *   - getAgentUsage()          — 单个 AI 员工明细
 *   - getCostSummary()         — 成本趋势与分布
 *   - getQuotaConsumption()    — 套餐额度使用状态
 */

import { prisma } from '../../utils/index.js'

export type UsagePeriod = {
  from?: Date
  to?: Date
}

export type OrgUsageSummary = {
  organizationId: string
  period: { from: Date; to: Date }
  totalTasks: number
  successTasks: number
  failedTasks: number
  totalTokens: number
  totalCost: number
  avgDurationMs: number
  byTaskType: Array<{
    taskType: string
    count: number
    totalTokens: number
    totalCost: number
  }>
  byAgent: Array<{
    agentInstanceId: string
    count: number
    totalTokens: number
    totalCost: number
  }>
}

export type AgentUsageSummary = {
  agentInstanceId: string
  organizationId: string
  period: { from: Date; to: Date }
  totalTasks: number
  successTasks: number
  failedTasks: number
  totalTokens: number
  totalCost: number
  avgDurationMs: number
  byTaskType: Array<{
    taskType: string
    count: number
    totalTokens: number
    totalCost: number
  }>
  dailyTrend: Array<{
    date: string
    count: number
    totalTokens: number
    totalCost: number
  }>
}

export type CostSummary = {
  organizationId: string
  period: { from: Date; to: Date }
  totalCost: number
  dailyCost: Array<{ date: string; cost: number }>
  topAgents: Array<{ agentInstanceId: string; cost: number; taskCount: number }>
  topCapabilities: Array<{ taskType: string; cost: number; count: number }>
  costPerTask: number
  tokenCostRate: number // cost per 1K tokens
}

export type QuotaConsumption = {
  organizationId: string
  entitlementStatus: string
  maxAgents: number
  activeAgents: number
  remainingAgentSlots: number
  periodTasks: number
  periodCost: number
  periodTokens: number
  quotaPercentage: number // activeAgents / maxAgents
}

/**
 * 默认回溯期（近 30 天）
 */
function defaultPeriod(): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from, to }
}

export class EnterpriseUsageAnalytics {
  // ─── 企业维度汇总 ──────────────────────────────

  async getOrganizationUsage(
    organizationId: string,
    period?: UsagePeriod,
  ): Promise<OrgUsageSummary> {
    const { from, to } = { ...defaultPeriod(), ...period }

    const where = {
      organizationId,
      startedAt: { gte: from, lte: to },
    }

    // 基础聚合
    const [taskStats, byTaskType, byAgent] = await Promise.all([
      prisma.enterpriseAgentTask.aggregate({
        where,
        _count: { id: true },
        _sum: { tokenInput: true, tokenOutput: true, cost: true, durationMs: true },
      }),
      (prisma.enterpriseAgentTask.groupBy as any)({
        by: ['taskType'],
        where,
        _count: { id: true },
        _sum: { tokenInput: true, tokenOutput: true, cost: true },
        orderBy: { _sum: { cost: 'desc' } },
      }) as Promise<any[]>,
      (prisma.enterpriseAgentTask.groupBy as any)({
        by: ['agentInstanceId'],
        where,
        _count: { id: true },
        _sum: { tokenInput: true, tokenOutput: true, cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 10,
      }) as Promise<any[]>,
    ])

    // 失败任务数
    const failedCount = await prisma.enterpriseAgentTask.count({
      where: { ...where, status: 'failed' },
    })

    const totalTasks = taskStats._count.id
    const totalCost = taskStats._sum.cost || 0
    const totalTokens = (taskStats._sum.tokenInput || 0) + (taskStats._sum.tokenOutput || 0)

    return {
      organizationId,
      period: { from, to },
      totalTasks,
      successTasks: totalTasks - failedCount,
      failedTasks: failedCount,
      totalTokens,
      totalCost,
      avgDurationMs: totalTasks > 0 ? Math.round((taskStats._sum.durationMs || 0) / totalTasks) : 0,
      byTaskType: byTaskType.map((t: any) => ({
        taskType: t.taskType,
        count: t._count.id,
        totalTokens: (t._sum.tokenInput || 0) + (t._sum.tokenOutput || 0),
        totalCost: t._sum.cost || 0,
      })),
      byAgent: byAgent.map((a: any) => ({
        agentInstanceId: a.agentInstanceId,
        count: a._count.id,
        totalTokens: (a._sum.tokenInput || 0) + (a._sum.tokenOutput || 0),
        totalCost: a._sum.cost || 0,
      })),
    }
  }

  // ─── 单个 AI 员工明细 ──────────────────────────

  async getAgentUsage(
    agentInstanceId: string,
    period?: UsagePeriod,
  ): Promise<AgentUsageSummary> {
    const { from, to } = { ...defaultPeriod(), ...period }

    const where = {
      agentInstanceId,
      startedAt: { gte: from, lte: to },
    }

    const [taskStats, byTaskType, dailyTasks, instance] = await Promise.all([
      prisma.enterpriseAgentTask.aggregate({
        where,
        _count: { id: true },
        _sum: { tokenInput: true, tokenOutput: true, cost: true, durationMs: true },
      }),
      (prisma.enterpriseAgentTask.groupBy as any)({
        by: ['taskType'],
        where,
        _count: { id: true },
        _sum: { tokenInput: true, tokenOutput: true, cost: true },
        orderBy: { _sum: { cost: 'desc' } },
      }) as Promise<any[]>,
      prisma.$queryRawUnsafe<Array<{ date: string; count: bigint; totalTokens: bigint; totalCost: number }>>(
        `SELECT
          DATE(started_at) AS date,
          COUNT(*)::int AS count,
          COALESCE(SUM(token_input + token_output), 0)::int AS "totalTokens",
          COALESCE(SUM(cost), 0) AS "totalCost"
        FROM enterprise_agent_task
        WHERE agent_instance_id = $1 AND started_at >= $2 AND started_at <= $3
        GROUP BY DATE(started_at)
        ORDER BY DATE(started_at) DESC
        LIMIT 30`,
        agentInstanceId,
        from,
        to,
      ),
      prisma.enterpriseAgentInstance.findUnique({
        where: { id: agentInstanceId },
        select: { organizationId: true },
      }),
    ])

    const failedCount = await prisma.enterpriseAgentTask.count({
      where: { ...where, status: 'failed' },
    })

    const totalTasks = taskStats._count.id
    const totalCost = taskStats._sum.cost || 0

    return {
      agentInstanceId,
      organizationId: instance?.organizationId || '',
      period: { from, to },
      totalTasks,
      successTasks: totalTasks - failedCount,
      failedTasks: failedCount,
      totalTokens: (taskStats._sum.tokenInput || 0) + (taskStats._sum.tokenOutput || 0),
      totalCost,
      avgDurationMs: totalTasks > 0 ? Math.round((taskStats._sum.durationMs || 0) / totalTasks) : 0,
      byTaskType: byTaskType.map((t: any) => ({
        taskType: t.taskType,
        count: t._count.id,
        totalTokens: (t._sum.tokenInput || 0) + (t._sum.tokenOutput || 0),
        totalCost: t._sum.cost || 0,
      })),
      dailyTrend: dailyTasks.map((d) => ({
        date: d.date,
        count: Number(d.count),
        totalTokens: Number(d.totalTokens),
        totalCost: d.totalCost,
      })),
    }
  }

  // ─── 成本趋势与分布 ─────────────────────────────

  async getCostSummary(
    organizationId: string,
    period?: UsagePeriod,
  ): Promise<CostSummary> {
    const { from, to } = { ...defaultPeriod(), ...period }

    const where = {
      organizationId,
      startedAt: { gte: from, lte: to },
      status: 'success',
    }

    const [taskStats, dailyCostRaw, topAgents, topCapabilities] = await Promise.all([
      prisma.enterpriseAgentTask.aggregate({
        where,
        _count: { id: true },
        _sum: { tokenInput: true, tokenOutput: true, cost: true },
      }),
      prisma.$queryRawUnsafe<Array<{ date: string; cost: number }>>(
        `SELECT DATE(started_at) AS date, COALESCE(SUM(cost), 0) AS cost
         FROM enterprise_agent_task
         WHERE organization_id = $1 AND started_at >= $2 AND started_at <= $3 AND status = 'success'
         GROUP BY DATE(started_at)
         ORDER BY DATE(started_at) ASC`,
        organizationId,
        from,
        to,
      ),
      (prisma.enterpriseAgentTask.groupBy as any)({
        by: ['agentInstanceId'],
        where,
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 5,
      }) as Promise<any[]>,
      (prisma.enterpriseAgentTask.groupBy as any)({
        by: ['taskType'],
        where,
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 5,
      }) as Promise<any[]>,
    ])

    const totalTasks = taskStats._count.id
    const totalCost = taskStats._sum.cost || 0
    const totalTokens = (taskStats._sum.tokenInput || 0) + (taskStats._sum.tokenOutput || 0)

    return {
      organizationId,
      period: { from, to },
      totalCost,
      dailyCost: dailyCostRaw,
      topAgents: topAgents.map((a: any) => ({
        agentInstanceId: a.agentInstanceId,
        cost: a._sum.cost || 0,
        taskCount: a._count.id,
      })),
      topCapabilities: topCapabilities.map((c: any) => ({
        taskType: c.taskType,
        cost: c._sum.cost || 0,
        count: c._count.id,
      })),
      costPerTask: totalTasks > 0 ? Math.round((totalCost / totalTasks) * 10000) / 10000 : 0,
      tokenCostRate: totalTokens > 0 ? Math.round((totalCost / totalTokens) * 1000000) / 1000000 : 0,
    }
  }

  // ─── 套餐额度使用状态 ──────────────────────────

  async getQuotaConsumption(
    organizationId: string,
  ): Promise<QuotaConsumption> {
    const [entitlement, activeAgents, periodUsage] = await Promise.all([
      prisma.enterpriseEntitlement.findFirst({
        where: { organizationId, status: 'active' },
        orderBy: { effectiveFrom: 'desc' },
      }),
      prisma.enterpriseAgentInstance.count({
        where: { organizationId, lifecycleState: 'ACTIVE' },
      }),
      this.getOrganizationUsage(organizationId, {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    ])

    const maxAgents = entitlement?.maxAgents ?? 0

    return {
      organizationId,
      entitlementStatus: entitlement?.status ?? 'no_entitlement',
      maxAgents,
      activeAgents,
      remainingAgentSlots: Math.max(0, maxAgents - activeAgents),
      periodTasks: periodUsage.totalTasks,
      periodCost: periodUsage.totalCost,
      periodTokens: periodUsage.totalTokens,
      quotaPercentage: maxAgents > 0
        ? Math.round((activeAgents / maxAgents) * 100)
        : 0,
    }
  }
}

export const enterpriseUsageAnalytics = new EnterpriseUsageAnalytics()
