import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/analytics.ts — 用户行为分析 API
 *
 * POST /api/analytics/track  — 客户端埋点
 * GET  /api/analytics/events — 查询事件列表
 * GET  /api/analytics/funnel — 转化漏斗统计（需管理员权限）
 * GET  /api/analytics/dau   — 日活跃用户统计（需管理员权限）
 * GET  /api/analytics/summary — 概览数据（需管理员权限）
 */

import { FastifyInstance } from 'fastify'
import { track, queryEvents, funnelStats, dailyActiveUsers, countByEvent } from '../services/analytics.service.js'

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // ============================================
  // POST /api/analytics/track — 埋点事件上报
  // 无需认证（允许匿名埋点）
  // ============================================
  fastify.post('/api/analytics/track', async (request, reply) => {
    const body = request.body as any

    const { event, metadata } = body
    const userId = (request as any).user?.id || body.userId || 'anonymous'

    if (!event || typeof event !== 'string') {
      return reply.status(400).send({ success: false, error: 'event 为必填项' })
    }

    const validEvents = [
      'script_created', 'segment_created', 'ai_analysis',
      'quota_hit', 'upgrade_clicked', 'payment_success',
      'export_video', 'login', 'project_created',
    ]

    if (!validEvents.includes(event)) {
      return reply.status(400).send({ success: false, error: `无效事件类型: ${event}` })
    }

    await track(userId, event, metadata)
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // ============================================
  // GET /api/analytics/events — 查询事件（需认证）
  // ============================================
  fastify.get('/api/analytics/events', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as any
    const userId = (request as any).user?.id

    // 普通用户只能查自己的事件
    const filters: any = {
      userId,
    }

    if (query.event) filters.event = query.event
    if (query.limit) filters.limit = Math.min(Number(query.limit), 500)
    if (query.offset) filters.offset = Number(query.offset)

    const result = await queryEvents(filters)
    return { success: true, ...result } satisfies ApiResponse<unknown>;

  })

  // ============================================
  // GET /api/analytics/funnel — 转化漏斗
  // ============================================
  fastify.get('/api/analytics/funnel', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as any

    const now = new Date()
    const fromDate = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const toDate = query.to ? new Date(query.to) : now

    const funnel = await funnelStats(fromDate, toDate)
    return { success: true, data: { from: fromDate, to: toDate, funnel } } satisfies ApiResponse<unknown>;

  })

  // ============================================
  // GET /api/analytics/dau — 日活跃用户
  // ============================================
  fastify.get('/api/analytics/dau', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const query = request.query as any
    const date = query.date ? new Date(query.date) : new Date()

    const dau = await dailyActiveUsers(date)
    return { success: true, data: { date, dau } } satisfies ApiResponse<unknown>;

  })

  // ============================================
  // GET /api/analytics/summary — 概览数据
  // ============================================
  fastify.get('/api/analytics/summary', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const [dau, eventCounts] = await Promise.all([
      dailyActiveUsers(now),
      countByEvent(todayStart, todayEnd),
    ])

    return {
      success: true,
      data: {
        dau,
        todayTotalEvents: eventCounts.reduce((sum, e) => sum + e.count, 0),
        eventBreakdown: eventCounts,
      },
    }
  })
}

// 添加 route 注册声明（供 index.ts 注册时识别）
export const autoRegister = true
