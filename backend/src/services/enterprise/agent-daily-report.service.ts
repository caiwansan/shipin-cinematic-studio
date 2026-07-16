/**
 * Enterprise AI Workforce — Agent Daily Report Service
 * 把 agent_audit_trail 变成 AI员工日报
 *
 * 核心转换：
 * 10:23 llm_call token 2381 → "10:10 市场趋势分析，发现：新能源汽车物流市场增长机会"
 */
import { prisma } from '../../utils/index.js'

export interface DailyReport {
  agentId: string
  agentName: string
  role: string
  date: string
  status: 'active' | 'idle'
  completedTasks: number
  achievements: string[]
  tokenUsage: number
  cost: number
  timeline: TimelineItem[]
}

export interface TimelineItem {
  time: string
  action: string
  detail: string
}

export interface DailyReportInput {
  tenantId: string
  date?: string // YYYY-MM-DD
}

export class AgentDailyReportService {
  /**
   * 获取某企业某天的全部AI员工日报
   */
  async getDailyReports(input: DailyReportInput): Promise<DailyReport[]> {
    const { tenantId, date } = input
    const targetDate = date ? new Date(date) : new Date()
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // 获取企业所有活跃Agent
    const agents = await prisma.enterpriseAgentProfile.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, name: true, role: true, agentType: true },
    })

    const reports: DailyReport[] = []
    for (const agent of agents) {
      const report = await this.generateAgentDailyReport(
        tenantId, agent, targetDate, nextDay
      )
      reports.push(report)
    }
    return reports
  }

  /**
   * 生成单个AI员工的日报
   */
  private async generateAgentDailyReport(
    tenantId: string,
    agent: { id: string; name: string; role: string; agentType: string },
    startOfDay: Date,
    endOfDay: Date
  ): Promise<DailyReport> {
    // 查询该Agent在当天的所有审计日志
    const logs = await prisma.agentAuditTrail.findMany({
      where: {
        tenantId,
        agentId: agent.id,
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { createdAt: 'asc' },
    })

    // 时间线转换
    const timeline: TimelineItem[] = []
    const achievements: string[] = []
    let totalTokens = 0
    let totalCost = 0

    for (const log of logs) {
      totalTokens += log.tokenUsage || 0
      totalCost += log.cost || 0

      const timeStr = log.createdAt.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })

      // 将技术日志转换为人类可读的成就
      const { action, detail } = this.translateLogToReport(log)
      timeline.push({ time: timeStr, action, detail })

      if (log.action?.includes('executed') && !log.action?.includes('failed')) {
        achievements.push(detail)
      }
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      date: startOfDay.toISOString().slice(0, 10),
      status: logs.length > 0 ? 'active' : 'idle',
      completedTasks: logs.filter(l => l.action?.includes('executed')).length,
      achievements: achievements.slice(0, 5),
      tokenUsage: totalTokens,
      cost: totalCost,
      timeline,
    }
  }

  /**
   * 技术日志 → 人类可读的成就描述
   */
  private translateLogToReport(log: any): { action: string; detail: string } {
    const actionMap: Record<string, { action: string; extract: (log: any) => string }> = {
      'enterprise_onboarded': {
        action: '企业初始化',
        extract: () => '企业AI部门初始化完成，5个AI员工已就位',
      },
      'enterprise_created': {
        action: '创建企业',
        extract: () => '创建企业数字部门',
      },
      'hdz_planner_executed': {
        action: '小说大纲规划',
        extract: (l) => {
          const summary = l.outputSummary || ''
          return `完成小说大纲规划${summary ? '：' + summary.slice(0, 50) : ''}`
        },
      },
      'hdz_writer_executed': {
        action: '章节写作',
        extract: (l) => `完成章节创作${l.outputSummary ? '：' + l.outputSummary.slice(0, 50) : ''}`,
      },
      'hdz_reviewer_executed': {
        action: '内容审核',
        extract: (l) => {
          const summary = l.outputSummary || ''
          return `完成内容审核${summary ? '：' + summary.slice(0, 50) : ''}`
        },
      },
      'hdz_character_executed': {
        action: '角色设定',
        extract: (l) => `完成角色设定${l.outputSummary ? '：' + l.outputSummary.slice(0, 50) : ''}`,
      },
      'hdz_director_executed': {
        action: '导演编排',
        extract: (l) => `完成导演编排${l.outputSummary ? '：' + l.outputSummary.slice(0, 50) : ''}`,
      },
    }

    // 失败处理
    if (log.action?.includes('failed')) {
      return {
        action: '任务执行异常',
        detail: this.translateAction(log.action),
      }
    }

    const handler = actionMap[log.action]
    if (handler) {
      return { action: handler.action, detail: handler.extract(log) }
    }

    // 默认：尝试从outputSummary提取
    if (log.outputSummary) {
      return { action: this.translateAction(log.action), detail: log.outputSummary.slice(0, 80) }
    }

    return { action: this.translateAction(log.action), detail: '执行任务' }
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

export const agentDailyReportService = new AgentDailyReportService()
