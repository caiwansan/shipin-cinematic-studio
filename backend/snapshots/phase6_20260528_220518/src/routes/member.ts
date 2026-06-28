import type { ApiResponse } from '../contracts/api/base.js';
import type { MemberResponse } from '../contracts/api/routes.js';
import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { prisma } from '../utils/index.js'

export default async function memberRoutes(fastify: FastifyInstance) {
  // ============================================
  // 会员主页信息
  // ============================================
  fastify.get('/api/member/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        memberTier: true,
        coins: true,
        createdAt: true,
        membership: {
          select: {
            tier: true,
            credits: true,
            creditsUsed: true,
            storageUsed: true,
            storageLimit: true,
            agentLevel: true,
            parentId: true,
          },
        },
      },
    })

    if (!user) return reply.status(404).send({ error: 'User not found' })
    // BigInt 转 number 避免序列化错误（重建对象而非展开，避免BigInt残留）
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      coins: Number(user.coins),
      memberTier: user.memberTier || 'free',
      createdAt: user.createdAt,
      membership: user.membership ? {
        tier: user.membership.tier,
        credits: user.membership.credits !== null ? Number(user.membership.credits) : null,
        creditsUsed: user.membership.creditsUsed !== null ? Number(user.membership.creditsUsed) : null,
        storageUsed: Number(user.membership.storageUsed),
        storageLimit: Number(user.membership.storageLimit),
        agentLevel: user.membership.agentLevel,
        parentId: user.membership.parentId,
      } : null,
    }
  })

  // ============================================
  // 积分流水
  // ============================================
  fastify.get('/api/member/coin-logs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = '50', offset = '0', type } = request.query as any

    const logs = await prisma.coinLog.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
      skip: Number(offset) || 0,
    })

    const total = await prisma.coinLog.count({ where: { userId, ...(type ? { type } : {}) } })
    return { logs, total }
  })

  // ============================================
  // 积分充值（模拟下单）
  // ============================================
  const RECHARGE_PLANS = [
    { id: 'basic', coins: 100, amount: 10 },
    { id: 'standard', coins: 500, amount: 50 },
    { id: 'premium', coins: 1000, amount: 100 },
    { id: 'flagship', coins: 5000, amount: 500 },
    { id: 'ultra', coins: 10000, amount: 1000 },
  ]

  fastify.get('/api/member/recharge-plans', async (_request, reply) => {
    return RECHARGE_PLANS
  })

  fastify.post('/api/member/recharge', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { planId } = request.body as any

    const plan = RECHARGE_PLANS.find(p => p.id === planId)
    if (!plan) return reply.status(400).send({ error: '无效的充值方案' })

    // 检查代理折扣
    const membership = await prisma.membership.findUnique({ where: { userId, ...(type ? { type } : {}) } })
    let discount = 1
    if (membership?.agentLevel === 'super') discount = 0.75
    else if (membership?.agentLevel === 'senior') discount = 0.80
    else if (membership?.agentLevel === 'mid') discount = 0.85

    const finalAmount = Number((plan.amount * discount).toFixed(2))
    const finalCoins = Math.floor(plan.coins)

    // 创建订单（实际应接入微信/支付宝支付）
    const order = await prisma.rechargeOrder.create({
      data: {
        userId,
        coins: finalCoins,
        amount: finalAmount,
        status: 'paid', // 模拟：直接支付成功
        payMethod: 'mock',
        payTime: new Date(),
      },
    })

    // 加积分 + 记流水
    await prisma.user.update({
      where: { id: userId },
      data: { coins: { increment: finalCoins } },
    })
    await prisma.coinLog.create({
      data: {
        userId,
        amount: finalCoins,
        type: 'recharge',
        remark: `充值 ${finalCoins} 积分 (${planId})`,
        relatedId: order.id,
      },
    })

    // 更新已用积分(用于推荐奖励计算)
    await prisma.membership.update({
      where: { userId, ...(type ? { type } : {}) },
      data: { credits: { increment: finalCoins } },
    })

    return { orderId: order.id, coins: finalCoins, amount: finalAmount, discount }
  })

  // ============================================
  // 作品空间
  // ============================================
  fastify.get('/api/member/assets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = '50', offset = '0', type } = request.query as any

    const assets = await prisma.userAsset.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
      skip: Number(offset) || 0,
    })
    const total = await prisma.userAsset.count({ where: { userId, ...(type ? { type } : {}) } })
    return { assets, total }
  })

  fastify.delete('/api/member/assets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { id } = request.params as any

    const asset = await prisma.userAsset.findUnique({ where: { id } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })
    if (asset.userId !== userId) return reply.status(403).send({ error: '无权删除' })

    // 扣减已用空间
    await prisma.membership.update({
      where: { userId, ...(type ? { type } : {}) },
      data: { storageUsed: { decrement: asset.fileSize || 0 } },
    })

    await prisma.userAsset.delete({ where: { id } })
    return { success: true } satisfies MemberResponse;
  })

  // ============================================
  // 空间扩容（积分兑换）
  // ============================================
  fastify.post('/api/member/upgrade-storage', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { size = '1G' } = request.body as any

    const sizeMap: Record<string, { bytes: bigint; coins: number }> = {
      '1G': { bytes: BigInt(1073741824), coins: 1000 },
      '5G': { bytes: BigInt(5368709120), coins: 4000 },
      '10G': { bytes: BigInt(10737418240), coins: 7000 },
    }

    const plan = sizeMap[size]
    if (!plan) return reply.status(400).send({ error: '无效的扩容方案' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.coins < plan.coins) {
      return reply.status(400).send({ error: '积分不足' })
    }

    // 扣积分 + 记流水
    await prisma.user.update({
      where: { id: userId },
      data: { coins: { decrement: plan.coins } },
    })
    await prisma.coinLog.create({
      data: {
        userId,
        amount: -plan.coins,
        type: 'storage_upgrade',
        remark: `扩容 ${size}`,
      },
    })

    // 增加空间
    await prisma.membership.update({
      where: { userId, ...(type ? { type } : {}) },
      data: { storageLimit: { increment: plan.bytes } },
    })

    // 创建扩容包记录
    const expireAt = new Date()
    expireAt.setFullYear(expireAt.getFullYear() + 1)
    await prisma.storagePack.create({
      data: {
        userId,
        size: plan.bytes,
        coins: plan.coins,
        startAt: new Date(),
        expireAt,
      },
    })

    return { success: true, size, coins: -plan.coins, expireAt: expireAt.toISOString() } satisfies MemberResponse;
  })

  // ============================================
  // 代理系统
  // ============================================
  fastify.get('/api/member/agent-levels', async (_request, reply) => {
    const levels = await prisma.agentLevelConfig.findMany({ orderBy: { priceCoins: 'asc' } })
    return levels
  })

  fastify.post('/api/member/apply-agent', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { level } = request.body as any

    const config = await prisma.agentLevelConfig.findUnique({ where: { level } })
    if (!config) return reply.status(400).send({ error: '无效的代理等级' })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.coins < config.priceCoins) {
      return reply.status(400).send({ error: `积分不足，需要 ${config.priceCoins} 积分` })
    }

    const current = await prisma.membership.findUnique({ where: { userId, ...(type ? { type } : {}) } })
    const levelOrder = ['none', 'mid', 'senior', 'super']
    const currentIdx = levelOrder.indexOf(current?.agentLevel || 'none')
    const targetIdx = levelOrder.indexOf(level)
    if (targetIdx <= currentIdx) {
      return reply.status(400).send({ error: '不能降级或重复申请' })
    }

    // 扣积分
    await prisma.user.update({
      where: { id: userId },
      data: { coins: { decrement: config.priceCoins } },
    })
    await prisma.coinLog.create({
      data: {
        userId,
        amount: -config.priceCoins,
        type: 'agent_upgrade',
        remark: `升级为${config.name}`,
      },
    })

    await prisma.membership.update({
      where: { userId, ...(type ? { type } : {}) },
      data: { agentLevel: level },
    })

    return { success: true, level, agentName: config.name, coins: -config.priceCoins } satisfies MemberResponse;
  })

  // ============================================
  // 积分转账
  // ============================================
  fastify.post('/api/member/transfer', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { targetUsername, amount } = request.body as any

    if (!targetUsername || !amount || amount <= 0) {
      return reply.status(400).send({ error: '参数错误' })
    }

    // 检查自己是否是代理
    const myMembership = await prisma.membership.findUnique({ where: { userId, ...(type ? { type } : {}) } })
    if (!myMembership || myMembership.agentLevel === 'none') {
      return reply.status(403).send({ error: '仅代理可以转账积分' })
    }

    // 检查对方用户
    const target = await prisma.user.findUnique({ where: { username: targetUsername } })
    if (!target) return reply.status(404).send({ error: '目标用户不存在' })
    if (target.id === userId) return reply.status(400).send({ error: '不能转给自己' })

    // 检查余额
    const me = await prisma.user.findUnique({ where: { id: userId } })
    if (!me || me.coins < amount) return reply.status(400).send({ error: '积分不足' })

    // 转账
    await prisma.user.update({ where: { id: userId }, data: { coins: { decrement: amount } } })
    await prisma.user.update({ where: { id: target.id }, data: { coins: { increment: amount } } })

    // 流水
    await prisma.coinLog.create({
      data: { userId, amount: -amount, type: 'transfer_out', remark: `转账给 ${targetUsername}`, relatedId: target.id },
    })
    await prisma.coinLog.create({
      data: { userId: target.id, amount, type: 'transfer_in', remark: `来自 ${me.username}`, relatedId: userId },
    })

    return { success: true, amount: -amount } satisfies MemberResponse;
  })

  // ============================================
  // 图片/视频生成时扣积分（供 image/video 路由调用）
  // ============================================
  const GENERATION_COST = { image: 5, video: 20 }

  // 扣积分中间件
  fastify.decorate('deductCoins', async (userId: string, type: 'image' | 'video') => {
    const cost = GENERATION_COST[type]
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.coins < cost) {
      throw new Error(`积分不足，${type === 'image' ? '图片' : '视频'}生成需要 ${cost} 积分`)
    }
    await prisma.user.update({
      where: { id: userId },
      data: { coins: { decrement: cost } },
    })
    await prisma.coinLog.create({
      data: { userId, amount: -cost, type: 'consume', remark: `生成${type === 'image' ? '图片' : '视频'}` },
    })
    return cost
  })

  // ============================================
  // 推荐系统
  // ============================================
  fastify.get('/api/member/referral-info', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const membership = await prisma.membership.findUnique({
      where: { userId, ...(type ? { type } : {}) },
      select: {
        parentId: true,
        children: { select: { user: { select: { username: true } } } },
      },
    })

    const parent = membership?.parentId
      ? await prisma.user.findUnique({ where: { id: membership.parentId }, select: { username: true } })
      : null

    return {
      referralCode: userId,
      referrer: parent?.username || null,
      referredUsers: membership?.children.length || 0,
      registerUrl: `https://shipin.fushtn.com/register?ref=${userId}`,
    }
  })

  // 注册时设推荐人（在 auth routes 里处理）
  // 推荐奖励：注册时由 auth route 调用


  // ============================================
  // VIP 套餐购买
  // ============================================

  fastify.get("/api/member/plans", async (_request, reply) => {
    const plans = await prisma.memberPlan.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
    })
    return plans
  })

  /** 购买/升级 VIP 套餐
   *  - 有支付宝密钥模式 → 直接生成支付宝付款码，用户扫码付款后异步回调自动开通
   *  - 有收款码模式 → 返回收款码列表，用户付款后手动点击确认直接开通
   *  - 只有微信密钥 → 暂不支持（微信支付需备案域名），提示用户配置收款码
   */
  fastify.post("/api/member/upgrade-vip", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userFromToken = request.user as any
    console.log('[upgrade-vip] request.user:', JSON.stringify(userFromToken))
    const userId = userFromToken.id || userFromToken.userId || userFromToken.sub || userFromToken._id
    const { planLevel } = request.body as any
    if (!planLevel) return reply.status(400).send({ error: "planLevel 不能为空" })

    const plan = await prisma.memberPlan.findUnique({ where: { level: planLevel } })
    if (!plan) return reply.status(404).send({ error: "套餐不存在" })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ error: "用户不存在" })

    // 防止 admin 账号误操作
    if (!userId) return reply.status(400).send({ error: "请使用普通用户账号登录" })

    // 从数据库动态构建等级顺序
    const allPlans = await prisma.memberPlan.findMany({ orderBy: { sortOrder: 'asc' }, select: { level: true } })
    const orderMap: Record<string, number> = { free: 0 }
    allPlans.forEach((p, idx) => { orderMap[p.level] = idx + 1 })
    // 兼容旧版等级名
    orderMap['vip'] = orderMap['Pro'] || 1
    orderMap['vip_season'] = orderMap['Pro'] || 2
    orderMap['vip_year'] = orderMap['director'] || 3
    const current = user.memberTier || "free"
    const currentOrder = orderMap[current] !== undefined ? orderMap[current] : 0  // 未知旧等级当 free（允许升级）
    const targetOrder = orderMap[planLevel] || 0
    // 只有明确的已知等级（>=1）才做降级检查；未知等级（如旧版 vip_year 不在 orderMap 中）允许升级
    if (currentOrder >= 1 && targetOrder <= currentOrder && current !== "free") {
      return reply.status(400).send({ error: "不能降级或重复购买" })
    }

    // 获取可用的支付方式
    const secretMethods = await prisma.paymentSecret.findMany({ where: { enabled: true } })
    const secretAvailable = secretMethods.filter(s => {
      const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
      return Object.values(config).some((v: any) => typeof v === 'string' && v.length > 0)
    })
    const qrConfigs = await prisma.paymentConfig.findMany({
      where: { enabled: true },
      orderBy: { sort: "asc" },
    })
    const qrAvailable = qrConfigs.filter(c => c.qrCodeUrl)

    const hasAlipaySecret = secretAvailable.some(s => s.channel === 'alipay')
    const hasWechatSecret = secretAvailable.some(s => s.channel === 'wechat')
    const hasQrPayments = qrAvailable.length > 0

    if (!hasAlipaySecret && !hasQrPayments) {
      return reply.status(400).send({ error: "暂无可用支付方式，请先在后台配置支付宝密钥或收款码" })
    }

    // 生成订单号
    const orderNo = `VIP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // 如果有支付宝密钥模式 → 使用电脑网站支付（跳转支付宝收银台）
    if (hasAlipaySecret) {
      try {
        const { createAlipayPagePayUrl } = await import('../services/alipay.service.js')
        const notifyUrl = `${request.protocol}://${request.hostname}/api/payment/alipay/notify`
        const returnUrl = `${request.protocol}://${request.hostname}/user/center`

        const { payUrl } = await createAlipayPagePayUrl({
          outTradeNo: orderNo,
          subject: `开通VIP - ${plan.name}`,
          totalAmount: plan.price,
          returnUrl,
          notifyUrl,
        })

        // 创建订单
        const order = await prisma.rechargeOrder.create({
          data: {
            userId,
            planLevel: plan.level,
            coins: 0,
            amount: plan.price,
            status: "pending",
            payMethod: "alipay_secret",
            orderNo,
          },
        })

        return {
          needPay: true,
          orderId: order.id,
          orderNo,
          amount: plan.price,
          planName: plan.name,
          paymentType: 'alipay_page',
          payUrl,
          methods: [{
            id: 'alipay',
            method: 'alipay',
            name: '支付宝支付',
            isSecret: true,
          }],
        }
      } catch (err: any) {
        console.error('[upgrade-vip] 支付宝电脑网站支付下单失败:', err.message)
        // 支付宝调用失败时退回到收款码模式
        if (!hasQrPayments) {
          return reply.status(500).send({ error: `支付宝支付暂时不可用: ${err.message}` })
        }
      }
    }

    // 收款码模式（无支付宝密钥 或 支付宝调用失败时 fallback）
    const order = await prisma.rechargeOrder.create({
      data: {
        userId,
        planLevel: plan.level,
        coins: 0,
        amount: plan.price,
        status: "pending",
        payMethod: "qrcode",
        orderNo,
      },
    })

    const methods = [
      ...secretAvailable.map(s => ({
        id: s.id,
        method: s.channel,
        name: s.channel === 'wechat' ? '微信支付' : '支付宝支付',
        isSecret: true,
        isQrCode: false,
      })),
      ...qrAvailable.map(c => ({
        id: c.id,
        method: c.method,
        name: c.name,
        qrCodeUrl: c.qrCodeUrl,
        account: c.account,
        isSecret: false,
        isQrCode: true,
      })),
    ]

    return {
      needPay: true,
      orderId: order.id,
      orderNo,
      amount: plan.price,
      planName: plan.name,
      paymentType: 'qrcode_manual',
      methods,
    }
  })

  // 用户提交付款凭证（人工审核模式）
  fastify.post("/api/member/submit-payment", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { orderId, accountName } = request.body as any
    if (!orderId) return reply.status(400).send({ error: "orderId 不能为空" })
    if (!accountName) return reply.status(400).send({ error: "请填写您的系统账号名称" })

    const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
    if (!order) return reply.status(404).send({ error: "订单不存在" })
    if (order.userId !== userId) return reply.status(403).send({ error: "无权操作此订单" })
    if (order.status !== "pending") return reply.status(400).send({ error: "订单状态异常" })

    // 标记为待审核，记录用户填写的账号名称
    await prisma.rechargeOrder.update({
      where: { id: orderId },
      data: {
        status: "pending_verify",
        accountName,
        payTime: new Date(),
      },
    })

    return {
      success: true,
      message: "✅ 已提交，请等待管理员审核到账后自动激活VIP",
    }
  })

  // 用户确认已付款，直接开通VIP（收款码模式，无需后台审核）
  fastify.post("/api/member/pay-confirm", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { orderId } = request.body as any
    if (!orderId) return reply.status(400).send({ error: "orderId 不能为空" })

    const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
    if (!order) return reply.status(404).send({ error: "订单不存在" })
    if (order.userId !== userId) return reply.status(403).send({ error: "无权操作此订单" })
    if (order.status !== "pending") return reply.status(400).send({ error: "订单状态异常，请重新下单" })

    const plan = await prisma.memberPlan.findUnique({ where: { level: order.planLevel || '' } })
    if (!plan) return reply.status(404).send({ error: "套餐不存在" })

    // 计算到期时间
    const now = new Date()
    const expiresAt = new Date(now.getTime() + plan.months * 30 * 24 * 60 * 60 * 1000)

    try {
      // 事务：更新订单 + 开通VIP + 更新会员
      await prisma.$transaction([
        prisma.rechargeOrder.update({
          where: { id: orderId },
          data: { status: "paid", payTime: now },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            memberTier: plan.level,
            memberExpiresAt: expiresAt,
            coins: { increment: plan.coins || 0 },
          },
        }),
        prisma.membership.upsert({
          where: { userId },
          update: { tier: plan.level, expiresAt, credits: { increment: plan.coins || 0 } },
          create: { userId, tier: plan.level, expiresAt, credits: plan.coins || 0 },
        }),
      ])
    } catch (err: any) {
      console.error('[pay-confirm] 开通VIP失败:', err.message)
      return reply.status(500).send({ error: '开通失败，请联系管理员' })
    }

    // 积分流水
    if (plan.coins) {
      await prisma.coinLog.create({
        data: {
          userId,
          amount: plan.coins,
          type: 'recharge',
          remark: `用户确认付款，开通VIP套餐「${plan.name}」`,
          relatedId: orderId,
        },
      }).catch(() => {})
    }

    return { success: true, message: `✅ VIP 已开通「${plan.name}」` } satisfies MemberResponse;
  })

  // ---------- 后台：VIP 订单管理 ----------

  // 管理员获取所有 VIP 订单
  fastify.get("/api/admin/vip-orders", async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    // 验证管理员身份
    const token = auth.slice(7)
    try {
      const decoded: any = await request.server.jwt.verify(token)
      const adminId = decoded.id || decoded.userId
      if (!adminId) return reply.status(401).send({ error: 'token 无效' })
      const admin = await prisma.adminUser.findUnique({ where: { id: adminId } })
      if (!admin) return reply.status(403).send({ error: '无权访问' })
    } catch {
      return reply.status(401).send({ error: 'token 无效' })
    }

    const orders = await prisma.rechargeOrder.findMany({
      where: {
        planLevel: { not: null },
        amount: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 批量获取用户信息
    const userIds = [...new Set(orders.map(o => o.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, email: true, memberTier: true },
    })
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    // 获取所有套餐名
    const plans = await prisma.memberPlan.findMany({ select: { level: true, name: true } })
    const planNameMap = Object.fromEntries(plans.map(p => [p.level, p.name]))

    return orders.map(o => ({
      id: o.id,
      userId: o.userId,
      username: userMap[o.userId]?.username || userMap[o.userId]?.email || '未知',
      currentTier: userMap[o.userId]?.memberTier || 'free',
      planLevel: o.planLevel,
      planName: planNameMap[o.planLevel || ''] || o.planLevel,
      amount: o.amount,
      status: o.status,
      accountName: o.accountName,
      payMethod: o.payMethod,
      payTime: o.payTime,
      createdAt: o.createdAt,
    }))
  })

  // 管理员审核通过（激活 VIP）
  fastify.post("/api/admin/vip-orders/:id/approve", async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const token = auth.slice(7)
    try {
      const decoded: any = await request.server.jwt.verify(token)
      const adminId = decoded.id || decoded.userId
      if (!adminId) return reply.status(401).send({ error: 'token 无效' })
      const admin = await prisma.adminUser.findUnique({ where: { id: adminId } })
      if (!admin) return reply.status(403).send({ error: '无权访问' })
    } catch {
      return reply.status(401).send({ error: 'token 无效' })
    }

    const { id } = request.params as any
    const order = await prisma.rechargeOrder.findUnique({ where: { id } })
    if (!order) return reply.status(404).send({ error: '订单不存在' })
    if (order.status !== 'pending_verify') return reply.status(400).send({ error: '订单状态异常，仅待审核订单可通过' })

    const plan = await prisma.memberPlan.findUnique({ where: { level: order.planLevel || '' } })
    if (!plan) return reply.status(404).send({ error: '套餐不存在' })

    // 计算到期时间
    const now = new Date()
    const expiresAt = new Date(now.getTime() + plan.months * 30 * 24 * 60 * 60 * 1000)

    // 更新用户 VIP 等级
    await prisma.user.update({
      where: { id: order.userId },
      data: {
        memberTier: plan.level,
        memberExpiresAt: expiresAt,
        coins: { increment: plan.coins || 0 },
      },
    })

    // 同步 membership 表
    await prisma.membership.upsert({
      where: { userId: order.userId },
      update: { tier: plan.level, credits: { increment: plan.coins || 0 } },
      create: { userId: order.userId, tier: plan.level, credits: plan.coins || 0 },
    })

    // 积分流水
    if (plan.coins) {
      await prisma.coinLog.create({
        data: {
          userId: order.userId,
          amount: plan.coins,
          type: 'recharge',
          remark: `管理员审核通过VIP套餐「${plan.name}」`,
          relatedId: order.id,
        },
      })
    }

    // 更新订单
    await prisma.rechargeOrder.update({
      where: { id },
      data: { status: 'paid', payTime: new Date() },
    })

    return { success: true, message: `✅ 已激活「${plan.name}」，用户 ${order.accountName || order.userId} 升级成功` } satisfies MemberResponse;
  })

  // 管理员拒绝
  fastify.post("/api/admin/vip-orders/:id/reject", async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const token = auth.slice(7)
    try {
      const decoded: any = await request.server.jwt.verify(token)
      const adminId = decoded.id || decoded.userId
      if (!adminId) return reply.status(401).send({ error: 'token 无效' })
      const admin = await prisma.adminUser.findUnique({ where: { id: adminId } })
      if (!admin) return reply.status(403).send({ error: '无权访问' })
    } catch {
      return reply.status(401).send({ error: 'token 无效' })
    }

    const { id } = request.params as any
    await prisma.rechargeOrder.update({
      where: { id },
      data: { status: 'failed' },
    })
    return { success: true, message: '已拒绝该订单' } satisfies MemberResponse;
  })

  // ============================================
  // 会员方案管理（后台 CRUD）
  // ============================================

  // 查询所有
  fastify.get('/api/admin/member-plans', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const plans = await prisma.memberPlan.findMany({ orderBy: { sortOrder: 'asc' } })
    return plans
  })

  // 新增
  fastify.post('/api/admin/member-plans', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const body = request.body as any
    if (!body.level || !body.name) return reply.status(400).send({ error: 'level 和 name 不能为空' })
    const existing = await prisma.memberPlan.findUnique({ where: { level: body.level } })
    if (existing) return reply.status(400).send({ error: '该方案标识已存在' })
    const plan = await prisma.memberPlan.create({
      data: {
        level: body.level, name: body.name, price: Number(body.price) || 0, months: Number(body.months) || 1,
        dailyQuota: Number(body.dailyQuota) || 5, maxResolution: body.maxResolution || '1080p',
        maxDuration: Number(body.maxDuration) || 30, concurrentTasks: Number(body.concurrentTasks) || 1,
        watermark: !!body.watermark, apiAccess: !!body.apiAccess, sortOrder: Number(body.sortOrder) || 0,
        enabled: body.enabled !== false,
        onlineApiEnabled: body.onlineApiEnabled === true,
        localModelEnabled: body.localModelEnabled === true,
      },
    })
    return plan
  })

  // 更新
  fastify.put('/api/admin/member-plans/:id', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const { id } = request.params as any
    const body = request.body as any
    const plan = await prisma.memberPlan.update({
      where: { id }, data: {
        name: body.name, price: Number(body.price) || 0, months: Number(body.months) || 1,
        dailyQuota: Number(body.dailyQuota) ?? 5, maxResolution: body.maxResolution || '1080p',
        maxDuration: Number(body.maxDuration) || 30, concurrentTasks: Number(body.concurrentTasks) ?? 1,
        watermark: !!body.watermark, apiAccess: !!body.apiAccess, sortOrder: Number(body.sortOrder) || 0,
        onlineApiEnabled: body.onlineApiEnabled === true,
        localModelEnabled: body.localModelEnabled === true,
      },
    })
    return plan
  })

  // 删除
  fastify.delete('/api/admin/member-plans/:id', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const { id } = request.params as any
    await prisma.memberPlan.delete({ where: { id } })
    return { success: true } satisfies MemberResponse;
  })

  // 启用/禁用
  fastify.post('/api/admin/member-plans/:id/toggle', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const { id } = request.params as any
    const plan = await prisma.memberPlan.findUnique({ where: { id } })
    if (!plan) return reply.status(404).send({ error: '方案不存在' })
    const updated = await prisma.memberPlan.update({ where: { id }, data: { enabled: !plan.enabled } })
    return updated
  })
  // ════════════════════════════════════════════════
  // 管理员会员管理系统 API（完整 CRUD）
  // ════════════════════════════════════════════════

  // ─── 会员列表 ───
  fastify.get('/api/admin/members', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { membership: true },
  })
  // BigInt 序列化修复 + 计算在线状态
  const now = new Date()
  const serialized = JSON.parse(JSON.stringify(users, (k, v) => typeof v === 'bigint' ? Number(v) : v))
  const result = serialized.map((u: any) => {
    const lastActive = u.lastActiveAt ? new Date(u.lastActiveAt) : null
    const diffMin = lastActive ? (now.getTime() - lastActive.getTime()) / 60000 : Infinity
    return {
      ...u,
      status: diffMin < 5 ? 'online' : 'offline', // 5分钟内活跃算在线
    }
  })
  return { success: true, data: result } satisfies MemberResponse;
})

