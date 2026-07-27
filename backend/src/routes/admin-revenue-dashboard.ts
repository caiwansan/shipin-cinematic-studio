// routes/admin-revenue-dashboard.ts — 企业管理后台 - 收入仪表盘

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'
import { revenueDashboardService } from '../services/enterprise/revenue-dashboard.service.js'

export default async function adminRevenueDashboardRoutes(app: FastifyInstance) {

  // ── 收入总览 ──

  app.get('/api/admin/enterprise/revenue/overview', { preHandler: [requireAdmin] }, async () => {
    const data = await revenueDashboardService.getOverview()
    return toApiResponse(data)
  })

  // ── 套餐分析 ──

  app.get('/api/admin/enterprise/revenue/plans', { preHandler: [requireAdmin] }, async () => {
    const data = await revenueDashboardService.getPlanAnalysis()
    return toApiResponse(data)
  })

  // ── Beta 转化漏斗 ──

  app.get('/api/admin/enterprise/revenue/funnel', { preHandler: [requireAdmin] }, async () => {
    const stages = [
      'enterprise.lifecycle.signup',
      'enterprise.lifecycle.pricing_viewed',
      'enterprise.lifecycle.payment_created',
      'enterprise.lifecycle.payment_success',
      'enterprise.lifecycle.subscription_active',
      'enterprise.employee.created',
      'enterprise.employee.first_task_started',
      'enterprise.employee.first_outcome_created',
    ]

    const counts: Record<string, number> = {}
    for (const stage of stages) {
      counts[stage] = await prisma.agentAuditTrail.count({ where: { action: stage } })
    }

    const signupCount = Math.max(counts['enterprise.lifecycle.signup'], 1)
    const funnel = stages.map((stage) => ({
      stage,
      count: counts[stage] || 0,
      rate: Math.round(((counts[stage] || 0) / signupCount) * 100),
    }))

    return toApiResponse({ funnel })
  })

  // ── TTFV 分析 ──

  app.get('/api/admin/enterprise/revenue/ttfv', { preHandler: [requireAdmin] }, async () => {
    const data = await revenueDashboardService.getTTFVAnalysis()
    return toApiResponse(data)
  })

  // ── 流失风险 ──

  app.get('/api/admin/enterprise/revenue/churn-risk', { preHandler: [requireAdmin] }, async () => {
    const data = await revenueDashboardService.getChurnRisk()
    return toApiResponse(data)
  })
}
