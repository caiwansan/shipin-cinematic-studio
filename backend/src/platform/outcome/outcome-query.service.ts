/**
 * OutcomeQueryService — Action → Outcome Timeline Query
 * OI-02: 查询 Action 生命周期中的 Outcome 记录
 */
import { prisma } from '../../utils/index.js'
import type { OutcomeTimelineDto } from './outcome-view.types.js'

export const OutcomeQueryService = {
  /**
   * 获取组织的 Action → Outcome Timeline
   * 用于 CEO Dashboard "Outcome Timeline" 展示
   */
  async getTimeline(
    organizationId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<OutcomeTimelineDto> {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    // 1. 查询组织的所有 Action (最近完成的)
    const actions = await prisma.enterpriseAction.findMany({
      where: {
        governanceTenantId: organizationId,
        status: 'Completed',
      },
      orderBy: { completedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        status: true,
        completedAt: true,
        ownerId: true,
      },
    })

    // 2. 查询这些 Action 对应的 OutcomeRecords
    const actionIds = actions.map((a) => a.id)
    const outcomes = actionIds.length > 0
      ? await prisma.outcomeRecord.findMany({
          where: { actionId: { in: actionIds } },
          select: {
            id: true,
            actionId: true,
            type: true,
            description: true,
          },
        })
      : []

    // 3. 查询 Impacts
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

    // 4. 获取 Agent 信息
    const agentIds = [...new Set(actions.map((a) => a.ownerId).filter(Boolean))] as string[]
    const agents = agentIds.length > 0
      ? await prisma.enterpriseAgentProfile.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : []
    const agentMap = new Map(agents.map((a) => [a.id, a.name]))

    // 5. 构建 Timeline Items
    const outcomeByAction = new Map(outcomes.map((o) => [o.actionId, o]))
    const impactsByOutcome = new Map<string, typeof impacts>()
    for (const impact of impacts) {
      const existing = impactsByOutcome.get(impact.outcomeId) || []
      existing.push(impact)
      impactsByOutcome.set(impact.outcomeId, existing)
    }

    const items = actions.map((action) => {
      const outcome = outcomeByAction.get(action.id) || null
      const outcomeImpacts = outcome ? (impactsByOutcome.get(outcome.id) || []) : []
      const topImpact = outcomeImpacts.length > 0 ? outcomeImpacts[0] : null

      return {
        actionId: action.id,
        agentName: agentMap.get(action.ownerId) || '系统',
        actionName: action.title,
        status: action.status,
        outcomeType: outcome?.type || null,
        outcomeDescription: outcome?.description || null,
        impactMetricType: topImpact?.metricType || null,
        impactValue: topImpact?.metricValue || null,
        impactUnit: topImpact?.unit || null,
        completedAt: action.completedAt?.toISOString() || null,
      }
    })

    return { organizationId, items }
  },

  /**
   * 获取 AI Employee Impact (用于 Impact Card)
   */
  async getAgentImpact(
    organizationId: string,
    agentId: string,
  ): Promise<{
    agentId: string
    agentName: string
    todayActions: number
    todayOutcomes: number
    totalImpact: { metricType: string; value: string; unit: string } | null
    verifiedOutcomes: number
  } | null> {
    // 获取 agent 信息
    const agent = await prisma.enterpriseAgentProfile.findFirst({
      where: { id: agentId },
      select: { id: true, name: true },
    })
    if (!agent) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 今日 actions
    const todayActions = await prisma.enterpriseAction.count({
      where: {
        governanceTenantId: organizationId,
        ownerId: agentId,
        status: 'Completed',
        completedAt: { gte: today },
      },
    })

    // 今日 outcomes
    const todayOutcomes = await prisma.outcomeRecord.count({
      where: {
        organizationId,
        agentId,
        createdAt: { gte: today },
      },
    })

    // verified outcomes
    const verifiedOutcomes = await prisma.outcomeRecord.count({
      where: {
        organizationId,
        agentId,
        status: 'VERIFIED',
      },
    })

    // 总 impact (取最新一个)
    const latestOutcome = await prisma.outcomeRecord.findFirst({
      where: { organizationId, agentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    let totalImpact: { metricType: string; value: string; unit: string } | null = null
    if (latestOutcome) {
      const impact = await prisma.impactMeasurement.findFirst({
        where: { outcomeId: latestOutcome.id },
        select: { metricType: true, metricValue: true, unit: true },
      })
      if (impact) {
        totalImpact = {
          metricType: impact.metricType,
          value: impact.metricValue,
          unit: impact.unit,
        }
      }
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      todayActions,
      todayOutcomes,
      totalImpact,
      verifiedOutcomes,
    }
  },
}
