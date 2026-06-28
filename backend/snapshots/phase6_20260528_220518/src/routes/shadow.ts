/**
 * STEP 6 Shadow Mode + Gray Release Routes
 * 
 * 完全旁路系统，不干扰主链路。
 * 全部挂载在 /api/shadow/* 下
 */

import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import {
  shadowGate,
  shadowQueueExecute,
  updateGrayThreshold,
  toggleShadow,
  getShadowStats,
  getShadowLogs,
  costGuardPreCheck,
} from '../services/shadow-execution.service'

const prisma = new PrismaClient()

export default async function shadowRoutes(fastify: FastifyInstance) {
  // ============================================================
  // 配置控制
  // ============================================================

  // 获取 Shadow 系统状态（控制台数据源）
  fastify.get('/api/shadow/status', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    const stats = await getShadowStats()
    return reply.send(stats)
  })

  // 开关 Shadow 系统
  fastify.post('/api/shadow/toggle', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { enabled } = request.body as any
    if (typeof enabled !== 'boolean') {
      return reply.status(400).send({ error: 'enabled must be boolean' })
    }
    const config = await toggleShadow(enabled)
    return reply.send({ enabled: config.enabled, grayThreshold: config.grayThreshold })
  })

  // 设置灰度阈值
  fastify.post('/api/shadow/gray-threshold', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { threshold } = request.body as any
    if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
      return reply.status(400).send({ error: 'threshold must be 0-100' })
    }
    const config = await updateGrayThreshold(threshold)
    return reply.send({ enabled: config.enabled, grayThreshold: config.grayThreshold })
  })

  // ============================================================
  // Smoke Test — 无侵入测试 Shadow 链路
  // ============================================================

  // 模拟一次 Shadow 执行（不记主链路成本）
  fastify.post('/api/shadow/smoke', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskType, modelName, promptPreview } = request.body as any
    const user = (request as any).user

    if (!taskType || !modelName) {
      return reply.status(400).send({ error: 'taskType and modelName required' })
    }

    const gate = await shadowGate(user.id)
    if (!gate.allowed) {
      return reply.send({ gate, shadowExecuted: false, reason: gate.reason })
    }

    const mockOutput = {
      content: `[Mock] Test output for ${taskType} using ${modelName}`,
      model: modelName,
      usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 },
    }

    const result = await shadowQueueExecute({
      taskId: `smoke-${Date.now()}`,
      projectId: 'smoke-test',
      userId: user.id,
      taskType,
      modelName,
      promptPreview,
      mockOutput,
      mockLatencyMs: 800,
      mockCost: 0.005,
    })

    if (result) {
      return reply.send({ gate, shadowExecuted: true, logId: result.logId })
    }
    return reply.send({ gate, shadowExecuted: false, reason: 'queue_rejected' })
  })

  // ============================================================
  // 成本控制
  // ============================================================

  // 成本预算列表
  fastify.get('/api/shadow/budgets', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    
    
    const budgets = await prisma.costBudget.findMany({ orderBy: { scope: 'asc' } })
    return reply.send(budgets.map((b: any) => ({
      id: b.id,
      scope: b.scope,
      scopeId: b.scopeId,
      budgetAmount: Number(b.budgetAmount),
      spentAmount: Number(b.spentAmount),
      usagePct: Number(b.budgetAmount) > 0 ? ((Number(b.spentAmount) / Number(b.budgetAmount)) * 100).toFixed(1) : '0',
      alertThreshold: b.alertThreshold,
      blockThreshold: b.blockThreshold,
      period: b.period,
      enabled: b.enabled,
      lastAlertAt: b.lastAlertAt,
      lastBlockedAt: b.lastBlockedAt,
    })))
  })

  // 更新预算
  fastify.put('/api/shadow/budgets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { budgetAmount, alertThreshold, blockThreshold, enabled } = request.body as any
    
    

    const data: any = {}
    if (budgetAmount !== undefined) data.budgetAmount = budgetAmount
    if (alertThreshold !== undefined) data.alertThreshold = alertThreshold
    if (blockThreshold !== undefined) data.blockThreshold = blockThreshold
    if (enabled !== undefined) data.enabled = enabled

    const updated = await prisma.costBudget.update({ where: { id }, data })
    return reply.send({ id: updated.id, ...data })
  })

  // ============================================================
  // 日志查询
  // ============================================================

  // Shadow 执行日志
  fastify.get('/api/shadow/logs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as any
    const limit = Math.min(parseInt(query.limit) || 20, 100)
    const offset = parseInt(query.offset) || 0
    const logs = await getShadowLogs(limit, offset)
    return reply.send(logs)
  })

  // ============================================================
  // 漂移检测历史
  // ============================================================

  fastify.get('/api/shadow/drifts', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    
    
    const drifts = await prisma.shadowDriftHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send(drifts)
  })

  // ============================================================
  // 熔断器/成本联动状态
  // ============================================================

  fastify.get('/api/shadow/risks', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    
    

    // 看哪些模型熔断器开着
    const breakers = await prisma.aiCircuitBreaker.findMany({
      where: { state: { not: 'closed' } },
    })

    // 看哪些预算快满了
    const budgets = await prisma.costBudget.findMany({ where: { enabled: true } })
    const nearLimits = (budgets as any[])
      .filter(b => Number(b.budgetAmount) > 0 && (Number(b.spentAmount) / Number(b.budgetAmount)) * 100 >= 60)
      .map(b => ({
        scope: b.scope,
        scopeId: b.scopeId,
        usagePct: ((Number(b.spentAmount) / Number(b.budgetAmount)) * 100).toFixed(1),
        alertAt: b.alertThreshold,
        blockAt: b.blockThreshold,
        lastAlertAt: b.lastAlertAt,
        lastBlockedAt: b.lastBlockedAt,
      }))

    return reply.send({
      openBreakers: breakers.map((b: any) => ({ modelId: b.modelId, state: b.state, openedAt: b.openedAt })),
      nearLimitBudgets: nearLimits,
      riskLevel: nearLimits.length > 2 ? 'high' : nearLimits.length > 0 ? 'medium' : 'low',
    })
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "shadow",
  "mode": "SHADOW"
};

