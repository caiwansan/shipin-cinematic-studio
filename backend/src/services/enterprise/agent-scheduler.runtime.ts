/**
 * Enterprise AI Workforce — Agent Scheduler Runtime
 * 定时任务引擎：每分钟检查 agent_schedule，触发到期任务
 *
 * Phase 2.5: Autonomous Operation
 */
import { prisma } from '../../utils/index.js'
import { agentScheduleService } from './agent-schedule.service.js'
import { agentAuditService } from './agent-audit.service.js'

export class AgentScheduler {
  private timer: NodeJS.Timeout | null = null
  private running = false

  /**
   * 启动调度引擎
   */
  start() {
    if (this.running) return
    this.running = true
    console.log('[AgentScheduler] 🚀 调度引擎启动')

    // 每分钟检查一次
    this.timer = setInterval(() => {
      this.tick().catch(e => console.error('[AgentScheduler] tick error:', e.message))
    }, 60 * 1000)

    // 立即执行一次
    this.tick().catch(e => console.error('[AgentScheduler] initial tick error:', e.message))
  }

  /**
   * 停止调度引擎
   */
  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.running = false
    console.log('[AgentScheduler] ⏹ 调度引擎停止')
  }

  /**
   * 核心调度循环
   */
  private async tick() {
    const now = new Date()
    // 获取所有到期任务
    const dueSchedules = await prisma.agentSchedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      include: { agent: true },
    })

    if (dueSchedules.length > 0) {
      console.log(`[AgentScheduler] ⏰ ${dueSchedules.length} 个任务到期`)
    }

    for (const schedule of dueSchedules) {
      this.executeSchedule(schedule).catch(e =>
        console.error(`[AgentScheduler] 执行失败 ${schedule.id}:`, e.message)
      )
    }
  }

  /**
   * 执行单个定时任务
   */
  private async executeSchedule(schedule: any) {
    const { id, tenantId, agentId, taskTemplate, taskType, agent } = schedule

    console.log(`[AgentScheduler] 执行任务: ${agent?.name || agentId} - ${taskType}`)

    const startTime = Date.now()

    try {
      // 记录审计日志（任务开始）
      await agentAuditService.log({
        tenantId,
        agentId,
        action: `auto_${taskType}_started`,
        resource: 'schedule',
        resourceId: id,
        inputSummary: taskTemplate.slice(0, 200),
        tokenUsage: 0,
        cost: 0,
      })

      // TODO: 未来接入实际LLM调用
      // 当前阶段：记录模拟执行
      const duration = Date.now() - startTime
      const mockOutput = `[自动执行] ${taskTemplate.slice(0, 100)}...`

      // 记录审计日志（任务完成）
      await agentAuditService.log({
        tenantId,
        agentId,
        action: `auto_${taskType}_completed`,
        resource: 'schedule',
        resourceId: id,
        outputSummary: mockOutput,
        tokenUsage: 0,
        cost: 0,
        durationMs: duration,
      })

      // 更新目标进度
      const today = new Date().toISOString().slice(0, 10)
      await agentScheduleService.trackGoal(agentId, today, taskType, 1)

      // 更新任务执行时间
      await agentScheduleService.markRun(id)

      console.log(`[AgentScheduler] ✅ 任务完成: ${agent?.name} - ${taskType}`)
    } catch (e: any) {
      // 记录失败
      await agentAuditService.log({
        tenantId,
        agentId,
        action: `auto_${taskType}_failed`,
        resource: 'schedule',
        resourceId: id,
        outputSummary: e.message,
        tokenUsage: 0,
        cost: 0,
        durationMs: Date.now() - startTime,
      })
      console.error(`[AgentScheduler] ❌ 任务失败: ${agent?.name} - ${e.message}`)
    }
  }
}

// 单例
export const agentScheduler = new AgentScheduler()
