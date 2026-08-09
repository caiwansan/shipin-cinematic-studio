/**
 * Enterprise AI Workforce — Agent Scheduler Runtime
 * 定时任务引擎：每分钟检查 agent_schedule，触发到期任务
 *
 * Phase 2.5: Autonomous Operation
 */
import { prisma } from '../../utils/index.js'
import { agentScheduleService } from './agent-schedule.service.js'
import { agentAuditService } from './agent-audit.service.js'
import { mediaAgentRuntimeAdapter } from '../media/agent/media-agent-runtime-adapter.js'

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
   * 
   * Phase 3 (掌柜 2026-08-08 批准): 替换 mock 为真实 Hermes Runtime 执行
   * 链路: Scheduler → MediaAgentRuntimeAdapter → EnterpriseAgentRuntimeService → Hermes
   */
  private async executeSchedule(schedule: any) {
    const { id, tenantId, agentId, taskTemplate, taskType, agent } = schedule

    console.log(`[AgentScheduler] 执行任务: ${agent?.name || agentId} - ${taskType}`)

    const startTime = Date.now()

    try {
      // 0. 查找 Agent Instance
      const instance = await prisma.enterpriseAgentInstance.findFirst({
        where: { employeeId: agentId },
      })

      if (!instance) {
        console.warn(`[AgentScheduler] Agent 无 Instance，跳过: ${agentId}`)
        await agentAuditService.log({
          tenantId,
          agentId,
          action: `auto_${taskType}_no_instance`,
          resource: 'schedule',
          resourceId: id,
          inputSummary: 'No EnterpriseAgentInstance found',
          tokenUsage: 0,
          cost: 0,
        })
        await agentScheduleService.markRun(id)
        return
      }

      // 1. 记录审计日志（任务开始）
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

      // 2. 真实 Hermes Runtime 执行 (Phase 3 替换 mock)
      // 链路: Scheduler → MediaAgentRuntimeAdapter → EnterpriseAgentRuntimeService → Hermes
      const result = await mediaAgentRuntimeAdapter.executeMediaAgentTask({
        instanceId: instance.id,
        taskType: taskType || 'general',
        instruction: taskTemplate,
        taskId: `schedule_${id}`,
        userId: 'system:scheduler',
      })

      const duration = Date.now() - startTime

      // 3. 记录审计日志（任务完成/失败）
      if (result.success) {
        await agentAuditService.log({
          tenantId,
          agentId,
          action: `auto_${taskType}_completed`,
          resource: 'schedule',
          resourceId: id,
          outputSummary: result.output.slice(0, 500),
          tokenUsage: 0,
          cost: 0,
          durationMs: duration,
        })

        // 更新目标进度
        const today = new Date().toISOString().slice(0, 10)
        await agentScheduleService.trackGoal(agentId, today, taskType, 1)

        console.log(`[AgentScheduler] ✅ 任务完成: ${agent?.name} - ${taskType} (${duration}ms)`)
      } else {
        await agentAuditService.log({
          tenantId,
          agentId,
          action: `auto_${taskType}_failed`,
          resource: 'schedule',
          resourceId: id,
          outputSummary: result.error || 'Unknown error',
          tokenUsage: 0,
          cost: 0,
          durationMs: duration,
        })

        console.error(`[AgentScheduler] ❌ 任务失败: ${agent?.name} - ${result.error}`)
      }

      // 4. 更新任务执行时间
      await agentScheduleService.markRun(id)

    } catch (e: any) {
      // 记录异常
      await agentAuditService.log({
        tenantId,
        agentId,
        action: `auto_${taskType}_error`,
        resource: 'schedule',
        resourceId: id,
        outputSummary: e.message,
        tokenUsage: 0,
        cost: 0,
        durationMs: Date.now() - startTime,
      })
      console.error(`[AgentScheduler] ❌ 任务异常: ${agent?.name} - ${e.message}`)
      // 即使异常也更新执行时间，避免无限重试
      await agentScheduleService.markRun(id).catch(() => {})
    }
  }
}

// 单例
export const agentScheduler = new AgentScheduler()
