// @ts-nocheck
// ─── 短信验证码登录 ───
import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';
import { verifyToken } from './admin-auth.js'
import { requireAdmin } from '../middleware/require-admin.js'
import { createRequire } from 'node:module'

// ESM 环境：require 不可用，用 createRequire 加载 CJS 版腾讯云 SDK
const require = createRequire(import.meta.url)

// 获取腾讯云短信配置
async function getSmsConfig() {
  const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'sms_auth' } })
  if (!secret || !secret.enabled) return null
  try { return JSON.parse(secret.config) } catch { return null }
}

// 腾讯云短信 API 调用（使用 tencentcloud-sdk-nodejs-sms 官方 SDK）
async function sendSmsViaTencent(phone: string, code: string): Promise<boolean> {
  const config = await getSmsConfig()
  if (!config) {
    console.log(`[SMS MOCK] 发送验证码到 ${phone}: ${code}`)
    return true
  }

  const { SecretId, SecretKey, SmsSdkAppId, TemplateId, SignName } = config
  if (!SecretId || !SecretKey || !SmsSdkAppId || !TemplateId || !SignName) {
    console.log(`[SMS MOCK] 配置不完整，发送验证码到 ${phone}: ${code}`)
    return true
  }

  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs-sms')
    const SmsClient = tencentcloud.sms.v20210111.Client

    const client = new SmsClient({
      credential: { secretId: SecretId, secretKey: SecretKey },
      region: 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } },
    })

    const result = await client.SendSms({
      PhoneNumberSet: [`+86${phone}`],
      SmsSdkAppId,
      SignName,
      TemplateId,
      TemplateParamSet: [code],
    })

    console.log(`[SMS] 腾讯云短信响应:`, JSON.stringify(result))

    if (result.SendStatusSet?.[0]?.Code === 'Ok') {
      return true
    }

    const errCode = result.SendStatusSet?.[0]?.Code
    const errMsg = result.SendStatusSet?.[0]?.Message || JSON.stringify(result)
    console.error(`[SMS] 发送失败: ${errCode} / ${errMsg}`)

    // 腾讯云单号日限 / 账户日限 → 自动降级为输出调试码（仅本项目有效）
    if (errCode === 'LimitExceeded' || errMsg?.includes('exceeds the upper limit')) {
      return 'mock' as any // 特殊返回值：表示已降级为 mock
    }

    return false
  } catch (err: any) {
    console.error(`[SMS] 发送异常:`, err.message)
    return false
  }
}

