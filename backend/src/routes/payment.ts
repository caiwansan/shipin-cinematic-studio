import type { ApiResponse } from '../contracts/api/base.js';
import { CareerAgentService } from '../services/enterprise/workflow/career-agent.service.js';

/**
 * 遮盖密钥中间部分，仅用于 UI 显示，不用于实际解密/签名。
 * 真实密钥应只来源于环境变量（如 ALIPAY_APP_PRIVATE_KEY），不要硬编码在代码中。
 * @param key 原始密钥字符串
 * @returns 遮盖后的字符串（首8位 + ******** + 末4位），短密钥原样返回
 */
function maskSecretKey(key: string): string {
  if (!key || key.length <= 12) return key || ''
  return key.slice(0, 8) + '********' + key.slice(-4)
}

/**
 * 递归遍历对象，遮盖所有类密钥字段的值（如 privateKey, publicKey, apiKey 等）。
 * 仅作用于浅层/深层对象的匹配字段，不改动非密钥字段。
 */
function maskSecretFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(maskSecretFields)

  const SENSITIVE_KEYS = ['privateKey', 'publicKey', 'apiKey', 'apiV3Key', 'keyPem', 'secretKey', 'appSecret', 'mchSecret']
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(k) && typeof v === 'string') {
      result[k] = maskSecretKey(v)
    } else if (typeof v === 'object' && v !== null) {
      result[k] = maskSecretFields(v)
    } else {
      result[k] = v
    }
  }
  return result
}

// ─── Payment Routes ───
// 支付系统：管理员配置收款码 + 支付密钥管理 + 用户充值 + 订单管理
// 收款码模式（微信/支付宝收款码），管理员手动确认到账

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { prisma } from '../utils/index.js'
import { verifyToken } from './admin-auth.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';