// ─── 新增会员 ───
fastify.post('/api/admin/members', async (request: any, reply: any) => {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
  const { email, username, password, tier, coins } = request.body as any
  if (!email || !password) return reply.status(400).send({ error: '邮箱和密码不能为空' })
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return reply.status(400).send({ error: '该邮箱已注册' })
  const bcrypt = await import('bcryptjs')
  const passwordHash = await bcrypt.hash(password, 10)
  const finalUsername = username?.trim() || email.split('@')[0]
  const user = await prisma.user.create({
    data: {
      email,
      username: finalUsername,
      passwordHash,
      coins: Number(coins) || 0,
      memberTier: tier || 'free',
      membership: { create: { tier: tier || 'free', credits: Number(coins) || 0 } },
    },
    include: { membership: true },
  })
  return { success: true, data: user } satisfies MemberResponse;
})

// ─── 修改会员信息 ───
fastify.put('/api/admin/members/:id', async (request: any, reply: any) => {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
  const { id } = request.params as any
  const { username, email, password, tier, coins, memberExpiresAt } = request.body as any
  const updateData: any = {}
  if (username !== undefined) updateData.username = username
  if (email !== undefined) updateData.email = email
  if (tier !== undefined) {
    updateData.memberTier = tier
    // 从 MemberPlan 查找对应 storageLimit
    const plan = await prisma.memberPlan.findFirst({ where: { level: tier } })
    const storageLimitBytes = plan?.storageLimit
      ? BigInt(plan.storageLimit * 1024 * 1024)
      : BigInt(524288000) // 默认 500MB
    // 同步 membership
    await prisma.membership.upsert({
      where: { userId: id },
      update: { tier, storageLimit: storageLimitBytes },
      create: { userId: id, tier, storageLimit: storageLimitBytes },
    })
  }
  if (password) {
    const bcrypt = await import('bcryptjs')
    updateData.passwordHash = await bcrypt.hash(password, 10)
  }
  if (coins !== undefined) {
    const current = await prisma.user.findUnique({ where: { id }, select: { coins: true } })
    const diff = Number(coins) - (current?.coins || 0)
    updateData.coins = Number(coins)
    // 同步 membership credits
    await prisma.membership.upsert({
      where: { userId: id },
      update: { credits: { increment: diff } },
      create: { userId: id, tier: 'free', credits: Math.max(0, Number(coins)) },
    })
    // 记录积分流水
    if (diff !== 0) {
      await prisma.coinLog.create({
        data: { userId: id, amount: diff, type: 'admin', remark: `管理员调整积分: ${diff > 0 ? '+' : ''}${diff}` },
      })
    }
  }
  if (memberExpiresAt !== undefined) {
    updateData.memberExpiresAt = memberExpiresAt ? new Date(memberExpiresAt) : null
  }
  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { membership: true },
  })
  // BigInt 序列化修复
  const serialized = JSON.parse(JSON.stringify(user, (k, v) => typeof v === 'bigint' ? Number(v) : v))
  return { success: true, data: serialized } satisfies MemberResponse;
})

// ─── 删除会员 ───
fastify.delete('/api/admin/members/:id', async (request: any, reply: any) => {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
  const { id } = request.params as any
  await prisma.user.delete({ where: { id } })
  return { success: true } satisfies MemberResponse;
})

// 支付宝订单状态查询（前端轮询用）
fastify.get("/api/payment/alipay/status/:orderId", { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const userFromToken = request.user as any
  const userId = userFromToken.id || userFromToken.userId || userFromToken.sub || userFromToken._id
  const { orderId } = request.params as any

  if (!orderId) return reply.status(400).send({ error: "orderId 不能为空" })

  const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
  if (!order) return reply.status(404).send({ error: "订单不存在" })
  if (order.userId !== userId) return reply.status(403).send({ error: "无权访问" })

  return {
    status: order.status,
    planLevel: order.planLevel,
    payTime: order.payTime,
  }
})

// 🚫 已迁移到 payment/controllers/index.ts（避免 FST_ERR_DUPLICATED_ROUTE）

}

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};
