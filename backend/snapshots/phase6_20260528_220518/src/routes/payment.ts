// ─── Payment Routes ───
// 支付系统：管理员配置收款码 + 支付密钥管理 + 用户充值 + 订单管理
// 收款码模式（微信/支付宝收款码），管理员手动确认到账

import { FastifyInstance } from 'fastify'
import { requireAdmin } from '../middleware/require-admin.js'
import { prisma } from '../utils/index.js'
import { verifyToken } from './admin-auth.js'

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
    if (!record) return { channel, enabled: false, config: null }

    return {
      channel: record.channel,
      enabled: record.enabled,
      config: JSON.parse(record.config),
      remark: record.remark,
    }
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

    return { success: true, channel }
  })
  // ============================================================
  // 管理员 - 支付配置管理
  // ============================================================

  // GET /api/admin/payment/config — 获取支付配置列表
  // GET /api/v1/admin/payment/config — 获取支付密钥配置（兼容前端 { wechat:{...}, alipay:{...} } 格式）
  fastify.get('/api/v1/admin/payment/config',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
    const secrets = await prisma.paymentSecret.findMany()
    const result: Record<string, any> = {}
    for (const s of secrets) {
      const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
      result[s.channel] = { configured: true, ...config }
    }
    // 保证 wechat / alipay 键一定存在
    if (!result.wechat) result.wechat = { configured: false, appId: '', mchId: '', apiKey: '' }
    if (!result.alipay) result.alipay = { configured: false, appId: '', privateKey: '', publicKey: '' }
    return result
  })

  // POST /api/v1/admin/payment/config — 保存/更新支付密钥配置（前端调用）
  fastify.post('/api/v1/admin/payment/config',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
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
        const { configured, ...cleanConfig } = config
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
    // 返回更新后的配置
    const secrets = await prisma.paymentSecret.findMany()
    const result: Record<string, any> = {}
    for (const s of secrets) {
      const config = (typeof s.config === 'string' ? JSON.parse(s.config) : s.config) || {}
      result[s.channel] = { configured: true, ...config }
    }
    if (!result.wechat) result.wechat = { configured: false, appId: '', mchId: '', apiKey: '' }
    if (!result.alipay) result.alipay = { configured: false, appId: '', privateKey: '', publicKey: '' }
    return { success: true, data: result }
  })

  // POST /api/v1/admin/payment/qr — 新增收款码支付配置（旧版兼容）
  fastify.post('/api/v1/admin/payment/qr',  async (request, reply) => {const auth = request.headers.authorization;if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' });const decoded = verifyToken(auth.slice(7));if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' });
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
      return {
        id: s.id,
        method: s.channel,
        name: s.channel === 'wechat' ? '微信支付' : '支付宝支付',
        isSecret: true,
        hasSecret,
      }
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

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      amount: order.amount,
      coins: order.coins,
      method: order.method,
      status: order.status,
      qrCodeUrl: config.qrCodeUrl || null,
      account: config.account || null,
      payeeName: config.name,
    }
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

    // 加积分
    await prisma.user.update({
      where: { id: order.userId },
      data: { coins: { increment: order.coins } },
    })

    // 记流水
    await prisma.coinLog.create({
      data: {
        userId: order.userId,
        amount: order.coins,
        type: 'recharge',
        remark: `充值 ${order.coins} 积分 (¥${order.amount}，${order.method === 'wechat' ? '微信' : '支付宝'})`,
        relatedId: order.id,
      },
    })

    // 更新会员积分
    await prisma.membership.update({
      where: { userId: order.userId },
      data: { credits: { increment: order.coins } },
    })

    return { success: true, orderNo: order.orderNo, coins: order.coins }
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

    return { success: true, orderId: order.id, plan: plan?.name || null, planLevel: plan?.level || null }
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

    return { success: true }
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
      return { ...o, user, _orderType: 'payment' }
    }))

    const withUserRecharge = await Promise.all(rechargeOrders.map(async (o) => {
      const user = await prisma.user.findUnique({ where: { id: o.userId }, select: { id: true, username: true, email: true } })
      return { ...o, user, _orderType: 'recharge', orderNo: o.id }
    }))

    // 合并并按时间排序
    const allOrders = [...withUserPayment, ...withUserRecharge]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, take)

    return { orders: allOrders, total: paymentTotal + rechargeTotal, page: pageNum, totalPages: Math.ceil((paymentTotal + rechargeTotal) / take) }
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

    return { orders, total, page: pageNum, totalPages: Math.ceil(total / take) }
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

      return { url: publicUrl }
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

    return { results }
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

    return { success: true }
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
      return { success: true, model: data.model || 'qwen-turbo', latency }
    } catch (err: any) {
      return reply.status(400).send({ error: `连接失败: ${err.message}` })
    }
  })
}
