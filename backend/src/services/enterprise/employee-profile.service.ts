/**
 * Employee Profile Service — ER-02-TASK-01 + TASK-02
 * AI Employee Profile View Layer
 *
 * 产品目标: 把 AI 员工 Runtime 转化为 CEO 能理解的数字员工档案
 * 架构原则: View Layer — 不新增 Schema，只聚合已有数据
 *
 * 数据来源:
 *   EnterpriseAgentProfile → 身份/技能/知识/工具
 *   AgentAuditTrail        → Trust Score/执行统计/Contribution Timeline/Growth Record
 *   AgentGoal              → 目标完成率
 *   OutcomeRecord          → 历史成果
 *   ImpactMeasurement      → 业务价值
 */
import { prisma } from '../../utils/index.js'

// ─── Types ───────────────────────────────────────────────

export interface TodayTaskItem {
  action: string
  resource: string
  time: string
  status: string
}

export interface EmployeeProfileDTO {
  // Identity
  id: string
  name: string
  avatarUrl: string | null
  bio: string | null
  role: string
  agentType: string
  goal: string | null
  personality: string | null

  // Status
  status: string
  runtimeStatus: string
  lastActiveAt: string | null
  workingHours: string | null

  // Capabilities
  capabilities: string[]
  knowledgeScope: string[]
  tools: string[]
  permissions: string[]

  // Trust Score
  trustScore: number
  consecutiveWorkDays: number
  totalExecutions: number
  humanCorrections: number

  // Today
  todayTarget: number
  todayCompleted: number
  todayTasks: TodayTaskItem[]

  // Contribution (30d)
  contributionSummary: {
    totalOutcomes: number
    totalRevenue: string | null
    topOutcome: string | null
  }

  // CEO Instruction
  managerNote: string | null

  // ─── ER-02-TASK-02: Profile Depth ───

  // Contribution Timeline (30d)
  contributionTimeline: {
    period: string
    data: { date: string; count: number }[]
    total: number
    peak: { date: string; count: number }
  }

  // Historical Outcomes (with evidence)
  historicalOutcomes: {
    total: number
    items: {
      id: string
      type: string
      description: string
      createdAt: string
      impactValue: string | null
      impactType: string | null
    }[]
  }

  // Growth Record
  growthRecord: {
    items: {
      date: string
      event: string
      detail: string
    }[]
  }

  // CEO Command Context
  ceoCommandContext: {
    managerNote: string | null
    lastUpdated: string | null
  }
}

// ─── Service ─────────────────────────────────────────────

export class EmployeeProfileService {

  /**
   * 获取 AI 员工完整 Profile
   * @param organizationId 组织 ID (来自 JWT Identity Resolution)
   * @param agentId AI 员工 ID
   */
  async getProfile(organizationId: string, agentId: string): Promise<EmployeeProfileDTO | null> {
    // 1. 获取 Agent 基本信息 (带组织隔离)
    const agent = await prisma.enterpriseAgentProfile.findFirst({
      where: { id: agentId, organizationId },
    })
    if (!agent) return null

    // 2. 并行查询所有关联数据
    const [auditStats, goals, outcomes, todayTasks, consecutiveDays, timeline, histOutcomes, growth] = await Promise.all([
      this.getAuditStats(agentId),
      this.getGoals(agentId),
      this.getOutcomes(agentId),
      this.getTodayTasks(agentId),
      this.getConsecutiveDays(agentId),
      this.getContributionTimeline(agentId),
      this.getHistoricalOutcomes(agentId),
      this.getGrowthRecord(agentId),
    ])

    // 3. 解析 JSON 字段
    const capabilities = this.parseJSON<string[]>(agent.capabilities, [])
    const knowledgeScope = this.parseJSON<string[]>(agent.knowledgeScope, [])
    const tools = this.parseJSON<string[]>(agent.tools, [])
    const permissions = this.parseJSON<string[]>(agent.permissions, [])

    // 4. 计算 Trust Score
    const trustScore = this.calculateTrustScore(auditStats, goals)

    // 5. 计算 30d 收入
    const outcomeIds = outcomes.map((o) => o.id)
    const totalRevenue = await this.getTotalRevenue(outcomeIds)

    // 6. 组装 DTO
    return {
      id: agent.id,
      name: agent.name,
      avatarUrl: agent.avatarUrl,
      bio: agent.description,
      role: agent.role,
      agentType: agent.agentType,
      goal: agent.goal,
      personality: null, // 未来扩展

      status: agent.status,
      runtimeStatus: agent.runtimeStatus,
      lastActiveAt: agent.lastExecutionAt?.toISOString() || null,
      workingHours: agent.workingHours,

      capabilities,
      knowledgeScope,
      tools,
      permissions,

      trustScore: trustScore.score,
      consecutiveWorkDays: consecutiveDays,
      totalExecutions: auditStats.totalCount,
      humanCorrections: auditStats.rejectedCount,

      todayTarget: agent.dailyTarget || 0,
      todayCompleted: auditStats.todayCompleted,
      todayTasks,

      contributionSummary: {
        totalOutcomes: outcomes.length,
        totalRevenue: totalRevenue > 0 ? `¥${totalRevenue.toLocaleString()}` : null,
        topOutcome: outcomes.length > 0 ? outcomes[0].type : null,
      },

      managerNote: agent.managerNote,

      // ER-02-TASK-02: Profile Depth
      contributionTimeline: timeline,
      historicalOutcomes: histOutcomes,
      growthRecord: growth,
      ceoCommandContext: {
        managerNote: agent.managerNote,
        lastUpdated: agent.updatedAt?.toISOString() || null,
      },
    }
  }