function generateOrderNo(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `CZ${date}${rand}`
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  // ============================================================
  // 管理员 - 支付密钥配置
  // ============================================================

  // GET /api/admin/payment/secret/:channel — 获取密钥配置
  fastify.get('/api/admin/payment/secret/:channel', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { channel } = request.params as any
    if (!['wechat', 'alipay'].includes(channel)) return reply.status(400).send({ error: '无效的渠道' })

    const record = await prisma.paymentSecret.findUnique({ where: { channel } })
    if (!record) return toApiResponse({channel, enabled: false, config: null}) satisfies ApiResponse<unknown>;
    // 注意：密钥应只从环境变量读取（如 ALIPAY_APP_PRIVATE_KEY），不要硬编码到数据库中明文储存；
    // 返回给前端时对密钥字段做遮盖处理（首8位+********+末4位），仅用于前端管理界面展示，不影响实际签名逻辑。
    const rawConfig = JSON.parse(record.config) as Record<string, any>
    return toApiResponse({channel: record.channel,
      enabled: record.enabled,
      config: maskSecretFields(rawConfig),
      remark: record.remark,}) satisfies ApiResponse<unknown>;
  })

  // PUT /api/admin/payment/secret/:channel — 更新密钥配置
  fastify.put('/api/admin/payment/secret/:channel', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { channel } = request.params as any
    if (!['wechat', 'alipay'].includes(channel)) return reply.status(400).send({ error: '无效的渠道' })

    const { config, enabled, remark } = request.body as any

    const record = await prisma.paymentSecret.upsert({
      where: { channel },
      create: {
        channel,
        config: JSON.stringify(config || {}),
        enabled: enabled !== undefined ? enabled : true,
        remark,
      },
      update: {
        config: JSON.stringify(config || {}),
        ...(enabled !== undefined && { enabled }),
        ...(remark !== undefined && { remark }),
      },
    })

    return toApiResponse({success: true, channel}) satisfies ApiResponse<unknown>;
  })
  // ============================================================
  // 管理员 - 支付配置管理
  // ============================================================

  // GET /api/admin/payment/config — 获取支付配置列表
  // GET /api/admin/payment/config — 获取支付密钥配置（兼容前端 { wechat:{...}, alipay:{...} } 格式）
  fastify.get('/api/admin/payment/config',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
    const secrets = await prisma.paymentSecret.findMany()
    const result: Record<string, any> = {}
    for (const s of secrets) {
      const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
      // ⚠️ 密钥字段在返回时做遮盖处理（首8位+********+末4位），防止泄露
      result[s.channel] = { configured: true, ...maskSecretFields(config) }
    }
    // 保证 wechat / alipay 键一定存在（默认空值不会泄露密钥）
    if (!result.wechat) result.wechat = { configured: false, appId: '', mchId: '', apiKey: '', apiV3Key: '', keyPem: '', serialNo: '' }
    if (!result.alipay) result.alipay = { configured: false, appId: '', privateKey: '', publicKey: '' }
    return result
  })

  // POST /api/admin/payment/config — 保存/更新支付密钥配置（前端调用）
  fastify.post('/api/admin/payment/config',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
    const body = request.body as any
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: '请求体不能为空' })
    }
    for (const channel of ['wechat', 'alipay']) {
      if (body[channel]) {
        const config = body[channel]
        // 跳过所有字段都是空字符串的配置
        const values = Object.values(config).filter(v => typeof v === 'string' && v.length > 0)
        if (values.length === 0) continue

        // 🛡️ 安全保护：如果某个字段包含 '****' 掩码，说明前端传回了遮盖后的值，
        // 此时保留数据库中该字段的原始值而非覆盖
        const existing = await prisma.paymentSecret.findUnique({ where: { channel } })
        const { configured, ...cleanConfig } = config as Record<string, any>
        if (existing) {
          const existingConfig = JSON.parse(existing.config) as Record<string, any>
          for (const key of Object.keys(cleanConfig)) {
            const val = cleanConfig[key]
            if (typeof val === 'string' && val.includes('****') && existingConfig[key]) {
              cleanConfig[key] = existingConfig[key]
            }
          }
        }

        if (existing) {
          await prisma.paymentSecret.update({
            where: { channel },
            data: { config: JSON.stringify(cleanConfig), enabled: true },
          })
        } else {
          await prisma.paymentSecret.create({
            data: { channel, config: JSON.stringify(cleanConfig), enabled: true },
          })
        }
      }
    }
    // 返回更新后的配置（密钥字段遮盖处理）
    const secrets = await prisma.paymentSecret.findMany()
    const result: Record<string, any> = {}
    for (const s of secrets) {
      const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
      // ⚠️ 密钥字段在返回时做遮盖处理（首8位+********+末4位），防止泄露
      result[s.channel] = { configured: true, ...maskSecretFields(config) }
    }
    if (!result.wechat) result.wechat = { configured: false, appId: '', mchId: '', apiKey: '', apiV3Key: '', keyPem: '', serialNo: '' }
    if (!result.alipay) result.alipay = { configured: false, appId: '', privateKey: '', publicKey: '' }
    return toApiResponse({success: true, data: result}) satisfies ApiResponse<unknown>;
  })

  // POST /api/admin/payment/qr — 新增收款码支付配置（旧版兼容）
  fastify.post('/api/admin/payment/qr',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
    const { method, name, qrCodeUrl, account } = request.body as any
    if (!method || !name) {
      return reply.status(400).send({ error: '缺少必填字段' })
    }

    const exists = await prisma.paymentConfig.findUnique({ where: { method } })
    if (exists) {
      return reply.status(400).send({ error: '该支付方式已存在' })
    }

    const config = await prisma.paymentConfig.create({
      data: { method, name, qrCodeUrl, account },
    })
    return config
  })

  // ============================================================
  // 公开 - 获取支付配置
  // ============================================================

  // GET /api/payment/methods — 获取可用支付方式（从 PaymentSecret 和 PaymentConfig 表合并）
  fastify.get('/api/payment/methods', async (_request, reply) => {
    // 从 PaymentSecret 密钥配置获取启用的支付方式
    const secrets = await prisma.paymentSecret.findMany({
      where: { enabled: true },
    })
    const secretMethods = secrets.map(s => {
      const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
      const hasSecret = Object.values(config).some((v: any) => typeof v === 'string' && v.length > 0)
      return toApiResponse({id: s.id,
        method: s.channel,
        name: s.channel === 'wechat' ? '微信支付' : '支付宝支付',
        isSecret: true,
        hasSecret,}) satisfies ApiResponse<unknown>;
    }).filter(s => s.hasSecret)

    // 从 PaymentConfig 收款码配置获取启用的方式
    const qrConfigs = await prisma.paymentConfig.findMany({
      where: { enabled: true },
      orderBy: { sort: 'asc' },
      select: { id: true, method: true, name: true, qrCodeUrl: true, account: true },
    })
    const qrMethods = qrConfigs.map(c => ({
      id: c.id,
      method: c.method,
      name: c.name,
      isSecret: false,
      qrCodeUrl: c.qrCodeUrl,
      account: c.account,
    }))

    // 合并去重（优先密钥模式）
    const methodMap = new Map<string, any>()
    secretMethods.forEach(m => methodMap.set(m.method, m))
    qrMethods.forEach(m => {
      if (!methodMap.has(m.method)) methodMap.set(m.method, m)
    })

    return Array.from(methodMap.values())
  })

  // ============================================================
  // 用户 - 充值订单
  // ============================================================

  // POST /api/payment/recharge — 创建充值订单（展示收款码）
  fastify.post('/api/payment/recharge', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { amount, method } = request.body as any

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: '请输入有效的充值金额' })
    }
    if (!['wechat', 'alipay'].includes(method)) {
      return reply.status(400).send({ error: '不支持的支付方式' })
    }

    // 检查支付方式是否启用（兼容 PaymentSecret 密钥模式和 PaymentConfig 收款码模式）
    const secretConfig = await prisma.paymentSecret.findUnique({ where: { channel: method } })
    const qrConfig = await prisma.paymentConfig.findUnique({ where: { method } })

    const isSecretEnabled = secretConfig?.enabled && (() => {
      const config = (typeof secretConfig.config === 'string' ? JSON.parse(secretConfig.config) : secretConfig.config) || {}
      return Object.values(config).some((v: any) => typeof v === 'string' && v.length > 0)
    })()

    if (!isSecretEnabled && (!qrConfig || !qrConfig.enabled)) {
      return reply.status(400).send({ error: '该支付方式未启用' })
    }

    // 汇率：1元 = 100积分
    const coins = Math.floor(amount * 100)

    // 创建订单
    const order = await prisma.paymentOrder.create({
      data: {
        userId,
        orderNo: generateOrderNo(),
        amount,
        coins,
        method,
        status: 'pending',
        remark: `用户充值 ¥${amount}，获得 ${coins} 积分`,
      },
    })

    return toApiResponse({orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      coins: order.coins,
      method: order.method,
      status: order.status,
      qrCodeUrl: config.qrCodeUrl || null,
      account: config.account || null,
      payeeName: config.name,}) satisfies ApiResponse<unknown>;
  })

  // ============================================================
  // 用户 - 镜心职业助理购买
  // ============================================================

  // POST /api/payment/career/checkout — 创建镜心订阅订单（含支付链接/二维码）
  fastify.post('/api/payment/career/checkout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { method } = request.body as any

    const validMethod = method === 'wechat' ? 'wechat' : 'alipay'

    // 检查是否已有活跃订阅
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: 'career_agent' } })
    if (!plan) {
      return reply.status(500).send({ error: '镜心职业助理套餐未配置' })
    }

    const existingSub = await prisma.subscription.findFirst({
      where: { tenantId: userId, planId: plan.id, status: 'active' },
    })
    if (existingSub) {
      return reply.status(400).send({ error: '您已拥有活跃的镜心订阅' })
    }

    // 创建支付订单
    const amount = plan.price || 9.9
    const orderNo = generateOrderNo()
    const order = await prisma.paymentOrder.create({
      data: {
        userId,
        orderNo,
        type: 'subscription',
        amount,
        coins: Math.floor(amount * 100),
        method: validMethod,
        status: 'pending',
        planType: 'career_agent',
        remark: `镜心职业助理 ¥${amount}/月`,
      },
    })

    // Sprint-09C-1.6 Task 01: 调用支付宝/微信支付生成支付链接
    let paymentUrl: string | null = null
    let qrCode: string | null = null
    let expiresAt: string | null = null

    if (validMethod === 'alipay') {
      try {
        const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'alipay' } })
        if (secret && secret.enabled) {
          const config = typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config
          if (config.appId && config.privateKey) {
            // 确保私钥为 PEM 格式（Node crypto.createSign 需要 PEM 头）
            let privateKey = config.privateKey
            if (privateKey && !privateKey.includes('-----BEGIN')) {
              privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`
            }
            const { AlipayProvider } = await import('../payment/providers/alipay/index.js')
            const provider = new AlipayProvider({
              appId: config.appId,
              privateKey,
              alipayPublicKey: config.publicKey || config.alipayPublicKey || '',
              gateway: 'https://openapi.alipay.com/gateway.do',
              notifyUrl: 'https://aigc.fushtn.com/api/payment/alipay/notify',
              returnUrl: 'https://aigc.fushtn.com/workspace/job',
            })
            const result = await provider.createOrder({
              outTradeNo: orderNo,
              description: '镜心职业助理 ¥9.9/月',
              amount,
              notifyUrl: 'https://aigc.fushtn.com/api/payment/alipay/notify',
              returnUrl: 'https://aigc.fushtn.com/workspace/job',
            })
            paymentUrl = result.payUrl || null
            qrCode = result.qrCode || null
          }
        }
      } catch (err: any) {
        console.error('[career/checkout] 支付宝支付链接生成失败:', err.message)
        // 不阻断 — 降级返回普通订单
      }
    } else if (validMethod === 'wechat') {
      try {
        const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'wechat' } })
        if (secret && secret.enabled) {
          const config = typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config
          if (config.appId && config.mchId && config.apiV3Key && config.keyPem) {
            const { createWxpayNativeQrCode } = await import('../services/wxpay.service.js')
            const result = await createWxpayNativeQrCode({
              outTradeNo: orderNo,
              description: '镜心职业助理 ¥9.9/月',
              totalAmount: amount,
              notifyUrl: 'https://aigc.fushtn.com/api/payment/wxpay/notify',
            })
            qrCode = result.codeUrl || null
          }
        }
      } catch (err: any) {
        console.error('[career/checkout] 微信支付链接生成失败:', err.message)
        // 不阻断 — 降级返回普通订单
      }
    }

    return toApiResponse({
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      status: order.status,
      planType: order.planType,
      method: validMethod,
      paymentUrl,
      qrCode,
      expiresAt,
    }) satisfies ApiResponse<unknown>;
  })

  // POST /api/admin/payment/confirm — 管理员确认到账
  fastify.post('/api/admin/payment/confirm',  async (request, reply) => {
    const auth = request.headers.authorization
    const decoded = auth ? verifyToken(auth.slice(7)) : null
    const { orderId } = request.body as any
    if (!orderId) return reply.status(400).send({ error: '缺少订单ID' })

    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order) return reply.status(404).send({ error: '订单不存在' })
    if (order.status !== 'pending') return reply.status(400).send({ error: '订单状态不允许确认' })

    // 获取管理员
    let adminId: number | null = null
    if (decoded?.username) {
      const adminUser = await prisma.adminUser.findUnique({ where: { username: decoded.username } })
      adminId = adminUser?.id ?? null
    }

    // 确认到账
    const now = new Date()
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'paid', payTime: now, confirmAdminId: adminId, confirmTime: now },
    })

    // 加积分 — 确保 membership 记录存在
    await prisma.membership.upsert({
      where: { userId: order.userId },
      create: { userId: order.userId, credits: order.coins },
      update: { credits: { increment: order.coins } },
    }).catch(() => {})

    // 记流水
    await prisma.coinLog.create({
      data: {
        userId: order.userId,
        amount: order.coins,
        type: 'recharge',
        remark: `充值 ${order.coins} 积分 (¥${order.amount}，${order.method === 'wechat' ? '微信' : '支付宝'})`,
        relatedId: order.id,
      },
    }).catch(() => {})

    // ⭐ 如果是会员购买订单（planType=member），同时更新 memberTier
    if (order.planType === 'member') {
      try {
        const rechargeOrder = await prisma.rechargeOrder.findFirst({
          where: { paymentOrderId: order.id }
        })
        if (rechargeOrder?.planLevel) {
          const plan = await prisma.memberPlan.findUnique({ where: { level: rechargeOrder.planLevel } })
          if (plan) {
            const expiresAt = new Date(Date.now() + plan.months * 24 * 60 * 60 * 1000)
            await prisma.user.update({
              where: { id: order.userId },
              data: { memberTier: plan.level, memberExpiresAt: expiresAt },
            })
            await prisma.membership.upsert({
              where: { userId: order.userId },
              update: { tier: plan.level, expiresAt, credits: { increment: plan.coins || 0 } },
              create: { userId: order.userId, tier: plan.level, expiresAt, credits: plan.coins || 0 },
            })
            console.log(`[Payment/Confirm] 会员已升级: user=${order.userId}, tier=${plan.level}`)
          }
        }
      } catch (e: any) {
        console.warn('[Payment/Confirm] 同步会员升级失败:', e.message)
      }
    }

    // Sprint-09B-3A Task 03-B: 管理员确认镜心职业助理到账
    if (order.planType === 'career_agent') {
      await handleCareerSubscriptionFromPayment(order, '', now)
    }

    return toApiResponse({success: true, orderNo: order.orderNo, coins: order.coins}) satisfies ApiResponse<unknown>;
  })

  // POST /api/admin/member/confirm — 管理员确认 VIP 升级订单
  fastify.post('/api/admin/member/confirm', async (request, reply) => {
    const auth = request.headers.authorization
    const decoded = auth ? verifyToken(auth.slice(7)) : null
    const { orderId } = request.body as any
    if (!orderId) return reply.status(400).send({ error: '缺少订单ID' })

    const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
    if (!order) return reply.status(404).send({ error: '订单不存在' })
    if (order.status !== 'confirmed') return reply.status(400).send({ error: '订单状态不允许确认，需要用户先确认已付款' })

    // 获取管理员
    let adminId: number | null = null
    if (decoded?.username) {
      const adminUser = await prisma.adminUser.findUnique({ where: { username: decoded.username } })
      adminId = adminUser?.id ?? null
    }

    // 确认到账 → 标记已支付 + 激活VIP
    const now = new Date()
    await prisma.rechargeOrder.update({
      where: { id: orderId },
      data: { status: 'paid', payTime: now },
    })

    // 从订单金额找对应会员套餐，激活VIP
    const plan = await prisma.memberPlan.findFirst({
      where: { price: order.amount, enabled: true },
      orderBy: { sortOrder: 'desc' },
    })

    if (plan) {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + (plan.months || 1))
      await prisma.user.update({
        where: { id: order.userId },
        data: { memberTier: plan.level, memberExpiresAt: expiresAt },
      })
      // 更新 membership 表（含 storageLimit 自动同步）
      const storageLimitBytes = BigInt((plan.storageLimit || 500) * 1024 * 1024)
      await prisma.membership.update({
        where: { userId: order.userId },
        data: { tier: plan.level, expiresAt, storageLimit: storageLimitBytes },
      })
    }

    // 记流水
    await prisma.coinLog.create({
      data: {
        userId: order.userId,
        amount: 0,
        type: 'reward',
        remark: `管理员确认到账，激活VIP (¥${order.amount})`,
        relatedId: order.id,
      },
    })

    return toApiResponse({success: true, orderId: order.id, plan: plan?.name || null, planLevel: plan?.level || null}) satisfies ApiResponse<unknown>;
  })

  // POST /api/admin/payment/reject — 管理员驳回
  fastify.post('/api/admin/payment/reject',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
    const { orderId, reason } = request.body as any
    if (!orderId) return reply.status(400).send({ error: '缺少订单ID' })

    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order) return reply.status(404).send({ error: '订单不存在' })
    if (order.status !== 'pending') return reply.status(400).send({ error: '订单状态不允许驳回' })

    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'expired', remark: reason || '管理员驳回' },
    })

    return toApiResponse({success: true}) satisfies ApiResponse<unknown>;
  })

  // ============================================================
  // 管理员 - 订单列表
  // ============================================================

  // GET /api/admin/payment/orders — 获取充值订单列表
  fastify.get('/api/admin/payment/orders',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
    const { status, page = '1', limit = '20' } = request.query as any

    const where: any = {}
    if (status && status !== 'all') where.status = status

    const pageNum = Math.max(1, Number(page) || 1)
    const take = Math.min(Math.max(1, Number(limit) || 20), 100)

    const [paymentOrders, paymentTotal] = await Promise.all([
      prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip: (pageNum - 1) * take,
      }),
      prisma.paymentOrder.count({ where }),
    ])

    // 也查 rechargeOrder（VIP购买订单）
    const rechargeWhere = { ...(status && status !== 'all' ? { status } : {}) }
    const [rechargeOrders, rechargeTotal] = await Promise.all([
      prisma.rechargeOrder.findMany({
        where: rechargeWhere,
        orderBy: { createdAt: 'desc' },
        take,
        skip: (pageNum - 1) * take,
      }),
      prisma.rechargeOrder.count({ where: rechargeWhere }),
    ])

    // 合并两个表的订单
    const withUserPayment = await Promise.all(paymentOrders.map(async (o) => {
      const user = await prisma.user.findUnique({ where: { id: o.userId }, select: { id: true, username: true, email: true } })
      return toApiResponse({...o, user, _orderType: 'payment'}) satisfies ApiResponse<unknown>;
    }))

    const withUserRecharge = await Promise.all(rechargeOrders.map(async (o) => {
      const user = await prisma.user.findUnique({ where: { id: o.userId }, select: { id: true, username: true, email: true } })
      return toApiResponse({...o, user, _orderType: 'recharge', orderNo: o.id}) satisfies ApiResponse<unknown>;
    }))

    // 合并并按时间排序
    const allOrders = [...withUserPayment, ...withUserRecharge]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, take)

    return toApiResponse({orders: allOrders, total: paymentTotal + rechargeTotal, page: pageNum, totalPages: Math.ceil((paymentTotal + rechargeTotal) / take)}) satisfies ApiResponse<unknown>;
  })

  // ============================================================
  // 用户 - 我的充值记录
  // ============================================================

  // GET /api/user/payment/orders — 用户充值记录
  fastify.get('/api/user/payment/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { page = '1', limit = '20' } = request.query as any

    const pageNum = Math.max(1, Number(page) || 1)
    const take = Math.min(Math.max(1, Number(limit) || 20), 50)

    const [orders, total] = await Promise.all([
      prisma.paymentOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        skip: (pageNum - 1) * take,
      }),
      prisma.paymentOrder.count({ where: { userId } }),
    ])

    return toApiResponse({orders, total, page: pageNum, totalPages: Math.ceil(total / take)}) satisfies ApiResponse<unknown>;
  })

  // ============================================================
  // 管理员 - 上传二维码图片
  // ============================================================
  fastify.post('/api/admin/payment/upload-qr', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    try {
      const data = await request.file()
      if (!data) return reply.status(400).send({ error: '未上传文件' })

      const buffer = await data.toBuffer()
      const ext = data.filename?.split('.').pop()?.toLowerCase() || 'png'
      const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp']
      if (!allowedExts.includes(ext)) {
        return reply.status(400).send({ error: `不支持的文件格式: .${ext}` })
      }

      const { randomUUID } = await import('crypto')
      const { writeFile, mkdir } = await import('fs/promises')
      const { resolve } = await import('path')

      const UPLOAD_DIR = '/root/shipin-cinematic-studio/backend/public/uploads'
      const filename = `${randomUUID()}.${ext}`
      const filepath = resolve(UPLOAD_DIR, filename)
      await mkdir(UPLOAD_DIR, { recursive: true })
      await writeFile(filepath, buffer)

      const publicUrl = `/api/v1/uploads/${filename}`

      return toApiResponse({url: publicUrl}) satisfies ApiResponse<unknown>;
    } catch (error: any) {
      return reply.status(500).send({ error: `上传失败: ${error.message}` })
    }
  })

  // ============================================================
  // 管理员 - 缓存清理
  // ============================================================
  fastify.post('/api/admin/cache/clear', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { targets } = request.body as { targets: string[] }
    if (!Array.isArray(targets) || !targets.length) {
      return reply.status(400).send({ error: '请指定清理目标' })
    }

    const results: Record<string, { success: boolean; message: string }> = {}

    for (const target of targets) {
      try {
        switch (target) {
          case 'upload_files': {
            const { readdir, unlink, rmdir } = await import('fs/promises')
            const { resolve } = await import('path')
            const dir = '/root/shipin-cinematic-studio/backend/public/uploads'
            const files = await readdir(dir)
            let count = 0
            for (const f of files) {
              if (f === '.gitkeep') continue
              await unlink(resolve(dir, f))
              count++
            }
            results[target] = { success: true, message: `已清理 ${count} 个上传文件` }
            break
          }
          case 'license_cache': {
            await prisma.licenseCache.deleteMany()
            results[target] = { success: true, message: 'License 缓存已清空' }
            break
          }
          case 'temp_logs': {
            const { readdir, unlink } = await import('fs/promises')
            const { resolve } = await import('path')
            const dir = '/tmp'
            const files = await readdir(dir)
            const patterns = ['director-', 'agent-', 'runtime-']
            let count = 0
            for (const f of files) {
              if (patterns.some(p => f.startsWith(p))) {
                await unlink(resolve(dir, f)).catch(() => {})
                count++
              }
            }
            results[target] = { success: true, message: `已清理 ${count} 个临时文件` }
            break
          }
          default:
            results[target] = { success: false, message: '未知清理目标' }
        }
      } catch (err: any) {
        results[target] = { success: false, message: `清理失败: ${err.message}` }
      }
    }

    return toApiResponse({results}) satisfies ApiResponse<unknown>;
  })

  // GET /api/admin/cache/stats — 缓存统计
  fastify.get('/api/admin/cache/stats', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { readdir } = await import('fs/promises')
    const { resolve } = await import('path')

    const uploadDir = '/root/shipin-cinematic-studio/backend/public/uploads'
    const uploadFiles = (await readdir(uploadDir)).filter(f => f !== '.gitkeep')
    const licenseCount = await prisma.licenseCache.count()

    // 临时文件统计
    const tmpDir = '/tmp'
    const allTmp = await readdir(tmpDir)
    const tempFiles = allTmp.filter(f => ['director-', 'agent-', 'runtime-'].some(p => f.startsWith(p)))

    return {
      upload_files: { count: uploadFiles.length },
      license_cache: { count: licenseCount },
      temp_logs: { count: tempFiles.length },
    }
  })

  // ============================================================
  // 管理员 - 阿里百炼配置
  // ============================================================
  fastify.put('/api/admin/bailian/config', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { apiKey, baseUrl, enabled } = request.body as any

    // 写环境变量（当前进程）
    if (apiKey) process.env.BAILIAN_API_KEY = apiKey
    if (baseUrl) process.env.BAILIAN_BASE_URL = baseUrl

    // 持久化到 .env 文件
    const { readFile, writeFile } = await import('fs/promises')
    const { resolve } = await import('path')
    const envPath = resolve('/root/shipin-cinematic-studio/backend/.env')
    try {
      let envContent = await readFile(envPath, 'utf-8')

      // 更新或添加 BAILIAN_API_KEY
      if (envContent.includes('BAILIAN_API_KEY=')) {
        envContent = envContent.replace(/BAILIAN_API_KEY=.*/, `BAILIAN_API_KEY=${apiKey || ''}`)
      } else {
        envContent += `\nBAILIAN_API_KEY=${apiKey || ''}`
      }

      // 更新或添加 BAILIAN_BASE_URL
      if (envContent.includes('BAILIAN_BASE_URL=')) {
        envContent = envContent.replace(/BAILIAN_BASE_URL=.*/, `BAILIAN_BASE_URL=${baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}`)
      } else {
        envContent += `\nBAILIAN_BASE_URL=${baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}`
      }

      await writeFile(envPath, envContent, 'utf-8')
    } catch {}

    return toApiResponse({success: true}) satisfies ApiResponse<unknown>;
  })

  fastify.post('/api/admin/bailian/test', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const apiKey = process.env.BAILIAN_API_KEY || ''
    const baseUrl = process.env.BAILIAN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'

    if (!apiKey) {
      return reply.status(400).send({ error: '请先配置阿里百炼 API Key' })
    }

    try {
      const startTime = Date.now()
      // 用 qwen-turbo 测试连接
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 10,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        return reply.status(400).send({ error: `API 响应异常 (${res.status}): ${errText}` })
      }

      const data = await res.json()
      const latency = Date.now() - startTime
      return toApiResponse({success: true, model: data.model || 'qwen-turbo', latency}) satisfies ApiResponse<unknown>;
    } catch (err: any) {
      return reply.status(400).send({ error: `连接失败: ${err.message}` })
    }
  })

  // ──────────────────────────────────────────────
  // 支付宝异步通知
  // ──────────────────────────────────────────────
  // POST /api/payment/alipay/notify — 支付宝支付结果通知
  // 注意：这个路由需要 getAlipayConfig / AlipayProvider / handleVipOrderFromAlipay
  // 由于这些依赖在 payment/controllers 里，我们在这里独立实现精简版

  // ⚠️ 安全提示：生产环境应在 Nginx/CDN 层面做 IP 白名单过滤（仅允许支付宝/微信官方 IP 段访问），
  // 代码层的验签和 IP 检查作为双重保障，不应单独依赖。
  // 支付宝官方 IP 段：https://docs.open.alipay.com/common/whitelist
  // 微信官方 IP 段：https://pay.weixin.qq.com/wiki/doc/api/jsapi.php?chapter=23_3
  // 生产环境建议从环境变量读取 IP 白名单：WHITELIST_ALIPAY_IPS, WHITELIST_WXPAY_IPS
  const ALIPAY_WHITELIST_IPS: string[] = process.env.WHITELIST_ALIPAY_IPS
    ? process.env.WHITELIST_ALIPAY_IPS.split(',')
    : [] // 生产环境必须配置
  const WXPAY_WHITELIST_IPS: string[] = process.env.WHITELIST_WXPAY_IPS
    ? process.env.WHITELIST_WXPAY_IPS.split(',')
    : [] // 生产环境必须配置

  fastify.post('/api/payment/alipay/notify', async (request, reply) => {
    try {
      const clientIp = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || ''
      if (ALIPAY_WHITELIST_IPS.length > 0 && !ALIPAY_WHITELIST_IPS.includes(clientIp)) {
        console.log(`[alipay/notify] IP 不在白名单: ${clientIp}`)
        return reply.code(403).send('ip not allowed')
      }
      const body = request.body as any
      const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'alipay' } })
      if (!secret || !secret.enabled) {
        console.log('[alipay/notify] 支付宝未配置')
        return 'success'
      }

      const config = typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config
      if (!config.appId || !config.privateKey) {
        console.log('[alipay/notify] 支付宝密钥不完整')
        return 'success'
      }

      const { AlipayProvider } = await import('../payment/providers/alipay/index.js')
      // 构造 providerConfig：必须包含 alipayPublicKey 用于验签
      const providerConfig = {
        appId: config.appId,
        privateKey: config.privateKey,
        alipayPublicKey: config.publicKey || config.alipayPublicKey || '',
        gateway: 'https://openapi.alipay.com/gateway.do',
        notifyUrl: 'https://aigc.fushtn.com/api/payment/alipay/notify',
        returnUrl: 'https://aigc.fushtn.com/user/center',
      }
      console.log('[alipay/notify] alipayPublicKey present:', !!providerConfig.alipayPublicKey, 'key length:', providerConfig.alipayPublicKey.length)
      const provider = new AlipayProvider(providerConfig)
      if (!provider.verifyNotify(body)) {
        console.log('[alipay/notify] 签名验证失败')
        return reply.code(403).send('signature verification failed')
      }

      const parsed = provider.parseNotify(body)
      console.log('[alipay/notify] 回调成功:', parsed.outTradeNo, parsed.tradeNo)

      // 更新 paymentOrder 状态
      const payOrder = await prisma.paymentOrder.findFirst({ where: { orderNo: parsed.outTradeNo } })
      if (payOrder && payOrder.status === 'pending') {
        await prisma.paymentOrder.update({
          where: { id: payOrder.id },
          data: { status: 'paid', payTime: parsed.paidAt || new Date() },
        })
      }

      // 处理 VIP 升级订单
      if (parsed.outTradeNo?.startsWith('VIP')) {
        await handleVipRechargeOrder(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt || new Date())
      }

      // 处理代理申请订单
      if (parsed.outTradeNo?.startsWith('AGT')) {
        await handleAgentRechargeOrder(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt || new Date())
      }

      // 处理企业订阅订单
      if (parsed.outTradeNo?.startsWith('ENT')) {
        await handleEnterpriseSubscriptionOrder(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt || new Date())
      }

      // Sprint-09B-3A Task 03-B: 处理镜心职业助理订阅
      if (payOrder?.planType === 'career_agent') {
        await handleCareerSubscriptionFromPayment(payOrder, parsed.tradeNo, parsed.paidAt || new Date())
      }
    } catch (err: any) {
      console.error('[alipay/notify] 处理失败:', err.message)
    }
    return 'success'
  })

  // ──────────────────────────────────────────────
  // 微信支付异步通知
  // ──────────────────────────────────────────────
  fastify.post('/api/payment/wxpay/notify', async (request, reply) => {
    try {
      const clientIp = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || request.ip || ''
      if (WXPAY_WHITELIST_IPS.length > 0 && !WXPAY_WHITELIST_IPS.includes(clientIp)) {
        console.log(`[wxpay/notify] IP 不在白名单: ${clientIp}`)
        return reply.code(403).send('ip not allowed')
      }
      const rawBody = (request as any).rawBody || (typeof request.body === 'string' ? request.body : JSON.stringify(request.body))
      const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody)

      const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'wechat' } })
      if (!secret || !secret.enabled) {
        console.log('[wxpay/notify] 微信未配置')
        reply.code(500).send('')
        return
      }

      const config = typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config
      const { apiV3Key, keyPem } = config

      // API v3 通知是 JSON 格式
      const { decryptWxpayNotify } = await import('../services/wxpay.service.js')
      const parsed = JSON.parse(bodyStr)

      // 解密 resource
      const paymentInfo = decryptWxpayNotify(parsed.resource, apiV3Key)
      const outTradeNo = paymentInfo.out_trade_no
      const transactionId = paymentInfo.transaction_id
      const tradeState = paymentInfo.trade_state

      console.log('[wxpay/notify] 回调:', outTradeNo, transactionId, tradeState)

      if (tradeState === 'SUCCESS') {
        // 通用：更新 paymentOrder 状态
        const payOrder = await prisma.paymentOrder.findFirst({ where: { orderNo: outTradeNo } })
        if (payOrder && payOrder.status === 'pending') {
          await prisma.paymentOrder.update({
            where: { id: payOrder.id },
            data: { status: 'paid', payTime: new Date() },
          })
        }

        if (outTradeNo?.startsWith('VIP')) {
          await handleVipRechargeOrder(outTradeNo, transactionId || '', new Date())
        }
        if (outTradeNo?.startsWith('AGT')) {
          await handleAgentRechargeOrder(outTradeNo, transactionId || '', new Date())
        }
        if (outTradeNo?.startsWith('ENT')) {
          await handleEnterpriseSubscriptionOrder(outTradeNo, transactionId || '', new Date())
        }

        // Sprint-09B-3A Task 03-B: 处理镜心职业助理订阅
        if (payOrder?.planType === 'career_agent') {
          await handleCareerSubscriptionFromPayment(payOrder, transactionId || '', new Date())
        }
      }

      reply.code(200).send({ code: 'SUCCESS', message: '成功' })
    } catch (err: any) {
      console.error('[wxpay/notify] 异常:', err.message)
      reply.code(403).send('invalid notification')
    }
  })

  // ──────────────────────────────────────────────
  // 支付状态查询（微信 & 支付宝共用）
  // ──────────────────────────────────────────────
  fastify.get('/api/payment/wxpay/status/:orderId', async (request, reply) => {
    const { orderId } = request.params as any
    const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
    if (!order) return { status: 'error', message: '订单不存在' }
    return { status: order.status === 'paid' ? 'paid' : 'pending' }
  })
}

/** 处理 VIP 充值订单回调 */
async function handleVipRechargeOrder(orderNo: string, tradeNo: string, payTime: Date) {
  try {
    const order = await prisma.rechargeOrder.findFirst({ where: { orderNo } })
    if (!order) {
      console.warn(`[alipay-vip] 订单不存在: ${orderNo}`)
      return
    }
    if (order.status === 'paid') return

    const plan = await prisma.memberPlan.findUnique({ where: { level: order.planLevel || '' } })
    if (!plan) {
      console.warn(`[alipay-vip] 套餐不存在: ${order.planLevel}`)
      return
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + plan.months * 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.rechargeOrder.update({
        where: { id: order.id },
        data: { status: 'paid', payTime: now, tradeNo },
      }),
      prisma.user.update({
        where: { id: order.userId },
        data: {
          memberTier: plan.level,
          memberExpiresAt: expiresAt,
        },
      }),
      prisma.membership.upsert({
        where: { userId: order.userId },
        update: { tier: plan.level, expiresAt, credits: { increment: plan.coins || 0 } },
        create: { userId: order.userId, tier: plan.level, expiresAt, credits: plan.coins || 0 },
      }),
    ])

    if (plan.coins) {
      await prisma.coinLog.create({
        data: {
          userId: order.userId,
          amount: plan.coins,
          type: 'recharge',
          remark: `开通VIP「${plan.name}」赠送 ${plan.coins} 积分`,
          relatedId: order.id,
        },
      })
    }

    console.log(`[alipay-vip] 会员升级成功: user=${order.userId}, plan=${plan.level}`)

    // ====== 结算推荐佣金 ======
    // 查询充值用户的推荐人信息
    const payingUser = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { marketAgentId: true },
    })
    if (payingUser?.marketAgentId) {
      // 推荐人可以是：活跃代理商 OR VIP会员
      const referrer = await prisma.user.findUnique({
        where: { id: payingUser.marketAgentId },
        select: { id: true, agentStatus: true, memberTier: true },
      })
      if (referrer && (referrer.agentStatus === 'active' || referrer.memberTier !== 'free')) {
        const commissionAmount = order.amount * 0.05 // 5%佣金
        await prisma.$transaction([
          prisma.commissionOrder.create({
            data: {
              agentId: referrer.id,
              fromUserId: order.userId,
              orderId: order.id,
              orderNo: order.orderNo,
              sourceType: 'vip_referral',
              orderAmount: order.amount,
              commissionRate: 5,
              commissionAmount,
              status: 'pending',
            },
          }),
          prisma.user.update({
            where: { id: referrer.id },
            data: {
              settledCommission: { increment: commissionAmount },
              totalCommission: { increment: commissionAmount },
            },
          }),
        ])
        console.log(`[alipay-vip] 推荐佣金结算: referrer=${referrer.id}, amount=${commissionAmount}`)
      }
    }
  } catch (err: any) {
    console.error('[alipay-vip] 处理失败:', err.message)
  }
}

/** 处理代理申请订单回调 */
async function handleAgentRechargeOrder(orderNo: string, tradeNo: string, payTime: Date) {
  try {
    const order = await prisma.rechargeOrder.findFirst({ where: { orderNo } })
    if (!order) {
      console.warn(`[alipay-agent] 订单不存在: ${orderNo}`)
      return
    }
    if (order.status === 'paid') return

    // 找到对应代理套餐
    const agentPlan = await prisma.agentPlan.findFirst({
      where: { price: order.amount, enabled: true },
      orderBy: { level: 'asc' },
    })

    if (!agentPlan) {
      // 找个 level 最接近的
      const allPlans = await prisma.agentPlan.findMany({ where: { enabled: true }, orderBy: { level: 'asc' } })
      const matched = allPlans.find(p => p.price <= order.amount && p.price > 0) || allPlans[allPlans.length - 1]
      if (matched) {
        const now = new Date()
        const expiresAt = new Date(now.getTime() + (matched.months || 12) * 30 * 24 * 60 * 60 * 1000)
        await prisma.$transaction([
          prisma.rechargeOrder.update({
            where: { id: order.id },
            data: { status: 'paid', payTime: now, tradeNo },
          }),
          prisma.user.update({
            where: { id: order.userId },
            data: {
              agentStatus: 'active',
              agentLevel: matched.level,
              agentExpiresAt: expiresAt,
            },
          }),
        ])
        console.log(`[alipay-agent] 代理激活成功: user=${order.userId}, level=${matched.level}`)
      }
      return
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + (agentPlan.months || 12) * 30 * 24 * 60 * 60 * 1000)

    await prisma.$transaction([
      prisma.rechargeOrder.update({
        where: { id: order.id },
        data: { status: 'paid', payTime: now, tradeNo },
      }),
      prisma.user.update({
        where: { id: order.userId },
        data: {
          agentStatus: 'active',
          agentLevel: agentPlan.level,
          agentExpiresAt: expiresAt,
        },
      }),
    ])

    console.log(`[alipay-agent] 代理激活成功: user=${order.userId}, level=${agentPlan.level}`)
  } catch (err: any) {
    console.error('[alipay-agent] 处理失败:', err.message)
  }
}

/** 处理企业订阅订单回调 */
async function handleEnterpriseSubscriptionOrder(orderNo: string, tradeNo: string, payTime: Date) {
  try {
    const order = await prisma.paymentOrder.findFirst({ where: { orderNo } })
    if (!order) {
      console.warn(`[enterprise-subscription] 订单不存在: ${orderNo}`)
      return
    }
    if (order.status === 'paid') return

    const metadata = (order.metadata as any) || {}
    const periodDays = metadata.periodDays || 30

    await prisma.$transaction([
      prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'paid', payTime, tradeNo },
      }),
      prisma.enterpriseSubscription.updateMany({
        where: { orderId: order.id },
        data: {
          status: 'active',
          startAt: new Date(),
          expireAt: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
        },
      }),
    ])

    // 同步创建 Entitlement
    const subscription = await prisma.enterpriseSubscription.findFirst({
      where: { orderId: order.id },
    })
    if (subscription) {
      const { entitlementService } = await import('../services/enterprise/enterprise-entitlement.service.js')
      await entitlementService.createFromSubscription(order.organizationId, subscription.id)
      console.log(`[enterprise-subscription] Entitlement 已同步: org=${order.organizationId}`)
    }

    console.log(`[enterprise-subscription] 订阅已激活: order=${orderNo}, org=${order.organizationId}`)
  } catch (err: any) {
    console.error('[enterprise-subscription] 处理失败:', err.message)
  }
}

/**
 * 处理镜心职业助理订阅回调 — Sprint-09B-3A Task 03-B
 * 支付成功 → 创建个人 Tenant → 创建 Subscription(active) → CapabilityGrant 自动生效
 */
/* Sprint-10 T01: 辅助函数 — 安全合并 subscription metadata */
function mergeSubscriptionMetadata(existing: string | null, updates: Record<string, any>): string {
  let base: Record<string, any> = {}
  if (existing) {
    try { base = JSON.parse(existing) } catch { /* ignore */ }
  }
  return JSON.stringify({ ...base, ...updates })
}

/**
 * Sprint-10 T01: 设置 subscription provisioning 状态
 * write-committed: 状态写入后再继续下一步
 */
async function setProvisioningStatus(
  subId: string,
  status: 'pending' | 'provisioning' | 'active' | 'failed',
  extra: Record<string, any> = {},
): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { id: subId } })
  if (!sub) return
  await prisma.subscription.update({
    where: { id: subId },
    data: {
      metadata: mergeSubscriptionMetadata(sub.metadata, {
        provisioningStatus: status,
        provisioningUpdatedAt: new Date().toISOString(),
        ...extra,
      }),
    },
  })
}

async function handleCareerSubscriptionFromPayment(payOrder: any, tradeNo: string, payTime: Date) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { code: 'career_agent' } })
  if (!plan) {
    console.error('[career-sub] career_agent 套餐未配置')
    return
  }

  const userId = payOrder.userId
  const now = new Date()

  // 1. 确保个人 Tenant 存在
  let tenant = await prisma.tenant.findUnique({ where: { id: userId } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: userId,
        name: `Personal: ${userId.slice(0, 8)}`,
        type: 'personal',
        status: 'active',
      },
    })
    console.log(`[career-sub] 个人 Tenant 已创建: userId=${userId.slice(0, 8)}`)
  }

  // 2. 检查已有订阅：active → 跳过，非 active → 续期
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: userId, planId: plan.id },
    orderBy: { createdAt: 'desc' },
  })

  let sub: any = null

  if (existingSub) {
    if (existingSub.status === 'active') {
      console.log(`[career-sub] 订阅已激活，跳过: userId=${userId.slice(0, 8)}`)
      return
    }
    // 续期过期/取消的订阅
    sub = await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: 'active',
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        metadata: mergeSubscriptionMetadata(existingSub.metadata, {
          provisioningStatus: 'pending',
          provisioningUpdatedAt: now.toISOString(),
        }),
      },
    })
    console.log(`[career-sub] 续期成功: userId=${userId.slice(0, 8)}`)
  } else {
    // 3. 新订阅 — 先以 pending 创建
    sub = await prisma.subscription.create({
      data: {
        tenantId: userId,
        planId: plan.id,
        status: 'active',
        startDate: now,
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        autoRenew: false,
        metadata: JSON.stringify({
          source: 'payment',
          orderNo: payOrder.orderNo,
          tradeNo,
          amount: payOrder.amount,
          paidAt: payTime.toISOString(),
          provisioningStatus: 'pending',
          provisioningUpdatedAt: now.toISOString(),
        }),
      },
    })
    console.log(`[career-sub] 新订阅创建: userId=${userId.slice(0, 8)}, subId=${sub.id.slice(0, 8)}`)
  }

  // 4. Provisioning: pending → provisioning
  await setProvisioningStatus(sub.id, 'provisioning')

  // 5. 创建 Career Agent Instance
  try {
    const agentService = new CareerAgentService(prisma)
    const hasAgent = await agentService.hasCareerAgent(userId)
    if (!hasAgent) {
      const newAgent = await agentService.createAndDeploy({ userId })
      if (newAgent && newAgent.status === 'active') {
        await setProvisioningStatus(sub.id, 'active', {
          provisionedAt: new Date().toISOString(),
          profileId: newAgent.profileId,
        })
        console.log(`[career-sub] Career Agent 已创建: userId=${userId.slice(0, 8)}, profileId=${newAgent.profileId.slice(0, 8)}`)
      } else {
        throw new Error(`createAndDeploy 返回非 active 状态: ${newAgent?.status || 'null'}`)
      }
    } else {
      // 已有 Agent → 确认正常
      await setProvisioningStatus(sub.id, 'active', { provisionedVia: 'pre_existing' })
      console.log(`[career-sub] Career Agent 已存在，跳过创建: userId=${userId.slice(0, 8)}`)
    }
  } catch (agentErr: any) {
    // Sprint-10 T01: provisioning 失败 = 显式状态，非静默
    const errMsg = agentErr.message || '未知错误'
    console.error(`[career-sub] Career Agent 创建失败: userId=${userId.slice(0, 8)}, error=${errMsg}`)
    await setProvisioningStatus(sub.id, 'failed', {
      provisioningError: errMsg,
      provisioningFailedAt: new Date().toISOString(),
    })
  }
}
