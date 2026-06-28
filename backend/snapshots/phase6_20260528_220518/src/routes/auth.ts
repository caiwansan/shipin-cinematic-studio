import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcryptjs'
import { authService } from '../services/auth.service.js'
import { prisma } from '../utils/index.js'
import { verifyCaptcha } from './captcha.js'

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register — 统一注册（邮箱 or 手机号）
  fastify.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, phone, username, password, code, captchaToken, captchaCode, refCode } = request.body as any

    // 校验图形验证码（仅生产环境开启，本地测试跳过）
    // if (!captchaToken || !captchaCode) {
    //   return reply.status(400).send({ error: '缺少图形验证码' })
    // }
    // const captchaValid = await verifyCaptcha(captchaToken, captchaCode)
    // if (!captchaValid) {
    //   return reply.status(400).send({ error: '图形验证码错误或已过期' })
    // }

    if (email) {
      // ====== 邮箱注册 ======
      // 校验邮箱格式
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.status(400).send({ error: '邮箱格式不正确' })
      }
      // 如果传了验证码则校验，没传则跳过（方便测试）
      if (code) {
        const emailRecord = await prisma.emailCode.findFirst({
          where: { email, code, used: false, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        })
        if (!emailRecord) {
          return reply.status(400).send({ error: '邮箱验证码错误或已过期' })
        }
        await prisma.emailCode.update({
          where: { id: emailRecord.id },
          data: { used: true },
        })
      }

      // 检查邮箱是否已注册
      const existingEmail = await prisma.user.findUnique({ where: { email } })
      if (existingEmail) {
        return reply.status(400).send({ error: '该邮箱已注册' })
      }

      // 创建用户
      const finalUsername = username?.trim() || email.split('@')[0]
      const passwordHash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email,
          username: finalUsername,
          passwordHash,
          membership: { create: { tier: 'free' } },
        },
        select: { id: true, email: true, username: true, createdAt: true },
      })

      // 赠送注册积分 — 已禁用
      try {
        // 注册积分已禁用，保留 coinLog 表兼容
        await prisma.coinLog.create({
          data: { userId: user.id, amount: 0, type: 'reward', remark: '注册赠送(已禁用)' },
        })
      } catch (e) {
        console.error('Registration reward note failed:', e)
      }

      const u = user as any
      // 新用户 tokenVersion = 1
      const accessToken = fastify.jwt.sign({ id: user.id, email: user.email, tokenVersion: 1 })
      
      return {
        accessToken,
        user: { id: u.id, email: u.email, username: u.username, memberTier: u.memberTier, coins: u.coins },
      }
    } else if (phone) {
      // ====== 手机号注册 ======
      if (!code) {
        return reply.status(400).send({ error: '缺少短信验证码' })
      }
      if (!password) {
        return reply.status(400).send({ error: '缺少密码' })
      }
      // 校验手机号格式
      if (!/^1\d{10}$/.test(phone)) {
        return reply.status(400).send({ error: '手机号格式不正确' })
      }
      // 校验短信验证码
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
        return reply.status(400).send({ error: '短信验证码错误或已过期' })
      }
      await prisma.smsCode.update({
        where: { id: smsRecord.id },
        data: { used: true },
      })

      // 检查手机号是否已注册
      const existingUser = await prisma.user.findUnique({ where: { phone } })
      if (existingUser) {
        return reply.status(400).send({ error: '该手机号已注册' })
      }

      // 创建用户
      const finalUsername = username?.trim() || `user_${phone.slice(-4)}`
      const emailForPhone = `${phone}@phone.local`
      const passwordHash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          email: emailForPhone,
          username: finalUsername,
          passwordHash,
          phone,
          phoneVerified: true,
          membership: { create: { tier: 'free' } },
        },
        select: { id: true, email: true, username: true, phone: true, createdAt: true },
      })

      // 赠送注册积分
      try {
        await prisma.membership.update({
          where: { userId: user.id },
          data: { credits: { increment: 58 } },
        })
        // 注册送积分 — 已禁用
        await prisma.coinLog.create({
          data: { userId: user.id, amount: 0, type: 'reward', remark: '注册赠送(已禁用)' },
        })
      } catch (e) {
        console.error('Registration reward note failed:', e)
      }

      const u = user as any
      // 新用户 tokenVersion = 1
      const accessToken = fastify.jwt.sign({ id: user.id, email: user.email, tokenVersion: 1 })
      
      return {
        accessToken,
        user: { id: u.id, email: u.email, username: u.username, phone: u.phone, memberTier: u.memberTier, coins: u.coins },
      }
    } else {
      return reply.status(400).send({ error: '请提供邮箱或手机号' })
    }
  })

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as any
    const result = await authService.login(email, password, fastify)
    return result
  })

  // POST /api/auth/refresh
  fastify.post('/api/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as any
    return { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }
  })

  // GET /api/auth/user-by-email — 公开接口，通过邮箱查询用户（不需要JWT，用于会员中心数据同步）
  fastify.get('/api/auth/user-by-email', async (request, reply) => {
    const { email } = request.query as any
    if (!email) return reply.status(400).send({ error: '缺少邮箱参数' })
    const dbUser = await prisma.user.findUnique({
      where: { email: String(email) },
      select: { id: true, email: true, username: true, coins: true, memberTier: true, phone: true, createdAt: true, memberExpiresAt: true, membership: true },
    })
    if (!dbUser) return reply.status(404).send({ error: '用户不存在' })
    const serialized: any = JSON.parse(JSON.stringify(dbUser, (k, v) => typeof v === 'bigint' ? Number(v) : v))
    // 强制用套餐表覆盖储存空间，让后台改套餐后会员中心立即同步
    try {
      const plan = await prisma.memberPlan.findUnique({ where: { level: serialized.memberTier || 'free' } })
      if (plan?.storageLimit) {
        serialized.membership = serialized.membership || {}
        serialized.membership.storageLimit = Number(plan.storageLimit) * 1024 * 1024
      }
    } catch {}
    return { user: serialized }
  })

  // GET /api/auth/me
  fastify.get('/api/auth/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const jwtUser = (request as any).user
    console.log('[auth/me] request.user:', JSON.stringify(jwtUser))
    if (!jwtUser || !jwtUser.id) {
      return reply.status(401).send({ error: '无效的 token', detail: !jwtUser ? 'user not in request' : 'user.id missing' })
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: { id: true, email: true, username: true, coins: true, memberTier: true, phone: true, createdAt: true, memberExpiresAt: true, membership: true },
    })
    if (!dbUser) {
      return reply.status(404).send({ error: '用户不存在' })
    }
        // BigInt 序列化修复
    const serialized: any = JSON.parse(JSON.stringify(dbUser, (k, v) => typeof v === 'bigint' ? Number(v) : v))
    // 强制用套餐表覆盖储存空间
    try {
      const plan = await prisma.memberPlan.findUnique({ where: { level: serialized.memberTier || 'free' } })
      if (plan?.storageLimit) {
        serialized.membership = serialized.membership || {}
        serialized.membership.storageLimit = Number(plan.storageLimit) * 1024 * 1024
      }
        } catch {}
    return { user: serialized }
  })

  // GET /api/auth/plans — 用户可访问的套餐列表
  fastify.get('/api/auth/plans', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const plans = await prisma.memberPlan.findMany({ orderBy: { sortOrder: 'asc' } })
    return { success: true, data: plans }
  })

  // GET /api/user/profile — 获取当前用户信息
  fastify.get('/api/user/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, memberTier: true, coins: true, memberExpiresAt: true, createdAt: true },
    })
    if (!user) return reply.status(404).send({ success: false, error: '用户不存在' })
    return { success: true, data: user }
  })

  // POST /api/auth/logout — 退出登录（清除 cookie）
  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.header('Set-Cookie', 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax')
    return { success: true, message: '已退出' }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