  // ─── Private Helpers (ER-02-TASK-0) ──────────────────

  /**
   * AgentAuditTrail 30d 统计
   */
  private async getAuditStats(agentId: string) {
    const now = new Date()
    const start30d = new Date(now)
    start30d.setDate(start30d.getDate() - 30)

    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const [total30d, rejected30d, todayCompleted] = await Promise.all([
      prisma.agentAuditTrail.count({
        where: { agentId, createdAt: { gte: start30d } },
      }),
      prisma.agentAuditTrail.count({
        where: { agentId, createdAt: { gte: start30d }, approvalStatus: 'rejected' },
      }),
      prisma.agentAuditTrail.count({
        where: { agentId, createdAt: { gte: startOfDay } },
      }),
    ])

    return { totalCount: total30d, rejectedCount: rejected30d, todayCompleted }
  }

  /**
   * AgentGoal 30d 完成率
   */
  private async getGoals(agentId: string) {
    const now = new Date()
    const start30d = new Date(now)
    start30d.setDate(start30d.getDate() - 30)
    const startDateStr = start30d.toISOString().slice(0, 10)
    const todayStr = now.toISOString().slice(0, 10)

    const goals = await prisma.agentGoal.findMany({
      where: {
        agentId,
        goalDate: { gte: startDateStr, lte: todayStr },
      },
    })

    const total = goals.length
    const completed = goals.filter((g) => g.status === 'completed').length

    return { total, completed }
  }

  /**
   * OutcomeRecord 30d
   */
  private async getOutcomes(agentId: string) {
    const now = new Date()
    const start30d = new Date(now)
    start30d.setDate(start30d.getDate() - 30)

    return prisma.outcomeRecord.findMany({
      where: { agentId, createdAt: { gte: start30d } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, type: true, description: true },
    })
  }

  /**
   * 今日任务列表
   */
  private async getTodayTasks(agentId: string): Promise<TodayTaskItem[]> {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const logs = await prisma.agentAuditTrail.findMany({
      where: { agentId, createdAt: { gte: startOfDay } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        action: true,
        resource: true,
        createdAt: true,
        approvalStatus: true,
      },
    })

    return logs.map((log) => ({
      action: this.translateAction(log.action),
      resource: log.resource || '',
      time: log.createdAt.toISOString(),
      status: log.approvalStatus === 'auto_executed' ? '已完成' : log.approvalStatus,
    }))
  }

