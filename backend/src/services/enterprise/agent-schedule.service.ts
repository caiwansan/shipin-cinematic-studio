/**
 * Enterprise AI Workforce — Agent Schedule Service
 * Agent 定时任务管理 + 每日目标追踪
 *
 * Phase 2.5: Autonomous Operation
 */
import { prisma } from '../../utils/index.js'
import { randomUUID } from 'crypto'

export interface ScheduleConfig {
  tenantId: string
  agentId: string
  scheduleType?: string
  cronExpression: string
  taskTemplate: string
  taskType?: string
  enabled?: boolean
}

export interface GoalConfig {
  tenantId: string
  agentId: string
  goalDate: string
  goalType: string
  description: string
  targetCount: number
}

export class AgentScheduleService {
  /**
   * 创建定时任务
   */
  async createSchedule(config: ScheduleConfig): Promise<any> {
    const schedule = await prisma.agentSchedule.create({
      data: {
        id: randomUUID(),
        tenantId: config.tenantId,
        agentId: config.agentId,
        scheduleType: config.scheduleType || 'daily',
        cronExpression: config.cronExpression,
        taskTemplate: config.taskTemplate,
        taskType: config.taskType || 'auto',
        enabled: config.enabled !== undefined ? config.enabled : true,
        nextRunAt: this.calculateNextRun(config.cronExpression),
      },
    })
    return schedule
  }

  /**
   * 获取企业所有生效的定时任务
   */
  async getActiveSchedules(tenantId: string): Promise<any[]> {
    return prisma.agentSchedule.findMany({
      where: { tenantId, enabled: true },
      include: { agent: { select: { id: true, name: true, role: true, agentType: true } } },
      orderBy: { cronExpression: 'asc' },
    })
  }

  /**
   * 获取Agent的所有定时任务
   */
  async getAgentSchedules(agentId: string): Promise<any[]> {
    return prisma.agentSchedule.findMany({
      where: { agentId, enabled: true },
      orderBy: { cronExpression: 'asc' },
    })
  }

  /**
   * 更新任务执行状态
   */
  async markRun(scheduleId: string): Promise<void> {
    const schedule = await prisma.agentSchedule.findUnique({ where: { id: scheduleId } })
    if (!schedule) return
    await prisma.agentSchedule.update({
      where: { id: scheduleId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: this.calculateNextRun(schedule.cronExpression),
      },
    })
  }

  /**
   * 禁用/启用任务
   */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<void> {
    await prisma.agentSchedule.update({
      where: { id: scheduleId },
      data: { enabled },
    })
  }

  /**
   * 删除任务
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await prisma.agentSchedule.delete({ where: { id: scheduleId } })
  }

  /**
   * 创建每日目标
   */
  async createGoal(config: GoalConfig): Promise<any> {
    return prisma.agentGoal.upsert({
      where: {
        agentId_goalDate_goalType: {
          agentId: config.agentId,
          goalDate: config.goalDate,
          goalType: config.goalType,
        },
      },
      create: {
        id: randomUUID(),
        tenantId: config.tenantId,
        agentId: config.agentId,
        goalDate: config.goalDate,
        goalType: config.goalType,
        description: config.description,
        targetCount: config.targetCount,
        actualCount: 0,
        status: 'pending',
      },
      update: {
        description: config.description,
        targetCount: config.targetCount,
      },
    })
  }

  /**
   * 追踪目标进度
   */
  async trackGoal(agentId: string, goalDate: string, goalType: string, increment: number = 1): Promise<void> {
    const goal = await prisma.agentGoal.findUnique({
      where: { agentId_goalDate_goalType: { agentId, goalDate, goalType } },
    })
    if (!goal) return
    const newActual = goal.actualCount + increment
    const newStatus = newActual >= goal.targetCount ? 'completed' : 'in_progress'
    await prisma.agentGoal.update({
      where: { id: goal.id },
      data: { actualCount: newActual, status: newStatus },
    })
  }

  /**
   * 获取Agent某日目标进度
   */
  async getAgentGoals(agentId: string, goalDate: string): Promise<any[]> {
    return prisma.agentGoal.findMany({
      where: { agentId, goalDate },
      orderBy: { goalType: 'asc' },
    })
  }

  /**
   * 获取企业某天所有Agent目标
   */
  async getDailyGoals(tenantId: string, goalDate: string): Promise<any[]> {
    return prisma.agentGoal.findMany({
      where: { tenantId, goalDate },
      include: { agent: { select: { id: true, name: true, role: true } } },
      orderBy: { goalType: 'asc' },
    })
  }

  /**
   * 为Onboarding企业创建5个核心AI员工的默认日程
   */
  async createDefaultSchedules(tenantId: string, agents: any[]): Promise<void> {
    const defaults = [
      { role: 'growth_director', cron: '0 9 * * *', task: '扫描市场变化，分析竞品动态，生成市场机会日报', type: 'scan' },
      { role: 'content_manager', cron: '0 10 * * *', task: '根据市场趋势生成今日内容计划，输出3套选题方案', type: 'content' },
      { role: 'market_analyst', cron: '0 11 * * *', task: '分析行业数据，输出竞品分析报告', type: 'analysis' },
      { role: 'customer_ops', cron: '0 14 * * *', task: '梳理客户跟进线索，输出客户互动建议', type: 'outreach' },
      { role: 'sales_assistant', cron: '0 17 * * *', task: '整理今日销售线索，更新线索状态', type: 'report' },
    ]

    for (const agent of agents) {
      const defaultConfig = defaults.find(d => agent.agentType?.includes(d.role) || agent.role?.includes(d.role))
      if (defaultConfig) {
        await this.createSchedule({
          tenantId,
          agentId: agent.id,
          cronExpression: defaultConfig.cron,
          taskTemplate: defaultConfig.task,
          taskType: defaultConfig.type,
        })
      }
    }
  }

  /**
   * 计算下次执行时间（简化版，返回下一个整点）
   */
  private calculateNextRun(cronExpression: string): Date {
    const now = new Date()
    // 简化：直接给出当前时间+1小时的整点
    const next = new Date(now)
    next.setHours(next.getHours() + 1, 0, 0, 0)
    // 如果cron是 0 9 * * *，返回明天9:00
    const parts = cronExpression.split(' ')
    if (parts.length >= 2) {
      const hour = parseInt(parts[0]) || 9
      const nextRun = new Date(now)
      nextRun.setHours(hour, 0, 0, 0)
      if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1)
      return nextRun
    }
    return next
  }
}

export const agentScheduleService = new AgentScheduleService()