export default async function smsAuthRoutes(fastify: FastifyInstance) {
  // ─── 管理员配置接口 ───

  // GET /api/admin/sms-auth/config — 获取短信配置
  fastify.get('/api/admin/sms-auth/config', { preHandler: [requireAdmin] }, async (request, reply) => {
    const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'sms_auth' } })
    if (!secret) {
      return toApiResponse({
        enabled: false,
        config: { SecretId: '', SecretKey: '', SmsSdkAppId: '', TemplateId: '', SignName: '' }
      }) satisfies ApiResponse<unknown>;
    }

    let config = { SecretId: '', SecretKey: '', SmsSdkAppId: '', TemplateId: '', SignName: '' }
    try { config = JSON.parse(secret.config) } catch {}
    return toApiResponse({ enabled: secret.enabled, config }) satisfies ApiResponse<unknown>;
  })

  // PUT /api/admin/sms-auth/config — 保存短信配置
  fastify.put('/api/admin/sms-auth/config', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { SecretId, SecretKey, SmsSdkAppId, TemplateId, SignName, enabled } = request.body as any
    const config = JSON.stringify({
      SecretId: SecretId || '',
      SecretKey: SecretKey || '',
      SmsSdkAppId: SmsSdkAppId || '',
      TemplateId: TemplateId || '',
      SignName: SignName || '',
    })

    await prisma.paymentSecret.upsert({
      where: { channel: 'sms_auth' },
      update: { config, enabled: enabled !== undefined ? !!enabled : true },
      create: {
        channel: 'sms_auth',
        config,
        enabled: enabled !== undefined ? !!enabled : true,
        remark: '腾讯云短信验证码登录配置',
      },
    })

    return toApiResponse({ success: true }) satisfies ApiResponse<unknown>;
  })

  // ─── 用户端接口 ───

  // POST /api/auth/sms/send — 发送短信验证码
  fastify.post('/api/auth/sms/send', async (request, reply) => {
    const { phone } = request.body as any

    if (!phone) {
      return reply.status(400).send({ error: '请输入手机号' })
    }

    // 校验手机号格式（11位中国大陆手机号）
    if (!/^1\d{10}$/.test(phone)) {
      return reply.status(400).send({ error: '手机号格式不正确' })
    }

    // 频率限制：同一手机号60秒内不能重复发送
    const recentCode = await prisma.smsCode.findFirst({
      where: { phone, used: false, createdAt: { gt: new Date(Date.now() - 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
    })
    if (recentCode) {
      const waitSeconds = Math.ceil((recentCode.createdAt.getTime() + 60000 - Date.now()) / 1000)
      return reply.status(429).send({ error: `请 ${waitSeconds} 秒后再试` })
    }

    // 日限：同一手机号每天最多5条验证码
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayCount = await prisma.smsCode.count({
      where: { phone, createdAt: { gte: todayStart } },
    })
    if (todayCount >= 5) {
      return reply.status(429).send({ error: '该手机号今日验证码已达上限（5条）' })
    }

    // 生成6位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // 存储到数据库
    await prisma.smsCode.create({
      data: {
        phone,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟有效
      },
    })

    // 调用腾讯云短信 API
    const sent = await sendSmsViaTencent(phone, code)
    if (sent === 'mock') {
      return toApiResponse({ success: true, debugCode: code, mock: true, message: '短信日限已满，调试码已显示在页面，使用调试码即可完成验证' }) satisfies ApiResponse<unknown>;
    }
    if (!sent) {
      return reply.status(500).send({ error: '短信发送失败，请稍后重试' })
    }

    return toApiResponse({ success: true, debugCode: code }) satisfies ApiResponse<unknown>;
  })

  // POST /api/auth/sms/login — 验证码登录/注册
  fastify.post('/api/auth/sms/login', async (request, reply) => {
    const { phone, code } = request.body as any

    if (!phone || !code) {
      return reply.status(400).send({ error: '请输入手机号和验证码' })
    }

    if (!/^1\d{10}$/.test(phone)) {
      return reply.status(400).send({ error: '手机号格式不正确' })
    }

    // 查找有效的验证码
    const smsRecord = await prisma.smsCode.findFirst({
      where: {
        phone,
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!smsRecord) {
      return reply.status(400).send({ error: '验证码错误或已过期' })
    }

    // 标记验证码已使用
    await prisma.smsCode.update({
      where: { id: smsRecord.id },
      data: { used: true },
    })

    // 查找或创建用户
    const email = `sms_${phone}@aigc.fushtn.com`
    let user = await prisma.user.findFirst({
      where: { OR: [{ phone }, { email }] },
    })

    if (!user) {
      // 新用户自动注册
      const { randomUUID } = await import('crypto')
      const { default: bcrypt } = await import('bcryptjs')
      const tempPwd = randomUUID().slice(0, 16)
      const passwordHash = await bcrypt.hash(tempPwd, 10)

      user = await prisma.user.create({
        data: {
          email,
          phone,
          username: phone,
          passwordHash,
          memberTier: 'free',
        },
      })

      // 创建会员记录
      const existingMembership = await prisma.membership.findUnique({ where: { userId: user.id } })
      if (!existingMembership) {
        await prisma.membership.create({
          data: { userId: user.id, tier: 'free', credits: 0 },
        })
      }

      // 注册赠送钻石（COMMUNITY-REGISTER-REWARD-01：默认 10）
      try {
        const { grantRegisterReward } = await import('../services/community/community-reward.service.js')
        await grantRegisterReward(user.id)
      } catch (e) {
        console.error('[SmsAuth] Register reward failed:', e)
      }
    }

    // 生成 JWT token
    const JWT_SECRET = (process.env.JWT_SECRET || (() => { throw new Error("JWT_SECRET 环境变量未配置") })())
    const newVer = (user.tokenVersion || 1) + 1
    await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: newVer } }).catch(() => {})
    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, role: 'user', tokenVersion: newVer },
      { expiresIn: '30d' }
    )

    // 获取会员信息
    const membership = await prisma.membership.findUnique({ where: { userId: user.id } })

    // ⭐ 统一会员等级：以 Membership 为真相源
    let resolvedTier = membership?.tier || user.memberTier || 'free'
    if (user.memberTier !== resolvedTier && resolvedTier !== 'free') {
      try {
        await prisma.user.update({ where: { id: user.id }, data: { memberTier: resolvedTier } })
        user.memberTier = resolvedTier
      } catch {}
    }
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        coins: (user.membership?.credits ?? 0),
        memberTier: resolvedTier,
        membership: membership ? { tier: membership.tier, credits: membership.credits } : null,
        agentStatus: user.agentStatus,
        agentLevel: user.agentLevel,
      },
    }
  })

  // POST /api/auth/sms/reset-password — 短信验证码找回密码
  fastify.post('/api/auth/sms/reset-password', async (request, reply) => {
    const { phone, code, password, confirmPassword } = request.body as any

    if (!phone || !code || !password || !confirmPassword) {
      return reply.status(400).send({ error: '请填写完整信息' })
    }
    if (password !== confirmPassword) {
      return reply.status(400).send({ error: '两次密码输入不一致' })
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: '密码至少 6 位' })
    }
    if (!/^1\d{10}$/.test(phone)) {
      return reply.status(400).send({ error: '手机号格式不正确' })
    }

    // 查找用户
    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) {
      return reply.status(404).send({ error: '该手机号未注册' })
    }

    // 校验短信验证码
    const smsRecord = await prisma.smsCode.findFirst({
      where: { phone, code, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!smsRecord) {
      return reply.status(400).send({ error: '验证码错误或已过期' })
    }
    await prisma.smsCode.update({
      where: { id: smsRecord.id },
      data: { used: true },
    })

    // 更新密码
    const { default: bcrypt } = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    return toApiResponse({ success: true }) satisfies ApiResponse<unknown>;
  })
}
