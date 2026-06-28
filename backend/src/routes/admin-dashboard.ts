// admin-dashboard.ts — 后台仪表盘统计数据 API
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

/**
 * GET /api/admin/dashboard — 仪表盘统计数据
 *
 * 返回:
 *   todayNewUsers       — 今日新增注册用户
 *   monthNewUsers       — 本月新增注册用户
 *   todayNewVip         — 今日新增 VIP 会员（memberTier 非 free 且今日 updatedAt）
 *   monthNewVip         — 本月新增 VIP 会员
 *   todayRevenue        — 今日收益（PaymentOrder paid）
 *   monthRevenue        — 本月收益
 *   monthNewAgents      — 本月新增代理商
 *   newCommission       — 新增佣金金额（CommissionOrder 当月）
 *   pendingWithdraw     — 待提现金额
 */
export default async function adminDashboardRoutes(app: FastifyInstance) {

  app.get('/api/admin/dashboard', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // 同时跑所有查询
      const [
        todayNewUsers,
        monthNewUsers,
        totalUsers,
        todayNewVip,
        monthNewVip,
        todayRevenueResult,
        monthRevenueResult,
        monthNewAgents,
        commissionResult,
        pendingWithdrawResult,
      ] = await Promise.all([

        // 今日新增注册
        prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),

        // 本月新增注册
        prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),

        // 全量用户总数
        prisma.user.count(),

        // 今日新增 VIP（memberTier != 'free' 且今日有 updatedAt 的）
        prisma.user.count({
          where: {
            memberTier: { not: 'free' },
            updatedAt: { gte: startOfToday },
          },
        }),

        // 本月新增 VIP
        prisma.user.count({
          where: {
            memberTier: { not: 'free' },
            updatedAt: { gte: startOfMonth },
          },
        }),

        // 今日收益（已支付的 PaymentOrder, type=subscription 或 credit）
        prisma.paymentOrder.aggregate({
          _sum: { amount: true },
          where: {
            status: 'paid',
            payTime: { gte: startOfToday },
          },
        }),

        // 本月收益
        prisma.paymentOrder.aggregate({
          _sum: { amount: true },
          where: {
            status: 'paid',
            payTime: { gte: startOfMonth },
          },
        }),

        // 本月新增代理商
        prisma.user.count({
          where: {
            agentStatus: 'active',
            agentCreatedAt: { gte: startOfMonth },
          },
        }),

        // 佣金金额（CommissionOrder.status = completed/paid，当月）
        prisma.commissionOrder.aggregate({
          _sum: { amount: true },
          where: {
            status: { in: ['completed', 'paid'] },
            createdAt: { gte: startOfMonth },
          },
        }).catch(() => ({ _sum: { amount: null } })),

        // 待提现金额
        prisma.agentWithdraw.aggregate({
          _sum: { amount: true },
          where: { status: 'pending' },
        }),
      ])

      return {
        success: true,
        data: {
          todayNewUsers,
          monthNewUsers,
          totalUsers,
          todayNewVip,
          monthNewVip,
          todayRevenue: todayRevenueResult._sum.amount || 0,
          monthRevenue: monthRevenueResult._sum.amount || 0,
          monthNewAgents,
          newCommission: commissionResult?._sum?.amount || 0,
          pendingWithdraw: pendingWithdrawResult._sum.amount || 0,
        },
      }
    } catch (err: any) {
      console.error('[admin-dashboard] error:', err?.message || err)
      return reply.status(500).send({ success: false, error: err?.message || '获取仪表盘数据失败' })
    }
  })
}
