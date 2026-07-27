// routes/admin-subscription-v2.ts — 企业订阅管理增强 v2（含审计日志）
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'
import { isValidUUID } from '../lib/uuid-validate.js'

export default async function adminSubscriptionV2Routes(app: FastifyInstance) {

  // ── 辅助函数：记录管理员操作审计 ──
  async function logAdminAction(
    adminId: string,
    organizationId: string,
    action: string,
    before: any,
    after: any,
    reason?: string
  ) {
    await prisma.agentAuditTrail.create({
      data: {
        tenantId: organizationId,
        action: `admin.subscription.${action}`,
        resource: 'enterprise_subscription',
        metadata: JSON.stringify({
          adminId,
          organizationId,
          before,
          after,
          reason: reason || '管理员操作',
          timestamp: new Date().toISOString(),
        }),
      },
    })
  }

  // ── 订阅管理增强（不覆盖已有路由） ──

  // PATCH /api/admin/enterprise/subscriptions/:id/pause — 暂停订阅
  app.patch('/api/admin/enterprise/subscriptions/:id/pause', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    await prisma.enterpriseSubscription.update({ where: { id }, data: { status: 'paused' } })
    await logAdminAction(adminId, sub.organizationId, 'PAUSE', { status: sub.status }, { status: 'paused' }, reason)
    return toApiResponse({ success: true, message: '订阅已暂停' })
  })

  // PATCH /api/admin/enterprise/subscriptions/:id/resume — 恢复订阅
  app.patch('/api/admin/enterprise/subscriptions/:id/resume', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    await prisma.enterpriseSubscription.update({ where: { id }, data: { status: 'active' } })
    await logAdminAction(adminId, sub.organizationId, 'RESUME', { status: sub.status }, { status: 'active' }, reason)
    return toApiResponse({ success: true, message: '订阅已恢复' })
  })

  // PATCH /api/admin/enterprise/subscriptions/:id/cancel — 取消订阅
  app.patch('/api/admin/enterprise/subscriptions/:id/cancel', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    await prisma.enterpriseSubscription.update({ where: { id }, data: { status: 'cancelled', autoRenew: false } })
    await logAdminAction(adminId, sub.organizationId, 'CANCEL', { status: sub.status }, { status: 'cancelled' }, reason)
    return toApiResponse({ success: true, message: '订阅已取消' })
  })

  // PATCH /api/admin/enterprise/subscriptions/:id/change-plan — 升级/降级
  app.patch('/api/admin/enterprise/subscriptions/:id/change-plan', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    if (!isValidUUID(id)) return reply.status(400).send(toApiResponse({ success: false, message: '无效的订阅 ID' }))
    const { planId, reason } = request.body as any
    const sub = await prisma.enterpriseSubscription.findUnique({ where: { id } })
    if (!sub) return reply.status(404).send(toApiResponse({ success: false, message: '订阅不存在' }))
    const newPlan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
    if (!newPlan) return reply.status(404).send(toApiResponse({ success: false, message: '目标套餐不存在' }))
    const adminId = (request.user as any)?.id || (request.user as any)?.userId || 'unknown'
    const oldSnapshot = {
      planId: sub.planId,
      name: sub.snapshotName,
      price: sub.snapshotPrice,
      cycle: sub.snapshotCycle,
    }
    const newSnapshot = {
      planId: newPlan.id,
      name: newPlan.displayName,
      price: newPlan.price,
      cycle: newPlan.billingCycle,
    }
    await prisma.enterpriseSubscription.update({
      where: { id },
      data: {
        planId,
        snapshotName: newPlan.displayName,
        snapshotPrice: newPlan.price,
        snapshotCycle: newPlan.billingCycle,
        snapshotMaxEmployees: newPlan.maxEmployees,
        snapshotMaxChannels: newPlan.maxChannels,
        snapshotMaxMembers: newPlan.maxMembers,
        snapshotFeatures: newPlan.features as any,
      },
    })
    await logAdminAction(adminId, sub.organizationId, 'CHANGE_PLAN', oldSnapshot, newSnapshot, reason)
    return toApiResponse({ success: true, message: '套餐已变更' })
  })

  // GET /api/admin/enterprise/subscription-stats — 订阅统计 (MRR/ARR)
  app.get('/api/admin/enterprise/subscription-stats', { preHandler: [requireAdmin] }, async () => {
    const [total, active, paused, expired, cancelled, monthlyRevenue, yearlyRevenue] = await Promise.all([
      prisma.enterpriseSubscription.count(),
      prisma.enterpriseSubscription.count({ where: { status: 'active' } }),
      prisma.enterpriseSubscription.count({ where: { status: 'paused' } }),
      prisma.enterpriseSubscription.count({ where: { status: 'expired' } }),
      prisma.enterpriseSubscription.count({ where: { status: 'cancelled' } }),
      prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'monthly' }, _sum: { snapshotPrice: true } }),
      prisma.enterpriseSubscription.aggregate({ where: { status: 'active', snapshotCycle: 'yearly' }, _sum: { snapshotPrice: true } }),
    ])

    const mrr = (monthlyRevenue._sum.snapshotPrice || 0) + Math.floor((yearlyRevenue._sum.snapshotPrice || 0) / 12)
    const arr = mrr * 12

    return toApiResponse({
      success: true,
      data: {
        total, active, paused, expired, cancelled,
        mrr, arr,
        monthlySubs: monthlyRevenue._sum.snapshotPrice || 0,
        yearlySubs: yearlyRevenue._sum.snapshotPrice || 0,
      },
    })
  })
}
