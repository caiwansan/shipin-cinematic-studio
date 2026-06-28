/**
 * routes/admin-market-agents.ts — 市场代理管理 API
 *
 * 代理商管理
 *   GET    /api/admin/market-agents             — 获取所有代理
 *   POST   /api/admin/market-agents             — 新增代理
 *   PUT    /api/admin/market-agents/:id         — 编辑代理
 *   PATCH  /api/admin/market-agents/:id/status  — 切换代理状态
 *   DELETE /api/admin/market-agents/:id         — 删除代理
 *
 * 佣金配置
 *   GET    /api/admin/commission-configs        — 获取佣金配置
 *   PUT    /api/admin/commission-configs/:level — 更新佣金配置
 *
 * 佣金订单明细
 *   GET    /api/admin/commission-orders         — 获取佣金订单明细
 *   POST   /api/admin/commission-orders/settle  — 批量结算
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminMarketAgentsRoutes(app: FastifyInstance) {
  // ================================================
  // 代理商 CRUD
  // ================================================

  // GET /api/admin/market-agents — 获取所有代理
  app.get('/api/admin/market-agents', { preHandler: [requireAdmin] }, async () => {
    const agents = await prisma.marketAgent.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { orderRecords: true } },
      },
    })
    return { success: true, data: agents }
  })

  // GET /api/admin/market-agents/:id — 获取单个代理详情
  app.get('/api/admin/market-agents/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const agent = await prisma.marketAgent.findUnique({
      where: { id },
      include: {
        orderRecords: { orderBy: { createdAt: 'desc' }, take: 50 },
        _count: { select: { orderRecords: true } },
      },
    })
    if (!agent) return reply.status(404).send({ success: false, error: '代理不存在' })
    return { success: true, data: agent }
  })

  // GET /api/admin/market-agents/:id/members — 获取代理旗下会员列表
  app.get('/api/admin/market-agents/:id/members', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const agent = await prisma.marketAgent.findUnique({ where: { id } })
    if (!agent) return reply.status(404).send({ success: false, error: '代理不存在' })

    const members = await prisma.user.findMany({
      where: { marketAgentId: id },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        memberTier: true,
        memberExpiresAt: true,
        coins: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // 获取所有订单记录（佣金订单）
    const commissionOrders = await prisma.commissionOrder.findMany({
      where: { agentId: id },
      select: {
        id: true,
        userId: true,
        orderAmount: true,
        commissionAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // 按用户分组订单
    const orderMap: Record<string, any[]> = {}
    for (const o of commissionOrders) {
      if (!orderMap[o.userId]) orderMap[o.userId] = []
      orderMap[o.userId].push(o)
    }

    const result = members.map((u: any) => ({
      ...u,
      isVip: u.memberTier && u.memberTier !== 'free',
      orders: orderMap[u.id] || [],
    }))

    return { success: true, data: result }
  })

  // POST /api/admin/market-agents — 新增代理
  app.post('/api/admin/market-agents', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as any
    if (!body.name) {
      return reply.status(400).send({ success: false, error: '代理名称不能为空' })
    }
    const agent = await prisma.marketAgent.create({
      data: {
        name: body.name,
        contactPerson: body.contactPerson || '',
        phone: body.phone || '',
        email: body.email || '',
        level: body.level || 'normal',
        commissionRate: body.commissionRate || 0,
        settlementCycle: body.settlementCycle || 'monthly',
        bankName: body.bankName || '',
        bankAccount: body.bankAccount || '',
        accountName: body.accountName || '',
        remark: body.remark || '',
        referredUsers: 0,
        totalCommission: 0,
        settledCommission: 0,
        pendingCommission: 0,
        status: 'active',
      },
    })
    return { success: true, data: agent }
  })

  // PUT /api/admin/market-agents/:id — 编辑代理
  app.put('/api/admin/market-agents/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const existing = await prisma.marketAgent.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ success: false, error: '代理不存在' })

    const agent = await prisma.marketAgent.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        contactPerson: body.contactPerson !== undefined ? body.contactPerson : undefined,
        phone: body.phone !== undefined ? body.phone : undefined,
        email: body.email !== undefined ? body.email : undefined,
        level: body.level !== undefined ? body.level : undefined,
        commissionRate: body.commissionRate !== undefined ? body.commissionRate : undefined,
        settlementCycle: body.settlementCycle !== undefined ? body.settlementCycle : undefined,
        bankName: body.bankName !== undefined ? body.bankName : undefined,
        bankAccount: body.bankAccount !== undefined ? body.bankAccount : undefined,
        accountName: body.accountName !== undefined ? body.accountName : undefined,
        remark: body.remark !== undefined ? body.remark : undefined,
      },
    })
    return { success: true, data: agent }
  })

  // PATCH /api/admin/market-agents/:id/status — 切换状态
  app.patch('/api/admin/market-agents/:id/status', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const agent = await prisma.marketAgent.findUnique({ where: { id } })
    if (!agent) return reply.status(404).send({ success: false, error: '代理不存在' })
    const updated = await prisma.marketAgent.update({
      where: { id },
      data: { status: body.status || 'active' },
    })
    return { success: true, data: updated }
  })

  // DELETE /api/admin/market-agents/:id — 删除代理
  app.delete('/api/admin/market-agents/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const agent = await prisma.marketAgent.findUnique({ where: { id } })
    if (!agent) return reply.status(404).send({ success: false, error: '代理不存在' })
    // 清除该代理下所有用户的 marketAgentId
    await prisma.user.updateMany({
      where: { marketAgentId: id },
      data: { marketAgentId: null },
    })
    await prisma.marketAgent.delete({ where: { id } })
    return { success: true, message: '已删除代理' }
  })

  // ================================================
  // 佣金配置管理
  // ================================================

  // GET /api/admin/commission-configs — 获取所有佣金配置
  app.get('/api/admin/commission-configs', { preHandler: [requireAdmin] }, async () => {
    const configs = await prisma.commissionConfig.findMany({
      orderBy: { level: 'asc' },
    })
    return { success: true, data: configs }
  })

  // PUT /api/admin/commission-configs/:level — 更新单个配置
  app.put('/api/admin/commission-configs/:level', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { level } = request.params as any
    const body = request.body as any
    const config = await prisma.commissionConfig.upsert({
      where: { level },
      update: {
        rate: body.rate !== undefined ? body.rate : undefined,
        minOrderAmount: body.minOrderAmount !== undefined ? body.minOrderAmount : undefined,
        maxCommission: body.maxCommission !== undefined ? body.maxCommission : undefined,
        enabled: body.enabled !== undefined ? body.enabled : undefined,
      },
      create: {
        level,
        rate: body.rate || 0,
        minOrderAmount: body.minOrderAmount || 0,
        maxCommission: body.maxCommission || 0,
        enabled: body.enabled !== false,
      },
    })
    return { success: true, data: config }
  })

  // ================================================
  // 佣金订单明细
  // ================================================

  // GET /api/admin/commission-orders — 获取佣金订单
  app.get('/api/admin/commission-orders', { preHandler: [requireAdmin] }, async (request) => {
    const query = request.query as any
    const where: any = {}
    if (query.agentId) where.agentId = query.agentId
    if (query.status) where.status = query.status

    const orders = await prisma.commissionOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return { success: true, data: orders }
  })

  // POST /api/admin/commission-orders/settle — 批量结算
  app.post('/api/admin/commission-orders/settle', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as any
    const ids: string[] = body.ids || []
    if (ids.length === 0) return reply.status(400).send({ success: false, error: '请选择要结算的订单' })

    const now = new Date()
    const orders = await prisma.commissionOrder.findMany({
      where: { id: { in: ids }, status: 'pending' },
    })

    // 按代理分组累计结算金额
    const agentTotals: Record<string, number> = {}
    for (const o of orders) {
      agentTotals[o.agentId] = (agentTotals[o.agentId] || 0) + o.commissionAmount
    }

    // 更新订单状态
    await prisma.commissionOrder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'settled', settledAt: now },
    })

    // 更新代理的已结算/待结算余额
    for (const [agentId, amount] of Object.entries(agentTotals)) {
      await prisma.marketAgent.update({
        where: { id: agentId },
        data: {
          settledCommission: { increment: amount },
          pendingCommission: { decrement: amount },
        },
      })
    }

    return {
      success: true,
      message: `已结算 ${orders.length} 笔佣金，总计 ¥${Object.values(agentTotals).reduce((a, b) => a + b, 0).toFixed(2)}`,
      data: { settledCount: orders.length, totalAmount: Object.values(agentTotals).reduce((a, b) => a + b, 0) },
    }
  })

  // ================================================
  // 统计汇总
  // ================================================

  // GET /api/admin/market-summary — 市场代理统计概览
  app.get('/api/admin/market-summary', { preHandler: [requireAdmin] }, async () => {
    const agents = await prisma.marketAgent.findMany()
    const totalAgents = agents.length
    const activeAgents = agents.filter(a => a.status === 'active').length
    const totalCommission = agents.reduce((s, a) => s + a.totalCommission, 0)
    const pendingCommission = agents.reduce((s, a) => s + a.pendingCommission, 0)
    const settledCommission = agents.reduce((s, a) => s + a.settledCommission, 0)
    const totalReferred = agents.reduce((s, a) => s + a.referredUsers, 0)

    const monthly = await prisma.commissionOrder.aggregate({
      _sum: { commissionAmount: true },
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    })

    return {
      success: true,
      data: {
        totalAgents,
        activeAgents,
        totalCommission,
        pendingCommission,
        settledCommission,
        totalReferred,
        monthCommission: monthly._sum.commissionAmount || 0,
      },
    }
  })
}
