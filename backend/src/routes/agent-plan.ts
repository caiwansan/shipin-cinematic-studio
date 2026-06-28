/**
 * routes/agent-plan.ts — 代理商套餐 API
 *
 * 后台管理
 *   GET    /api/admin/agent-plans       — 获取所有套餐
 *   POST   /api/admin/agent-plans       — 新增套餐
 *   PUT    /api/admin/agent-plans/:id   — 编辑套餐
 *   DELETE /api/admin/agent-plans/:id   — 删除套餐
 *
 * 前台接口
 *   GET    /api/agent/plans             — 获取可用套餐列表(供用户选择)
 *   POST   /api/agent/apply             — 申请成为代理商（创建支付订单）
 *   GET    /api/agent/dashboard         — 代理商看板数据
 *   GET    /api/agent/commission-orders — 代理商自己的佣金记录
 *   POST   /api/agent/withdraw          — 提交提现申请
 *   GET    /api/agent/withdraw-history  — 提现记录
 *   GET    /api/agent/clients           — 客户列表
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function agentPlanRoutes(app: FastifyInstance) {
  // ================================================
  // 后台管理（全部需 admin 鉴权）
  // ================================================

  // GET /api/admin/agent-plans
  app.get('/api/admin/agent-plans', { preHandler: [requireAdmin] }, async () => {
    const plans = await prisma.agentPlan.findMany({ orderBy: { sortOrder: 'asc' } })
    return { success: true, data: plans }
  })

  // POST /api/admin/agent-plans
  app.post('/api/admin/agent-plans', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = request.body as any
    if (!body.level || !body.name) return reply.status(400).send({ success: false, error: '缺参数' })
    const benefits = typeof body.benefits === 'string' ? body.benefits : JSON.stringify(body.benefits || [])
    const plan = await prisma.agentPlan.create({
      data: {
        level: body.level,
        name: body.name,
        price: body.price || 0,
        months: body.months || 12,
        commissionRate: body.commissionRate || 0,
        benefits,
        icon: body.icon || '⭐',
        color: body.color || '#818cf8',
        sortOrder: body.sortOrder || 0,
        enabled: body.enabled !== false,
      },
    })
    return { success: true, data: plan }
  })

  // PUT /api/admin/agent-plans/:id
  app.put('/api/admin/agent-plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    // 确保 benefits 是字符串（前端可能传 JSON 数组对象）
    const benefits = typeof body.benefits === 'string' ? body.benefits : JSON.stringify(body.benefits || [])
    // 确保数值字段为数字类型（前端可能传空字符串导致 PG 二进制格式错误 22P03）
    console.log('[agent-plan update] body:', JSON.stringify(body))
    console.log('[agent-plan update] id:', id, 'benefits:', benefits, 'price:', Number(body.price), 'months:', Number(body.months), 'type:', typeof body.months)
    const plan = await prisma.agentPlan.update({
      where: { id },
      data: {
        name: body.name,
        price: body.price !== undefined && body.price !== '' ? Number(body.price) : 0,
        months: body.months !== undefined && body.months !== '' ? Number(body.months) : 0,
        commissionRate: body.commissionRate !== undefined && body.commissionRate !== '' ? Number(body.commissionRate) : 0,
        benefits,
        icon: body.icon || '⭐',
        color: body.color || '#818cf8',
        sortOrder: body.sortOrder !== undefined && body.sortOrder !== '' ? Number(body.sortOrder) : 0,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      },
    })
    return { success: true, data: plan }
  })

  // DELETE /api/admin/agent-plans/:id
  app.delete('/api/admin/agent-plans/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    await prisma.agentPlan.delete({ where: { id } })
    return { success: true }
  })

  // ================================================
  // 前台接口
  // ================================================

  // GET /api/agent/plans — 可用套餐
  app.get('/api/agent/plans', async () => {
    const plans = await prisma.agentPlan.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    })
    return { success: true, data: plans }
  })

  // POST /api/agent/apply — 申请代理商（生成支付订单）
  app.post('/api/agent/apply', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    if (!userId) return reply.status(401).send({ success: false, error: '请先登录' })

    const body = request.body as any
    if (!body.planLevel) return reply.status(400).send({ success: false, error: '请选择代理套餐' })

    // 校验省市区必填
    if (!body.provinceCode || !body.provinceName || !body.cityCode || !body.cityName || !body.districtCode || !body.districtName) {
      return reply.status(400).send({ success: false, error: '请选择省市区县' })
    }

    const plan = await prisma.agentPlan.findUnique({ where: { level: body.planLevel } })
    if (!plan || !plan.enabled) return reply.status(400).send({ success: false, error: '套餐不存在或已下架' })

    // 生成唯一订单号
    const orderNo = 'AGT' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase()

    // 创建支付订单到 RechargeOrder
    const order = await prisma.rechargeOrder.create({
      data: {
        userId,
        orderNo,
        planLevel: 'agent_' + plan.level,
        coins: 0,
        amount: plan.price,
        status: 'pending',
        remark: `购买代理商套餐「${plan.name}」`,
      },
    })

    // 记录用户省市区信息
    await prisma.user.update({
      where: { id: userId },
      data: {
        provinceCode: body.provinceCode,
        provinceName: body.provinceName,
        cityCode: body.cityCode,
        cityName: body.cityName,
        districtCode: body.districtCode,
        districtName: body.districtName,
      },
    })

    // 获取已配置的支付通道（只返回 alipay 和 wechat）
    const secrets = await prisma.paymentSecret.findMany({
      where: { enabled: true, channel: { in: ['alipay', 'wechat'] } },
    })

    const methods = secrets.map(s => ({
      id: s.id,
      channel: s.channel,
      name: s.channel === 'wechat' ? '微信支付' : '支付宝支付',
      icon: s.channel === 'wechat' ? '💚' : '💳',
      isSecret: true as const,
    }))

    return {
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        amount: plan.price,
        planName: plan.name,
        planLevel: plan.level,
        paymentType: 'select',
        methods,
      },
    }
  })

  // GET /api/agent/dashboard — 代理商看板
  app.get('/api/agent/dashboard', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    if (!userId) return reply.status(401).send({ success: false, error: '请先登录' })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        agentPlanId: true,
        agentLevel: true,
        agentExpiresAt: true,
        agentStatus: true,
        agentCreatedAt: true,
        id: true,
      },
    })
    if (!user || user.agentStatus === 'none') {
      return reply.send({ success: true, data: { agentStatus: 'none' } })
    }

    // 查当前套餐
    let planInfo = null
    if (user.agentPlanId) {
      const plan = await prisma.agentPlan.findUnique({ where: { id: user.agentPlanId } })
      if (plan) planInfo = { name: plan.name, level: plan.level, commissionRate: plan.commissionRate }
    } else if (user.agentLevel) {
      const plan = await prisma.agentPlan.findFirst({ where: { level: user.agentLevel } })
      if (plan) planInfo = { name: plan.name, level: plan.level, commissionRate: plan.commissionRate }
    }

    // 旗下用户数
    const clientCount = await prisma.user.count({
      where: { marketAgentId: userId },
    })
    // 佣金统计（假设用 CommissionOrder 里 agentId=userId 或专门的表）
    const commissionAgg = await prisma.commissionOrder.aggregate({
      _sum: { commissionAmount: true },
      where: { agentId: userId, status: 'pending' },
    })
    const settledAgg = await prisma.commissionOrder.aggregate({
      _sum: { commissionAmount: true },
      where: { agentId: userId, status: 'settled' },
    })
    const totalPending = commissionAgg._sum.commissionAmount || 0
    const totalSettled = settledAgg._sum.commissionAmount || 0

    return {
      success: true,
      data: {
        ...user,
        plan: planInfo,
        stats: {
          clientCount,
          totalCommission: totalPending + totalSettled,
          pendingCommission: totalPending,
          settledCommission: totalSettled,
        },
      },
    }
  })

  // GET /api/agent/commission-orders — 佣金记录
  app.get('/api/agent/commission-orders', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    if (!userId) return reply.status(401).send({ success: false, error: '请先登录' })

    // 用 agentId = userId 的方式（即代理商自己推广的佣金）
    const orders = await prisma.commissionOrder.findMany({
      where: { agentId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return { success: true, data: orders }
  })

  // GET /api/agent/clients — 客户列表
  app.get('/api/agent/clients', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    if (!userId) return reply.status(401).send({ success: false, error: '请先登录' })

    const clients = await prisma.user.findMany({
      where: { marketAgentId: userId },
      select: {
        id: true,
        username: true,
        email: true,
        memberTier: true,
        memberExpiresAt: true,
        coins: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return { success: true, data: clients }
  })

  // POST /api/agent/withdraw — 提现申请
  app.post('/api/agent/withdraw', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    if (!userId) return reply.status(401).send({ success: false, error: '请先登录' })

    const body = request.body as any
    if (!body.amount || body.amount < 1) {
      return reply.status(400).send({ success: false, error: '提现金额无效' })
    }

    // 验证代理商身份
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agentStatus: true },
    })
    if (!user || user.agentStatus === 'none') {
      return reply.status(403).send({ success: false, error: '您还不是代理商' })
    }

    const record = await prisma.agentWithdraw.create({
      data: {
        userId,
        amount: body.amount,
        bankName: body.bankName || '',
        bankAccount: body.bankAccount || '',
        accountName: body.accountName || '',
        status: 'pending',
      },
    })

    return { success: true, data: record }
  })

  // GET /api/agent/withdraw-history — 提现记录
  app.get('/api/agent/withdraw-history', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    if (!userId) return reply.status(401).send({ success: false, error: '请先登录' })

    const records = await prisma.agentWithdraw.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return { success: true, data: records }
  })

  // ================================================
  // 后台提现审核
  // ================================================
  app.get('/api/admin/agent-withdraws', { preHandler: [requireAdmin] }, async () => {
    const records = await prisma.agentWithdraw.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return { success: true, data: records }
  })

  app.patch('/api/admin/agent-withdraws/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const record = await prisma.agentWithdraw.update({
      where: { id },
      data: {
        status: body.status || 'pending',
        remark: body.remark || undefined,
        approvedAt: body.status === 'approved' ? new Date() : undefined,
      },
    })
    return { success: true, data: record }
  })

  // ── 公开：搜索代理商（供注册页选择上级代理） ──
  // GET /api/agent/search?q=xxx — 搜索用户（用于推荐人选择）
  app.get('/api/agent/search', async (request, reply) => {
    const query = request.query as any
    const q = (query.q || '').trim()
    if (!q) return { success: true, data: [] }
    // 匹配邮箱、用户名
    const agents = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q } },
          { username: { contains: q } },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        memberTier: true,
      },
      take: 20,
    })
    return { success: true, data: agents }
  })
}
