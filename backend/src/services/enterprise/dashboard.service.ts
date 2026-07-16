/**
 * Enterprise AI Workforce — CEO Dashboard Service
 * 只回答老板三个问题：
 * 1. AI员工今天干了什么？
 * 2. 花了多少钱？
 * 3. 产生了什么价值？
 *
 * 数据来源：Database → Service → API → UI（禁止mock）
 */
import { prisma } from '../../utils/index.js'
import { DEMO_TENANT_ID } from '../../enterprise/reality/demo-boundary.js'

export interface DashboardData {
  agentStatus: AgentStatusItem[]
  todayTasks: TodayTaskItem[]
  tokenCost: TokenCostData
  agentActivity: AgentActivityItem[]
  businessMetrics: BusinessMetrics
  dailyReports: any[] // v2: AI员工日报
  goalProgress: any[] // v2.5: 每日目标完成度
}

export interface AgentStatusItem {
  agentId: string
  agentName: string
  agentType: string
  status: string
  todayTasks: number
  lastActive: string | null
}

export interface TodayTaskItem {
  agentName: string
  action: string
  resource: string
  time: string
  status: string
}

export interface TokenCostData {
  totalTokens: number
  totalCost: number
  todayTokens: number
  todayCost: number
  byProvider: { provider: string; tokens: number; cost: number }[]
  byAgent: { agentName: string; tokens: number; cost: number }[]
}

export interface AgentActivityItem {
  agentName: string
  tasksCompleted: number
  tokensUsed: number
  cost: number
  avgDurationMs: number
}

export interface BusinessMetrics {
  totalAgents: number
  activeAgents: number
  totalModels: number
  totalTasks: number
  todayTasks: number
  totalTokens: number
  totalCost: number
  contentOutput: number
  customerInteractions: number
  leadsGenerated: number
}

export class DashboardService {
  /**
   * CEO Dashboard 主入口（v2：加入日报）
   */
  async getDashboard(tenantId: string): Promise<DashboardData> {
    const [agentStatus, todayTasks, tokenCost, agentActivity, businessMetrics, dailyReports, goalProgress] = await Promise.all([
      this.getAgentStatus(tenantId),
      this.getTodayTasks(tenantId),
      this.getTokenCost(tenantId),
      this.getAgentActivity(tenantId),
      this.getBusinessMetrics(tenantId),
      this.getDailyReports(tenantId),
      this.getGoalProgress(tenantId),
    ])

    return { agentStatus, todayTasks, tokenCost, agentActivity, businessMetrics, dailyReports, goalProgress }
  }

  /**
   * v2: AI员工日报
   */
  private async getDailyReports(tenantId: string): Promise<any[]> {
    const { agentDailyReportService } = await import('./agent-daily-report.service.js')
    try {
      return await agentDailyReportService.getDailyReports({ tenantId })
    } catch {
      return []
    }
  }

  /**
   * v2.5: 每日目标完成度
   */
  private async getGoalProgress(tenantId: string): Promise<any[]> {
    const { agentScheduleService } = await import('./agent-schedule.service.js')
    try {
      const today = new Date().toISOString().slice(0, 10)
      return await agentScheduleService.getDailyGoals(tenantId, today)
    } catch {
      return []
    }
  }

  /**
   * Agent 状态（每个AI员工今天干了什么）
   */
  private async getAgentStatus(tenantId: string): Promise<AgentStatusItem[]> {
    const agents = await prisma.enterpriseAgentProfile.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, name: true, agentType: true, status: true },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result: AgentStatusItem[] = []
    for (const agent of agents) {
      const [todayTasks, lastLog] = await Promise.all([
        prisma.agentAuditTrail.count({
          where: { tenantId, agentId: agent.id, createdAt: { gte: today } },
        }),
        prisma.agentAuditTrail.findFirst({
          where: { tenantId, agentId: agent.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ])

      result.push({
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.agentType,
        status: agent.status,
        todayTasks,
        lastActive: lastLog?.createdAt?.toISOString() || null,
      })
    }
    return result
  }

  /**
   * 今日任务列表
   */
  private async getTodayTasks(tenantId: string): Promise<TodayTaskItem[]> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const logs = await prisma.agentAuditTrail.findMany({
      where: { tenantId, createdAt: { gte: today } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        action: true,
        resource: true,
        createdAt: true,
        agentId: true,
        approvalStatus: true,
      },
    })

    // 获取Agent名称
    const agentIds = [...new Set(logs.map(l => l.agentId).filter(Boolean))]
    const agents = await prisma.enterpriseAgentProfile.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    })
    const agentMap = new Map(agents.map(a => [a.id, a.name]))

