/**
 * Enterprise AI Workforce — Agent Schedule API
 * 定时任务 + 目标追踪接口
 */
import type { FastifyInstance } from 'fastify'
import { agentScheduleService } from '../services/enterprise/agent-schedule.service.js'

export async function agentScheduleRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/enterprise/:tenantId/schedules — 企业所有定时任务
  app.get('/api/enterprise/:tenantId/schedules', async (request, reply) => {
    const { tenantId } = request.params as any
    try {
      const schedules = await agentScheduleService.getActiveSchedules(tenantId)
      return { success: true, data: schedules }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // POST /api/enterprise/:tenantId/schedules — 创建定时任务
  app.post('/api/enterprise/:tenantId/schedules', async (request, reply) => {
    const { tenantId } = request.params as any
    const body = request.body as any
    try {
      const schedule = await agentScheduleService.createSchedule({
        tenantId,
        agentId: body.agentId,
        cronExpression: body.cronExpression,
        taskTemplate: body.taskTemplate,
        taskType: body.taskType,
        scheduleType: body.scheduleType,
      })
      return { success: true, data: schedule }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // DELETE /api/enterprise/:tenantId/schedules/:scheduleId — 删除定时任务
  app.delete('/api/enterprise/:tenantId/schedules/:scheduleId', async (request, reply) => {
    const { scheduleId } = request.params as any
    try {
      await agentScheduleService.deleteSchedule(scheduleId)
      return { success: true }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/enterprise/:tenantId/goals?date=YYYY-MM-DD — 每日目标
  app.get('/api/enterprise/:tenantId/goals', async (request, reply) => {
    const { tenantId } = request.params as any
    const { date } = request.query as any
    const goalDate = date || new Date().toISOString().slice(0, 10)
    try {
      const goals = await agentScheduleService.getDailyGoals(tenantId, goalDate)
      return { success: true, data: goals }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // POST /api/enterprise/:tenantId/goals — 创建/更新目标
  app.post('/api/enterprise/:tenantId/goals', async (request, reply) => {
    const { tenantId } = request.params as any
    const body = request.body as any
    try {
      const goal = await agentScheduleService.createGoal({
        tenantId,
        agentId: body.agentId,
        goalDate: body.goalDate || new Date().toISOString().slice(0, 10),
        goalType: body.goalType,
        description: body.description,
        targetCount: body.targetCount,
      })
      return { success: true, data: goal }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // POST /api/enterprise/:tenantId/schedules/:scheduleId/toggle — 启用/禁用
  app.post('/api/enterprise/:tenantId/schedules/:scheduleId/toggle', async (request, reply) => {
    const { scheduleId } = request.params as any
    const { enabled } = request.body as any
    try {
      await agentScheduleService.toggleSchedule(scheduleId, enabled)
      return { success: true }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