  /**
   * 连续工作天数
   */
  private async getConsecutiveDays(agentId: string): Promise<number> {
    const logs = await prisma.agentAuditTrail.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
      take: 365,
    })

    if (logs.length === 0) return 0

    const days = new Set<string>()
    for (const log of logs) {
      days.add(log.createdAt.toISOString().slice(0, 10))
    }

    let consecutive = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      if (days.has(dateStr)) {
        consecutive++
      } else {
        break
      }
    }
    return consecutive
  }

  /**
   * 30d 总收入
   */
  private async getTotalRevenue(outcomeIds: string[]): Promise<number> {
    if (outcomeIds.length === 0) return 0

    const impacts = await prisma.impactMeasurement.findMany({
      where: {
        outcomeId: { in: outcomeIds },
        metricType: { in: ['REVENUE', 'COST_SAVED'] },
      },
      select: { metricValue: true },
    })

    return impacts.reduce((sum, i) => sum + (Number(i.metricValue) || 0), 0)
  }

  /**
   * Trust Score 计算
   */
  private calculateTrustScore(
    auditStats: { totalCount: number; rejectedCount: number },
    goals: { total: number; completed: number },
  ): { score: number } {
    if (auditStats.totalCount === 0) return { score: 100 }

    const executionSuccessRate = 1 - (auditStats.rejectedCount / auditStats.totalCount)
    const outcomeCompletionRate = goals.total > 0 ? goals.completed / goals.total : 0.5
    const humanApprovalRate = 1 - (auditStats.rejectedCount / auditStats.totalCount)
    const errorRate = auditStats.rejectedCount / auditStats.totalCount

    const raw =
      executionSuccessRate * 0.4 +
      outcomeCompletionRate * 0.3 +
      humanApprovalRate * 0.2 -
      errorRate * 0.1

    return { score: Math.round(Math.max(0, Math.min(100, raw * 100))) }
  }

  /**
   * JSON 解析
   */
  private parseJSON<T>(val: string | null | undefined, fallback: T): T {
    if (!val) return fallback
    if (typeof val === 'object') return val as T
    try { return JSON.parse(val) } catch { return fallback }
  }

  /**
   * 行为名称中文化
   */
  private translateAction(action: string): string {
    const map: Record<string, string> = {
      'enterprise_onboarded': '企业初始化',
      'enterprise_created': '创建企业',
      'action.completed': '完成任务',
      'action.approved': '审批通过',
      'action.rejected': '审批驳回',
      'action.verified': '验收完成',
      'action.executed': '开始执行',
    }
    return map[action] || action
  }

  // ─── ER-02-TASK-02: Profile Depth Methods ────────────

  /**
   * Contribution Timeline — 30d 执行趋势
   */
  private async getContributionTimeline(agentId: string) {
    const now = new Date()
    const start30d = new Date(now)
    start30d.setDate(start30d.getDate() - 30)
    start30d.setHours(0, 0, 0, 0)

    const logs = await prisma.agentAuditTrail.findMany({
      where: { agentId, createdAt: { gte: start30d } },
      select: { createdAt: true },
    })

    // Group by date
    const dateMap = new Map<string, number>()
    for (const log of logs) {
      const d = log.createdAt.toISOString().slice(0, 10)
      dateMap.set(d, (dateMap.get(d) || 0) + 1)
    }

    // Fill missing dates with 0
    const data: { date: string; count: number }[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(start30d)
      d.setDate(d.getDate() + i)
      const ds = d.toISOString().slice(0, 10)
      data.push({ date: ds, count: dateMap.get(ds) || 0 })
    }

    const total = data.reduce((s, d) => s + d.count, 0)
    const peak = data.reduce((max, d) => d.count > max.count ? d : max, data[0])

    return { period: '30d', data, total, peak: peak || { date: '', count: 0 } }
  }

  /**
   * Historical Outcomes — 历史成果 (with Impact)
   */
  private async getHistoricalOutcomes(agentId: string) {
    const now = new Date()
    const start90d = new Date(now)
    start90d.setDate(start90d.getDate() - 90)

    const outcomes = await prisma.outcomeRecord.findMany({
      where: { agentId, createdAt: { gte: start90d } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, description: true, createdAt: true },
    })

    // Fetch impacts for these outcomes
    const outcomeIds = outcomes.map((o) => o.id)
    const impacts = outcomeIds.length > 0
      ? await prisma.impactMeasurement.findMany({
          where: { outcomeId: { in: outcomeIds } },
          select: { outcomeId: true, metricValue: true, metricType: true },
        })
      : []

    const impactMap = new Map(impacts.map((i) => [i.outcomeId, i]))

    return {
      total: outcomes.length,
      items: outcomes.map((o) => {
        const imp = impactMap.get(o.id)
        return {
          id: o.id,
          type: o.type,
          description: o.description,
          createdAt: o.createdAt.toISOString(),
          impactValue: imp ? `¥${Number(imp.metricValue).toLocaleString()}` : null,
          impactType: imp?.metricType || null,
        }
      }),
    }
  }

  /**
   * Growth Record — Agent 成长时间线
   */
  private async getGrowthRecord(agentId: string) {
    const now = new Date()
    const start90d = new Date(now)
    start90d.setDate(start90d.getDate() - 90)

    const logs = await prisma.agentAuditTrail.findMany({
      where: {
        agentId,
        createdAt: { gte: start90d },
        action: { in: ['agent.updated', 'capability.added', 'agent.deployed', 'agent.created'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { action: true, resource: true, createdAt: true },
    })

    return {
      items: logs.map((log) => ({
        date: log.createdAt.toISOString(),
        event: this.translateGrowthEvent(log.action),
        detail: log.resource || '',
      })),
    }
  }

  /**
   * Growth 事件名称中文化
   */
  private translateGrowthEvent(action: string): string {
    const map: Record<string, string> = {
      'agent.created': 'AI 员工入职',
      'agent.deployed': 'Agent 部署上线',
      'agent.updated': 'Agent 配置更新',
      'capability.added': '新增技能',
    }
    return map[action] || action
  }
}

export const employeeProfileService = new EmployeeProfileService()
