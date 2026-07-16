/**
 * Enterprise AI Workforce — CEO Dashboard API
 * 企业数字部门 CEO 控制台
 *
 * 数据来源：Database → Service → API → UI（禁止mock）
 * 仅修改 enterprise/* 命名空间，不影响已有业务
 */
import type { FastifyInstance } from 'fastify'
import { dashboardService } from '../services/enterprise/dashboard.service.js'
import { aiDepartmentService } from '../services/enterprise/ai-department.service.js'
import { tenantOwnershipGuard } from '../enterprise/reality/tenant-guard.js'
import { withDataSource, isDemoTenant, isNewTenant, getEmptyStateData } from '../enterprise/reality/demo-boundary.js'
import { prisma } from '../utils/index.js'

export async function enterpriseDashboardRoutes(app: FastifyInstance) {
  // 所有企业接口都需要 JWT 认证
  app.addHook('preHandler', app.authenticate)
  // AC4.1: 防止水平越权
  app.addHook('preHandler', tenantOwnershipGuard)

  // ============================================================
  // CEO Dashboard 主入口
  // ============================================================

  // GET /api/enterprise/:tenantId/dashboard
  app.get('/api/enterprise/:tenantId/dashboard', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any

    try {
      // AC4.4: Check if new tenant → return empty state instead of Tesla data
      if (!isDemoTenant(tenantId)) {
        const isEmpty = await isNewTenant(tenantId, prisma)
        if (isEmpty) {
          const emptyState = getEmptyStateData(tenantId)
          return reply.send({ code: 0, data: emptyState, dataSource: 'production', isNewTenant: true })
        }
      }

      const data = await dashboardService.getDashboard(tenantId)
      // AC4.3: Add data source labeling
      return reply.send(withDataSource({ code: 0, data }, tenantId))
    } catch (e: any) {
      return reply.status(500).send({ code: 500, error: e.message, dataSource: isDemoTenant(tenantId) ? 'demo' : 'production' })
    }
  })

  // ============================================================
  // 子接口：Agent 状态
  // ============================================================

  // GET /api/enterprise/:tenantId/dashboard/agents
  app.get('/api/enterprise/:tenantId/dashboard/agents', async (request, reply) => {
    const { tenantId } = request.params as any
    try {
      const data = await dashboardService.getDashboard(tenantId)
      return { success: true, data: data.agentStatus }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ============================================================
  // 子接口：Token 成本
  // ============================================================

  // GET /api/enterprise/:tenantId/dashboard/cost
  app.get('/api/enterprise/:tenantId/dashboard/cost', async (request, reply) => {
    const { tenantId } = request.params as any
    try {
      const data = await dashboardService.getDashboard(tenantId)
      return { success: true, data: data.tokenCost }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ============================================================
  // 子接口：今日任务
  // ============================================================

  // GET /api/enterprise/:tenantId/dashboard/today
  app.get('/api/enterprise/:tenantId/dashboard/today', async (request, reply) => {
    const { tenantId } = request.params as any
    try {
      const data = await dashboardService.getDashboard(tenantId)
      return { success: true, data: data.todayTasks }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ============================================================
  // 子接口：业务指标
  // ============================================================

  // GET /api/enterprise/:tenantId/dashboard/metrics
  app.get('/api/enterprise/:tenantId/dashboard/metrics', async (request, reply) => {
    const { tenantId } = request.params as any
    try {
      const data = await dashboardService.getDashboard(tenantId)
      return { success: true, data: data.businessMetrics }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // GET /api/enterprise/:tenantId/dashboard/channels — 渠道健康度矩阵
  app.get('/api/enterprise/:tenantId/dashboard/channels', async (request, reply) => {
    const { tenantId } = request.params as any
    try {
      const data = await dashboardService.getChannelHealthMatrix(tenantId)
      return { success: true, data }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ============================================================
  // Sprint 4.2.9 Phase 3: AI 数字部门总控台
  // ============================================================

  // GET /api/enterprise/:tenantId/ai-department/overview
  app.get('/api/enterprise/:tenantId/ai-department/overview', async (request, reply) => {
    const { tenantId } = request.params as any
    try {
      const data = await aiDepartmentService.getOverview(tenantId)
      return reply.send({ code: 0, data })
    } catch (e: any) {
      return reply.status(500).send({ code: 500, error: e.message })
    }
  })
}