    return logs.map(log => ({
      agentName: agentMap.get(log.agentId || '') || '系统',
      action: this.translateAction(log.action),
      resource: log.resource || '',
      time: log.createdAt.toISOString(),
      status: log.approvalStatus === 'auto_executed' ? '已完成' : log.approvalStatus,
    }))
  }

  /**
   * Token 成本分析
   */
  private async getTokenCost(tenantId: string): Promise<TokenCostData> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalAgg, todayAgg, byAgentAgg] = await Promise.all([
      prisma.agentAuditTrail.aggregate({
        where: { tenantId },
        _sum: { tokenUsage: true, cost: true },
      }),
      prisma.agentAuditTrail.aggregate({
        where: { tenantId, createdAt: { gte: today } },
        _sum: { tokenUsage: true, cost: true },
      }),
      prisma.agentAuditTrail.groupBy({
        by: ['agentId'],
        where: { tenantId, agentId: { not: null } },
        _sum: { tokenUsage: true, cost: true },
      }),
    ])

    // 获取Agent名称
    const agentIds = byAgentAgg.map(a => a.agentId!).filter(Boolean)
    const agents = await prisma.enterpriseAgentProfile.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    })
    const agentMap = new Map(agents.map(a => [a.id, a.name]))

    return {
      totalTokens: totalAgg._sum?.tokenUsage || 0,
      totalCost: totalAgg._sum?.cost || 0,
      todayTokens: todayAgg._sum?.tokenUsage || 0,
      todayCost: todayAgg._sum?.cost || 0,
      byProvider: [], // TODO: 需要从模型配置关联
      byAgent: byAgentAgg.map(a => ({
        agentName: agentMap.get(a.agentId || '') || '未知',
        tokens: a._sum?.tokenUsage || 0,
        cost: a._sum?.cost || 0,
      })),
    }
  }

  /**
   * Agent 活动汇总
   */
  private async getAgentActivity(tenantId: string): Promise<AgentActivityItem[]> {
    const byAgent = await prisma.agentAuditTrail.groupBy({
      by: ['agentId'],
      where: { tenantId, agentId: { not: null } },
      _count: { id: true },
      _sum: { tokenUsage: true, cost: true, durationMs: true },
    })

    const agentIds = byAgent.map(a => a.agentId!).filter(Boolean)
    const agents = await prisma.enterpriseAgentProfile.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    })
    const agentMap = new Map(agents.map(a => [a.id, a.name]))

    return byAgent.map(a => ({
      agentName: agentMap.get(a.agentId || '') || '未知',
      tasksCompleted: a._count?.id || 0,
      tokensUsed: a._sum?.tokenUsage || 0,
      cost: a._sum?.cost || 0,
      avgDurationMs: a._sum?.durationMs ? Math.round(a._sum.durationMs / (a._count?.id || 1)) : 0,
    }))
  }

  /**
   * 业务指标汇总
   */
  private async getBusinessMetrics(tenantId: string): Promise<BusinessMetrics> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [agentCount, activeCount, modelCount, totalAudit, todayAudit] = await Promise.all([
      prisma.enterpriseAgentProfile.count({ where: { tenantId } }),
      prisma.enterpriseAgentProfile.count({ where: { tenantId, status: 'active' } }),
      prisma.enterpriseLlmConfig.count({ where: { tenantId, enabled: true } }),
      prisma.agentAuditTrail.aggregate({
        where: { tenantId },
        _sum: { tokenUsage: true, cost: true, durationMs: true },
        _count: { id: true },
      }),
      prisma.agentAuditTrail.count({
        where: { tenantId, createdAt: { gte: today } },
      }),
    ])

    return {
      totalAgents: agentCount,
      activeAgents: activeCount,
      totalModels: modelCount,
      totalTasks: totalAudit._count?.id || 0,
      todayTasks: todayAudit,
      totalTokens: totalAudit._sum?.tokenUsage || 0,
      totalCost: totalAudit._sum?.cost || 0,
      contentOutput: 0, // TODO: 从实际业务产出统计
      customerInteractions: 0, // TODO
      leadsGenerated: 0, // TODO
    }
  }

  /**
   * 渠道健康度矩阵 (CTO扩展: 8渠道发布/互动/线索)
   */
  async getChannelHealthMatrix(tenantId: string) {
    const platforms = ['wechat_official', 'wechat_work', 'douyin', 'xiaohongshu', 'kuaishou', 'video_account', 'weibo', 'bilibili', 'qq']
    const platformLabels: Record<string, string> = {
      wechat_official: '微信公众号',
      wechat_work: '企业微信',
      douyin: '抖音',
      xiaohongshu: '小红书',
      kuaishou: '快手',
      video_account: '视频号',
      weibo: '微博',
      bilibili: 'B站',
      qq: 'QQ',
    }

    const matrix = await Promise.all(
      platforms.map(async (platform) => {
        const [published, interactions, leads] = await Promise.all([
          prisma.enterpriseContentPublish.count({ where: { tenantId, platform, status: 'published' } }),
          prisma.enterpriseInteraction.count({ where: { tenantId, platform } }),
          prisma.enterpriseLeadIntelligence.count({ where: { tenantId, platform } }),
        ])
        return {
          platform,
          label: platformLabels[platform] || platform,
          published,
          interactions,
          leads,
          status: 'connected',
        }
      })
    )

    return { channels: matrix }
  }

  /**
   * 行为名称中文化
   */
  private translateAction(action: string): string {
    const map: Record<string, string> = {
      'enterprise_onboarded': '企业初始化',
      'enterprise_created': '创建企业',
      'hdz_planner_executed': '小说大纲规划',
      'hdz_writer_executed': '小说章节写作',
      'hdz_reviewer_executed': '小说内容审核',
      'hdz_character_executed': '角色设定',
      'hdz_director_executed': '导演编排',
      'hdz_planner_failed': '规划任务失败',
      'hdz_writer_failed': '写作任务失败',
      'hdz_reviewer_failed': '审核任务失败',
      'hdz_character_failed': '角色任务失败',
      'hdz_director_failed': '导演任务失败',
    }
    return map[action] || action
  }
}

export const dashboardService = new DashboardService()
