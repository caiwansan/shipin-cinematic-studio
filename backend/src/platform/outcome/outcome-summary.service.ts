/**
 * OutcomeSummaryService — 为 CEO 首页提供 Outcome 聚合
 * OI-02: 将 OutcomeRecord + ImpactMeasurement 聚合为 CEO Daily Brief
 *
 * 简化版: 聚焦 Outcome + Impact (Action计数待 OI-02 后续完善)
 */
import { prisma } from '../../utils/index.js'
import type { OutcomeSummaryDto } from './outcome-view.types.js'

export const OutcomeSummaryService = {
  /**
   * 获取组织的 Outcome Summary
   * 用于 CEO 首页 "AI Workforce Today"
   */
  async getSummary(
    organizationId: string,
    options?: { period?: 'TODAY' | 'WEEK' | 'MONTH' },
  ): Promise<OutcomeSummaryDto> {
    const period = options?.period ?? 'TODAY'
    const startDate = getPeriodStart(period)

    // 1. 查询组织的所有 OutcomeRecord
    const outcomes = await prisma.outcomeRecord.findMany({
      where: {
        organizationId,
        ...(startDate ? { createdAt: { gte: startDate } } : {}),
      },
      select: {
        id: true,
        actionId: true,
        agentId: true,
        type: true,
        status: true,
        createdAt: true,
      },
    })

    // 2. 查询所有 ImpactMeasurement
    const outcomeIds = outcomes.map((o) => o.id)
    const impacts = outcomeIds.length > 0
      ? await prisma.impactMeasurement.findMany({
          where: { outcomeId: { in: outcomeIds } },
          select: {
            outcomeId: true,
            metricType: true,
            metricValue: true,
            unit: true,
          },
        })
      : []

    // 3. 获取 Agent 信息
    const agentIds = [...new Set(outcomes.map((o) => o.agentId).filter(Boolean))] as string[]
    const agents = agentIds.length > 0
      ? await prisma.enterpriseAgentProfile.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : []
    const agentMap = new Map(agents.map((a) => [a.id, a.name]))

    // 4. 按 Agent 聚合
    const agentBreakdownMap = new Map<string, {
      agentId: string
      agentName: string
      actions: number
      outcomes: number
      topImpact: { metricType: string; value: string; unit: string } | null
      topOutcome: string | null
    }>()

    for (const outcome of outcomes) {
      const agentId = outcome.agentId || 'system'
      const agentName = agentMap.get(agentId) || '系统'

      if (!agentBreakdownMap.has(agentId)) {
        agentBreakdownMap.set(agentId, {
          agentId,
          agentName,
          actions: 0,
          outcomes: 0,
          topImpact: null,
          topOutcome: null,
        })
      }

      const entry = agentBreakdownMap.get(agentId)!
      entry.outcomes += 1

      // 查找该 outcome 的最大 impact
      const outcomeImpacts = impacts.filter((i) => i.outcomeId === outcome.id)
      for (const impact of outcomeImpacts) {
        if (!entry.topImpact || Number(impact.metricValue) > Number(entry.topImpact.value)) {
          entry.topImpact = {
            metricType: impact.metricType,
            value: impact.metricValue,
            unit: impact.unit,
          }
        }
      }

      if (!entry.topOutcome) {
        entry.topOutcome = outcome.type
      }
    }

    // 5. 聚合总 Impact
    const totalImpactMap = new Map<string, { metricType: string; value: number; unit: string }>()
    for (const impact of impacts) {
      const existing = totalImpactMap.get(impact.metricType)
      if (existing) {
        existing.value += Number(impact.metricValue) || 0
      } else {
        totalImpactMap.set(impact.metricType, {
          metricType: impact.metricType,
          value: Number(impact.metricValue) || 0,
          unit: impact.unit,
        })
      }
    }

    const totalImpact = Array.from(totalImpactMap.values()).map((t) => ({
      metricType: t.metricType,
      value: String(t.value),
      unit: t.unit,
    }))

    // Action count = audit logs today (same as agent breakdown)
    const actionCount = startDate
      ? await prisma.agentAuditTrail.count({
          where: { createdAt: { gte: startDate } },
        })
      : await prisma.agentAuditTrail.count()

    return {
      organizationId,
      period,
      totalActions: actionCount,
      totalOutcomes: outcomes.length,
      totalImpact,
      agentBreakdown: Array.from(agentBreakdownMap.values()),
    }
  },
}

function getPeriodStart(period: 'TODAY' | 'WEEK' | 'MONTH'): Date | null {
  const now = new Date()
  switch (period) {
    case 'TODAY':
      now.setHours(0, 0, 0, 0)
      return now
    case 'WEEK':
      now.setDate(now.getDate() - 7)
      return now
    case 'MONTH':
      now.setMonth(now.getMonth() - 1)
      return now
    default:
      return null
  }
}
