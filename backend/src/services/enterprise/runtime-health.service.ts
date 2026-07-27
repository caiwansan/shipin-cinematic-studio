/**
 * Runtime Health Monitor Service — ER-04-TASK-05
 * AI Employee Runtime Health & Metrics
 *
 * 职责: 监控 Hermes Sub-Agent 执行状态
 * 架构: 只读监控 (不干预 Runtime 执行)
 *
 * 监控维度:
 *   Runtime: Gateway 状态 / 心跳 / 延迟 / 崩溃
 *   Agent: 活跃数 / 会话数 / 执行数 / 失败率
 *   Business: 任务完成 / 成果生成 / ROI 信号
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface RuntimeHealth {
  organizationId: string
  hermesProfileId: string
  status: string  // healthy | degraded | down
  runtime: {
    gatewayStatus: string
    activeAgents: number
    lastHeartbeat: string | null
  }
  agent: {
    totalSessions: number
    activeSessions: number
    totalExecutions: number
    failureRate: number  // 0-100
  }
  business: {
    tasksCompleted: number
    outcomesGenerated: number
    lastOutcomeAt: string | null
  }
  checkedAt: string
}

// ─── Service ─────────────────────────────────────────────

export class RuntimeHealthService {

  /**
   * 获取 Runtime 健康状态
   */
  async getHealth(organizationId: string): Promise<RuntimeHealth | null> {
    // 1. 获取 Tenant 级别的 Agent Instance
    const instances = await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId: organizationId },
      select: { id: true, employeeId: true },
    })
    if (instances.length === 0) return null

    // 2. 获取 Bindings
    const bindings = await prisma.hermesProfileBinding.findMany({
      where: { tenantId: organizationId },
    })
    const primaryBinding = bindings[0] || null

    // 3. 获取 Agent Profile 统计
    const agentIds = instances.map(i => i.employeeId)
    const agents = await prisma.enterpriseAgentProfile.findMany({
      where: { id: { in: agentIds } },
      select: { id: true },
    })

    // 3. 获取执行统计 (近 24h)
    const now = new Date()
    const start24h = new Date(now)
    start24h.setHours(start24h.getHours() - 24)

    let totalExecutions = 0
    let totalErrors = 0
    let totalSessions = 0
    let tasksCompleted = 0
    let outcomesGenerated = 0
    let lastOutcomeAt: string | null = null

    for (const agent of agents) {
      // 执行统计
      const execCount = await prisma.agentAuditTrail.count({
        where: {
          agentId: agent.id,
          createdAt: { gte: start24h },
        },
      })
      totalExecutions += execCount

      const errorCount = await prisma.agentAuditTrail.count({
        where: {
          agentId: agent.id,
          createdAt: { gte: start24h },
          approvalStatus: 'rejected',
        },
      })
      totalErrors += errorCount

      // 成果统计
      const outcomeCount = await prisma.outcomeRecord.count({
        where: {
          agentId: agent.id,
          createdAt: { gte: start24h },
        },
      })
      outcomesGenerated += outcomeCount

      // 最近成果时间
      const latestOutcome = await prisma.outcomeRecord.findFirst({
        where: { agentId: agent.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (latestOutcome && (!lastOutcomeAt || latestOutcome.createdAt.toISOString() > lastOutcomeAt)) {
        lastOutcomeAt = latestOutcome.createdAt.toISOString()
      }

      // 任务完成 (Goal)
      const completedGoals = await prisma.agentGoal.count({
        where: {
          agentId: agent.id,
          status: 'completed',
          goalDate: { gte: start24h.toISOString().slice(0, 10) },
        },
      })
      tasksCompleted += completedGoals
    }

    // 4. 计算失败率
    const failureRate = totalExecutions > 0
      ? Math.round((totalErrors / totalExecutions) * 100)
      : 0

    // 5. 判断整体状态
    let status = 'healthy'
    if (failureRate > 20 || primaryBinding?.status === 'failed') {
      status = 'down'
    } else if (failureRate > 5 || primaryBinding?.status === 'paused') {
      status = 'degraded'
    }

    return {
      organizationId,
      hermesProfileId: primaryBinding?.hermesAgentId || '',
      status,
      runtime: {
        gatewayStatus: primaryBinding?.status || 'unknown',
        activeAgents: agents.length,
        lastHeartbeat: primaryBinding?.updatedAt?.toISOString() || null,
      },
      agent: {
        totalSessions: totalSessions,
        activeSessions: 0, // TODO: 从 Hermes API 获取
        totalExecutions,
        failureRate,
      },
      business: {
        tasksCompleted,
        outcomesGenerated,
        lastOutcomeAt,
      },
      checkedAt: now.toISOString(),
    }
  }

  /**
   * 获取 Runtime 指标 (轻量版，用于 Dashboard)
   */
  async getMetrics(organizationId: string): Promise<{
    status: string
    activeAgents: number
    executions24h: number
    failureRate: number
    outcomes24h: number
  } | null> {
    const instances = await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId: organizationId },
      select: { id: true, employeeId: true },
    })
    if (instances.length === 0) return null

    const agentIds = instances.map(i => i.employeeId)
    const agents = await prisma.enterpriseAgentProfile.findMany({
      where: { id: { in: agentIds } },
      select: { id: true },
    })

    const start24h = new Date()
    start24h.setHours(start24h.getHours() - 24)

    let totalExecutions = 0
    let totalErrors = 0
    let outcomes24h = 0

    for (const agent of agents) {
      totalExecutions += await prisma.agentAuditTrail.count({
        where: { agentId: agent.id, createdAt: { gte: start24h } },
      })
      totalErrors += await prisma.agentAuditTrail.count({
        where: { agentId: agent.id, createdAt: { gte: start24h }, approvalStatus: 'rejected' },
      })
      outcomes24h += await prisma.outcomeRecord.count({
        where: { agentId: agent.id, createdAt: { gte: start24h } },
      })
    }

    const failureRate = totalExecutions > 0
      ? Math.round((totalErrors / totalExecutions) * 100)
      : 0

    let status = 'healthy'
    if (failureRate > 20) status = 'down'
    else if (failureRate > 5) status = 'degraded'

    return {
      status,
      activeAgents: agents.length,
      executions24h: totalExecutions,
      failureRate,
      outcomes24h,
    }
  }
}

export const runtimeHealthService = new RuntimeHealthService()
