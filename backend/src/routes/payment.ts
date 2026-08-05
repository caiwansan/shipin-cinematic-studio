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
import { requireAdmin, extractAdmin } from '../middleware/require-admin.js'
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

        const existing = await prisma.paymentSecret.findUnique({ where: { channel } })
        const { configured, ...cleanConfig } = config as Record<string, any>
        const existingConfig = existing
          ? (JSON.parse(existing.config) as Record<string, any>)
          : {}

        // 🛡️ 安全保护：如果字段值是遮盖掩码（含 '****'），说明前端回传了遮盖值，保留 DB 原值
        for (const key of Object.keys(cleanConfig)) {
          const val = cleanConfig[key]
          if (typeof val === 'string' && val.includes('****') && existingConfig[key]) {
            cleanConfig[key] = existingConfig[key]
          }
        }

        // ✅ 校验：提交了 apiV3Key 且非掩码回退 → 必须 32 位（微信 APIv3 密钥要求）
        if (typeof cleanConfig.apiV3Key === 'string' && cleanConfig.apiV3Key.length > 0 && cleanConfig.apiV3Key !== existingConfig.apiV3Key) {
          if (cleanConfig.apiV3Key.length !== 32) {
            return reply.status(400).send({ success: false, error: 'APIv3 密钥必须是 32 位，当前输入 ' + cleanConfig.apiV3Key.length + ' 位' })
          }
        }
        // 同样的 32 位校验也适用于 apiKey（V2 密钥，同为 32 位要求，宽松处理：非空时校验）
        if (typeof cleanConfig.apiKey === 'string' && cleanConfig.apiKey.length > 0 && cleanConfig.apiKey !== existingConfig.apiKey) {
          if (cleanConfig.apiKey.length !== 32) {
            return reply.status(400).send({ success: false, error: '微信支付 API 密钥必须是 32 位，当前输入 ' + cleanConfig.apiKey.length + ' 位' })
          }
        }

        // 合并更新：只覆盖本次提交的字段，未提交字段（如未编辑的掩码字段）保留 DB 原值
        const mergedConfig = { ...existingConfig, ...cleanConfig }
        if (existing) {
          await prisma.paymentSecret.update({
            where: { channel },
            data: { config: JSON.stringify(mergedConfig), enabled: true },
          })
        } else {
          await prisma.paymentSecret.create({
            data: { channel, config: JSON.stringify(mergedConfig), enabled: true },
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
  // MEMBER-CENTER-03: 接入昆仑镜统一支付（与 VIP 开通一致）
  //  - 密钥模式（PaymentSecret 配置完整）→ native 支付二维码（支付宝当面付/微信 NATIVE），回调自动到账
  //  - 收款码模式（PaymentConfig）→ 展示收款码/账号，管理员 confirm 到账
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

    const parseSecretConfig = (raw: string | null | undefined) => {
      if (!raw) return {}
      try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return {} }
    }
    const secretCfg = parseSecretConfig(secretConfig?.config)
    const isSecretEnabled = !!(secretConfig?.enabled && Object.values(secretCfg).some((v: any) => typeof v === 'string' && v.length > 0))

    if (!isSecretEnabled && (!qrConfig || !qrConfig.enabled)) {
      return reply.status(400).send({ error: '该支付方式未启用' })
    }

    // 钻石兑换比例：1 元 = N 钻（SystemConfig.diamond_exchange_rate，后台可配，默认 10 = 1:10）
    const rateCfg = await prisma.systemConfig.findUnique({ where: { key: 'diamond_exchange_rate' } })
    const diamondRate = Math.max(1, Number(rateCfg?.value || 10) || 10)
    const coins = Math.floor(amount * diamondRate)

    // 创建订单
    const order = await prisma.paymentOrder.create({
      data: {
        userId,
        orderNo: generateOrderNo(),
        type: 'credit',
        amount,
        coins,
        method,
        status: 'pending',
        remark: `用户充值 ¥${amount}，获得 ${coins} 钻石`,
      },
    })

    // ─── 密钥模式：生成 native 支付二维码（与 VIP checkout 同一套引擎）───
    let paymentUrl: string | null = null
    let qrCode: string | null = null
    let codeUrl: string | null = null

    if (isSecretEnabled) {
      try {
        if (method === 'alipay') {
          if (secretCfg.appId && secretCfg.privateKey) {
            let privateKey = secretCfg.privateKey
            if (privateKey && !privateKey.includes('-----BEGIN')) {
              privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`
            }
            const { AlipayProvider } = await import('../payment/providers/alipay/index.js')
            const provider = new AlipayProvider({
              appId: secretCfg.appId,
              privateKey,
              alipayPublicKey: secretCfg.publicKey || secretCfg.alipayPublicKey || '',
              gateway: 'https://openapi.alipay.com/gateway.do',
              notifyUrl: 'https://aigc.fushtn.com/api/payment/alipay/notify',
              returnUrl: 'https://aigc.fushtn.com/user/diamonds',
            })
            const result = await provider.createOrder({
              outTradeNo: order.orderNo,
              description: `充值 ${coins} 钻石 ¥${amount}`,
              amount,
              notifyUrl: 'https://aigc.fushtn.com/api/payment/alipay/notify',
              returnUrl: 'https://aigc.fushtn.com/user/diamonds',
            })
            paymentUrl = result.payUrl || null
            qrCode = result.qrCode || null
          }
        } else {
          if (secretCfg.appId && secretCfg.mchId && secretCfg.apiV3Key && secretCfg.keyPem) {
            const { createWxpayNativeQrCode } = await import('../services/wxpay.service.js')
            const result = await createWxpayNativeQrCode({
              outTradeNo: order.orderNo,
              description: `充值 ${coins} 钻石 ¥${amount}`,
              totalAmount: amount,
              notifyUrl: 'https://aigc.fushtn.com/api/payment/wxpay/notify',
            })
            codeUrl = result.codeUrl || null
          }
        }
      } catch (err: any) {
        console.error(`[recharge] ${method} 支付链接生成失败:`, err.message)
      }

      // 保存支付凭据
      if (paymentUrl || qrCode || codeUrl) {
        await prisma.paymentOrder.update({
          where: { id: order.id },
          data: { qrCode: codeUrl || qrCode || paymentUrl, payUrl: paymentUrl },
        })
      }
    }

    return toApiResponse({
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      coins: order.coins,
      method: order.method,
      status: order.status,
      paymentUrl,
      qrCode,
      codeUrl,
      qrCodeUrl: qrConfig?.qrCodeUrl || null,
      account: qrConfig?.account || null,
      payeeName: qrConfig?.name || null,
    }) satisfies ApiResponse<unknown>
  })

  // ============================================================
  // Commerce Authority — 统一商品购买（SPRINT-COMMERCE-UNIFICATION-CAREER-01）
  // 商品目录 = SubscriptionPlan（Product + CapabilityBundle 合一）
  // 禁止业务线专属 checkout：所有 AI 员工 / VIP 购买统一走 /api/payment/checkout
  // ============================================================

  // GET /api/payment/products/:productCode — 商品 + 权益目录（前端权益展示数据源）
  fastify.get('/api/payment/products/:productCode', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const productCode = (request.params as any)?.productCode as string
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: productCode } })
    if (!plan) return reply.status(404).send({ error: '商品不存在' })
    let capabilities: string[] = []
    try { capabilities = JSON.parse(plan.capabilities || '[]') } catch {}
    return toApiResponse({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      capabilities,
    }) satisfies ApiResponse<unknown>
  })

  // POST /api/payment/checkout — 统一下单（productCode 驱动）
  // 支持: productCode=career_agent（AI 员工增值包）| 未来 vip_basic / vip_advanced（会员）
  fastify.post('/api/payment/checkout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { productCode, method } = request.body as any
    if (!productCode) return reply.status(400).send({ error: '缺少 productCode' })
    return createCheckoutOrder(userId, productCode, method, reply)
  })

  // POST /api/payment/career/checkout — 兼容别名（DEPRECATED，前端已迁移到 /api/payment/checkout）
  fastify.post('/api/payment/career/checkout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { method } = request.body as any
    return createCheckoutOrder(userId, 'career_agent', method, reply)
  })

  // 统一下单逻辑：SubscriptionPlan → PaymentOrder（planType=productCode）→ 支付链接/二维码
  async function createCheckoutOrder(userId: string, productCode: string, method: string, reply: any) {
    const validMethod = method === 'wechat' ? 'wechat' : 'alipay'

    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: productCode } })
    if (!plan) {
      return reply.status(500).send({ error: `商品 ${productCode} 未配置` })
    }

    const existingSub = await prisma.subscription.findFirst({
      where: { tenantId: userId, planId: plan.id, status: 'active' },
    })
    if (existingSub) {
      return reply.status(400).send({ error: '您已拥有活跃的订阅' })
    }

    // 创建支付订单（统一 PaymentOrder，planType = productCode）
    // MEMBER-CENTER-03.3 隔离铁律：订阅/套餐订单 coins 必须 = 0（购买 VIP/套餐 ≠ 充值钻石）
    // 钻石只在 type=credit 充值链路产生；套餐赠送积分走 provision 的 productMeta.coins（type=reward）
    const amount = plan.price || 9.9
    const orderNo = generateOrderNo()
    const order = await prisma.paymentOrder.create({
      data: {
        userId,
        orderNo,
        type: 'subscription',
        amount,
        coins: 0,
        method: validMethod,
        status: 'pending',
        planType: productCode,
        remark: `${plan.name} ¥${amount}/月`,
      },
    })

    // 调用支付宝/微信支付生成支付链接
    let paymentUrl: string | null = null
    let qrCode: string | null = null
    let expiresAt: string | null = null

    if (validMethod === 'alipay') {
      try {
        const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'alipay' } })
        if (secret && secret.enabled) {
          const config = typeof secret.config === 'string' ? JSON.parse(secret.config) : secret.config
          if (config.appId && config.privateKey) {
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
              description: `${plan.name} ¥${amount}/月`,
              amount,
              notifyUrl: 'https://aigc.fushtn.com/api/payment/alipay/notify',
              returnUrl: 'https://aigc.fushtn.com/workspace/job',
            })
            paymentUrl = result.payUrl || null
            qrCode = result.qrCode || null
          }
        }
      } catch (err: any) {
        console.error(`[checkout] 支付宝支付链接生成失败:`, err.message)
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
              description: `${plan.name} ¥${amount}/月`,
              totalAmount: amount,
              notifyUrl: 'https://aigc.fushtn.com/api/payment/wxpay/notify',
            })
            qrCode = result.codeUrl || null
          }
        }
      } catch (err: any) {
        console.error(`[checkout] 微信支付链接生成失败:`, err.message)
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
    }) satisfies ApiResponse<unknown>
  }

  // POST /api/admin/payment/confirm — 管理员确认到账
  // SPRINT-PAYMENT-SECURITY-01: 必须管理员（requireAdmin + verifyToken isAdmin 双重防线），
  // 支付成功唯一来源 = 验签回调（自动）+ 管理员线下收款对账（人工）；普通用户 JWT 一律 401
  fastify.post('/api/admin/payment/confirm', { preHandler: [requireAdmin] }, async (request, reply) => {
    const admin = extractAdmin(request)
    const { orderId } = request.body as any
    if (!orderId) return reply.status(400).send({ error: '缺少订单ID' })

    const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (!order) return reply.status(404).send({ error: '订单不存在' })
    if (order.status !== 'pending') return reply.status(400).send({ error: '订单状态不允许确认' })

    // 获取管理员
    let adminId: number | null = null
    if (admin?.username) {
      const adminUser = await prisma.adminUser.findUnique({ where: { username: admin.username } })
      adminId = adminUser?.id ?? null
    }

    // 确认到账
    const now = new Date()
    await prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: 'paid', payTime: now, confirmAdminId: adminId, confirmTime: now },
    })

    // MEMBER-CENTER-03.3 隔离铁律：钻石只属于 type=credit 充值订单。
    // 曾无条件 membership.credits += order.coins → 管理员确认订阅/套餐订单也发钻石（购买VIP=充值钻石）
    if (order.type === 'credit') {
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
    }

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

    // SPRINT-COMMERCE-UNIFICATION-CAREER-01: 统一 Provision（Commerce Authority 唯一激活入口）
    if (order.planType) {
      const { provisionFromPayment } = await import('../services/commerce/commerce-provision.service.js')
      await provisionFromPayment(order, '', now)
    }

    return toApiResponse({success: true, orderNo: order.orderNo, coins: order.coins}) satisfies ApiResponse<unknown>;
  })

  // POST /api/admin/member/confirm — 管理员确认 VIP 升级订单
  // SPRINT-PAYMENT-SECURITY-01: requireAdmin（同 payment/confirm）
  fastify.post('/api/admin/member/confirm', { preHandler: [requireAdmin] }, async (request, reply) => {
    const admin = extractAdmin(request)
    const { orderId } = request.body as any
    if (!orderId) return reply.status(400).send({ error: '缺少订单ID' })

    const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
    if (!order) return reply.status(404).send({ error: '订单不存在' })
    if (order.status !== 'confirmed') return reply.status(400).send({ error: '订单状态不允许确认，需要用户先确认已付款' })

    // 获取管理员
    let adminId: number | null = null
    if (admin?.username) {
      const adminUser = await prisma.adminUser.findUnique({ where: { username: admin.username } })
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

  // GET /api/admin/payment/orders — 获取充值订单列表（type/status/keyword 筛选 + 分页 + 状态统计）
  fastify.get('/api/admin/payment/orders',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
    const { type = 'all', status = 'all', keyword = '', planKind = 'all', page = '1', pageSize, limit: rawLimit } = request.query as any

    // MEMBER-CENTER-03.3 四类业务隔离：充值钻石(type=credit) / VIP(planKind=VIP) / 工作台套餐(planKind=workspace) / 商城(MallOrder 独立表)
    // VIP 与工作台套餐同属 type=subscription，按 SubscriptionPlan.metadata.productType 细分
    const plans = await prisma.subscriptionPlan.findMany({ select: { code: true, metadata: true } })
    const vipCodes: string[] = []
    const workspaceCodes: string[] = []
    for (const pl of plans) {
      let md: Record<string, any> = {}
      try { md = JSON.parse(pl.metadata || '{}') } catch {}
      if (md.productType === 'VIP') vipCodes.push(pl.code)
      else workspaceCodes.push(pl.code)
    }

    const where: any = {}
    if (type && type !== 'all') where.type = type
    if (planKind === 'vip') { where.type = 'subscription'; where.planType = { in: vipCodes } }
    else if (planKind === 'workspace') { where.type = 'subscription'; where.planType = { in: workspaceCodes } }
    if (status && status !== 'all') where.status = status
    if (keyword) {
      // PaymentOrder 无 user relation：先查匹配用户 id，再按 userId 过滤
      const matched = await prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: keyword } },
            { email: { contains: keyword } },
            { phone: { contains: keyword } },
          ],
        },
        select: { id: true },
      })
      where.OR = [
        { orderNo: { contains: keyword } },
        { userId: { in: matched.map((m: any) => m.id) } },
      ]
    }

    const pageNum = Math.max(1, Number(page) || 1)
    const take = Math.min(Math.max(1, Number(pageSize ?? rawLimit) || 20), 100)

    const [paymentOrders, paymentTotal] = await Promise.all([
      prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip: (pageNum - 1) * take,
      }),
      prisma.paymentOrder.count({ where }),
    ])

    // 状态统计（顶部 tab 计数）
    const statsRaw = await prisma.paymentOrder.groupBy({
      by: ['status'],
      where: type && type !== 'all' ? { type } : {},
      _count: true,
    })
    const statsMap: Record<string, number> = {}
    for (const s of statsRaw) statsMap[s.status] = s._count

    // 批量补充用户信息（避免 N+1）
    const userIds = [...new Set(paymentOrders.map((o: any) => o.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, email: true, phone: true },
    })
    const userMap = new Map(users.map((u: any) => [u.id, u]))

    // 也查 rechargeOrder（VIP 老链订单，只属于 VIP 业务）
    // MEMBER-CENTER-03.3 隔离：rechargeOrder 仅在 planKind=all/vip 时合并，绝不混入 钻石充值/工作台套餐 tab
    const includeRecharge = (planKind === 'all' || planKind === 'vip') && type !== 'credit'
    const rechargeWhere = { ...(status && status !== 'all' ? { status } : {}) }
    const [rechargeOrders, rechargeTotal] = includeRecharge
      ? await Promise.all([
          prisma.rechargeOrder.findMany({
            where: rechargeWhere,
            orderBy: { createdAt: 'desc' },
            take,
            skip: (pageNum - 1) * take,
          }),
          prisma.rechargeOrder.count({ where: rechargeWhere }),
        ])
      : [[], 0]

    // 合并两个表的订单（裸对象，不再逐条 toApiResponse 包装）
    const planMap = new Map(plans.map((pl: any) => [pl.code, pl]))
    const withUserPayment = paymentOrders.map((o) => {
      const u = userMap.get(o.userId)
      const pl = o.planType ? planMap.get(o.planType) : null
      let productType = ''
      if (pl) { try { productType = (JSON.parse(pl.metadata || '{}') as any).productType || '' } catch {} }
      const planKind = o.type === 'credit' ? 'credit' : o.type === 'mall' ? 'mall' : productType === 'VIP' ? 'vip' : o.planType ? 'workspace' : ''
      const typeLabel = planKind === 'credit' ? '💎 钻石充值' : planKind === 'vip' ? '👑 VIP订阅' : planKind === 'workspace' ? '🖥️ 工作台套餐' : planKind === 'mall' ? '🛒 商城购物' : '订阅'
      return { ...o, planKind, planName: pl?.name || null, typeLabel, user: u ? { username: u.username, email: u.email, phone: u.phone } : null, _orderType: 'payment' }
    })

    const withUserRecharge = await Promise.all(rechargeOrders.map(async (o) => {
      const user = await prisma.user.findUnique({ where: { id: o.userId }, select: { id: true, username: true, email: true } })
      return { ...o, planKind: 'vip', typeLabel: '👑 VIP订阅', planName: o.planLevel || null, user, _orderType: 'recharge', orderNo: o.id }
    }))

    // 合并并按时间排序
    const allOrders = [...withUserPayment, ...withUserRecharge]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, take)

    return toApiResponse({orders: allOrders, items: allOrders, total: paymentTotal + rechargeTotal, page: pageNum, pageSize: take, totalPages: Math.ceil((paymentTotal + rechargeTotal) / take), stats: statsMap}) satisfies ApiResponse<unknown>;
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
      // MEMBER-CENTER-03.3 隔离铁律：只认 type=credit 发钻石（禁止 CZ 前缀判断——generateOrderNo 全平台共用 CZ 前缀，
      // 曾导致订阅/套餐订单（type=subscription）回调时被 startsWith('CZ') 误判为充值 → 购买 VIP = 充值钻石）
      const payOrder = await prisma.paymentOrder.findFirst({ where: { orderNo: parsed.outTradeNo } })
      if (payOrder && payOrder.status === 'pending') {
        if (payOrder.type === 'credit') {
          await handleCreditRecharge(payOrder, parsed.tradeNo, parsed.paidAt || new Date())
        } else {
          await prisma.paymentOrder.update({
            where: { id: payOrder.id },
            data: { status: 'paid', payTime: parsed.paidAt || new Date() },
          })
        }
      }

      // 处理商城订单（MALL 前缀）——独立业务，绝不给钻石/VIP
      if (parsed.outTradeNo?.startsWith('MALL')) {
        await handleMallPayment(parsed.outTradeNo, parsed.tradeNo, parsed.paidAt || new Date())
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

      // SPRINT-COMMERCE-UNIFICATION-CAREER-01: 统一 Provision
      if (payOrder?.planType) {
        const { provisionFromPayment } = await import('../services/commerce/commerce-provision.service.js')
        await provisionFromPayment(payOrder, parsed.tradeNo, parsed.paidAt || new Date())
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
        // MEMBER-CENTER-03.3 隔离铁律：只认 type=credit 发钻石（禁止 CZ 前缀判断，见 alipay notify 注释）
        const payOrder = await prisma.paymentOrder.findFirst({ where: { orderNo: outTradeNo } })
        if (payOrder && payOrder.status === 'pending') {
          if (payOrder.type === 'credit') {
            await handleCreditRecharge(payOrder, transactionId || '', new Date())
          } else {
            await prisma.paymentOrder.update({
              where: { id: payOrder.id },
              data: { status: 'paid', payTime: new Date() },
            })
          }
        }

        // 处理商城订单（MALL 前缀）——独立业务，绝不给钻石/VIP
        if (outTradeNo?.startsWith('MALL')) {
          await handleMallPayment(outTradeNo, transactionId || '', new Date())
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

        // SPRINT-COMMERCE-UNIFICATION-CAREER-01: 统一 Provision
        if (payOrder?.planType) {
          const { provisionFromPayment } = await import('../services/commerce/commerce-provision.service.js')
          await provisionFromPayment(payOrder, transactionId || '', new Date())
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
    if (!orderId || !/^[0-9a-fA-F-]{36}$/.test(orderId)) return { status: 'error', message: '订单不存在' }
    // SPRINT-COMMERCE-SSOT-02: 优先统一 PaymentOrder（新 VIP 链），fallback rechargeOrder（存量）
    const payOrder = await prisma.paymentOrder.findUnique({ where: { id: orderId } })
    if (payOrder) {
      return { status: payOrder.status === 'paid' ? 'paid' : 'pending' }
    }
    const order = await prisma.rechargeOrder.findUnique({ where: { id: orderId } })
    if (!order) return { status: 'error', message: '订单不存在' }
    return { status: order.status === 'paid' ? 'paid' : 'pending' }
  })
}

/** MEMBER-CENTER-03: 充值订单回调自动到账钻石（幂等：仅 pending→paid 时发放） */
async function handleCreditRecharge(payOrder: any, tradeNo: string, payTime: Date) {
  try {
    await prisma.paymentOrder.update({
      where: { id: payOrder.id },
      data: { status: 'paid', payTime, outTradeNo: tradeNo || undefined },
    })
    const coins = payOrder.coins || 0
    if (coins > 0) {
      // 加钻石（membership.credits 是用户积分余额真源）
      await prisma.membership.upsert({
        where: { userId: payOrder.userId },
        create: { userId: payOrder.userId, credits: coins },
        update: { credits: { increment: coins } },
      }).catch((e: any) => console.error('[recharge] membership upsert 失败:', e.message))
      // 记流水
      await prisma.coinLog.create({
        data: {
          userId: payOrder.userId,
          amount: coins,
          type: 'recharge',
          remark: `充值 ${coins} 钻石 (¥${payOrder.amount}，${payOrder.method === 'wechat' ? '微信' : '支付宝'})`,
          relatedId: payOrder.id,
        },
      }).catch((e: any) => console.error('[recharge] coinLog 失败:', e.message))
    }
    console.log(`[recharge] 订单 ${payOrder.orderNo} 到账 ${coins} 钻石 (tradeNo=${tradeNo})`)
  } catch (err: any) {
    console.error('[recharge] 自动到账失败:', err.message)
  }
}

/**
 * 处理商城订单支付回调（MALL 前缀）— MEMBER-CENTER-03.3 隔离：商城购物是独立业务
 * 幂等：PaymentOrder + RechargeOrder(支付流水) + MallOrder(业务单) 三表状态推进
 * 绝不发放钻石 / VIP / 套餐权益
 */
async function handleMallPayment(orderNo: string, tradeNo: string, payTime: Date) {
  try {
    // 1. 支付流水单（PaymentOrder，type=mall）
    const payOrder = await prisma.paymentOrder.findFirst({ where: { orderNo } })
    if (payOrder && payOrder.status === 'pending') {
      await prisma.paymentOrder.update({
        where: { id: payOrder.id },
        data: { status: 'paid', payTime, outTradeNo: tradeNo || undefined },
      })
    }
    // 2. 支付流水（RechargeOrder，MALL 共用支付流水表，coins=0/planLevel=null 无权益）
    const ro = await prisma.rechargeOrder.findFirst({ where: { orderNo } })
    if (ro && ro.status === 'pending') {
      await prisma.rechargeOrder.update({
        where: { id: ro.id },
        data: { status: 'paid', payTime, tradeNo },
      })
      // 3. 商城业务单（remark 格式：`商城订单 ${mallOrder.orderNo} 支付 ...`）
      const m = ro.remark?.match(/商城订单 (\S+)/)
      if (m?.[1]) {
        const updated = await prisma.mallOrder.updateMany({
          where: { orderNo: m[1], status: 'pending' },
          data: { status: 'paid', paidAt: payTime },
        })
        console.log(`[mall] 商城订单 ${m[1]} 已标记支付 (${updated.count} 行)`)
      }
    }
    console.log(`[mall] 商城支付回调完成: ${orderNo}, tradeNo=${tradeNo}`)
  } catch (err: any) {
    console.error('[mall] 商城支付回调处理失败:', err.message)
  }
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
          // MEMBER-CENTER-03.3 隔离：VIP 赠送积分是 reward 不是 recharge（充值≠购买VIP）
          type: 'reward',
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

