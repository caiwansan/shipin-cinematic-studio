// 脱敏手机号：138****0000
function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return phone
  if (phone.length < 7) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

// 简单的内存限速（重启后重置，生产环境应用 Redis）
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>()

import { prisma } from '../utils/index.js'
import { authService } from '../services/auth.service.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register — 统一注册（仅支持手机号）
  fastify.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const { phone, username, password, code, refCode, qqBindToken } = request.body as any

    if (!phone) {
      return reply.status(400).send({ error: '请提供手机号' })
    }
    if (!code) {
      return reply.status(400).send({ error: '缺少短信验证码' })
    }
    if (!password) {
      return reply.status(400).send({ error: '缺少密码' })
    }
    if (!/^1\d{10}$/.test(phone)) {
      return reply.status(400).send({ error: '手机号格式不正确' })
    }

    // 校验短信验证码 — 限速：同一手机号每分钟最多尝试 5 次
    const recentAttempts = await prisma.smsCode.count({
      where: {
        phone,
        createdAt: { gt: new Date(Date.now() - 60000) }
      }
    })
    if (recentAttempts > 5) {
      return reply.status(429).send({ error: '验证码尝试过于频繁，请稍后再试' })
    }

    // 原子操作：批量标记已使用
    const result = await prisma.smsCode.updateMany({
      where: {
        phone,
        code,
        used: false,
        expiresAt: { gt: new Date() }
      },
      data: { used: true }
    })
    if (result.count === 0) {
      return reply.status(400).send({ error: '短信验证码错误或已过期' })
    }

    // 检查手机号是否已注册
    const existingUser = await prisma.user.findUnique({ where: { phone } })
    if (existingUser) {
      return reply.status(400).send({ error: '该手机号已注册' })
    }

    // 解析 qqBindToken（绑定QQ登录）
    let qqOpenId: string | undefined = undefined
    let qqNickname: string | undefined = undefined
    if (qqBindToken) {
      try {
        const BIND_SECRET = process.env.JWT_SECRET
        if (!BIND_SECRET) {
          throw new Error('JWT_SECRET environment variable is required')
        }
        const jwt = await import('jsonwebtoken')
        const decoded = jwt.default.verify(qqBindToken, BIND_SECRET) as any
        if (decoded.type === 'qq_bind' && decoded.qqOpenId) {
          qqOpenId = decoded.qqOpenId
          qqNickname = decoded.nickname
          // 检查该 QQ 是否已被绑定
          const bound = await prisma.user.findFirst({ where: { qqOpenId } })
          if (bound) {
            return reply.status(400).send({ error: '该QQ账号已被其他用户绑定' })
          }
        }
      } catch (e) {
        return reply.status(400).send({ error: 'QQ绑定令牌已过期或无效' })
      }
    }

    // 处理推荐码：查找上级推荐人
    let marketAgentId: string | undefined = undefined
    if (refCode) {
      const agent = await prisma.user.findFirst({
        where: {
          OR: [
            { id: refCode },
            { email: refCode },
            { username: refCode },
          ],
        },
        select: { id: true },
      })
      if (agent) {
        marketAgentId = agent.id
      }
    }

    // 创建用户
    const finalNickname = qqNickname || username?.trim() || `user_${phone.slice(-4)}`
    const emailForPhone = `${phone}@phone.local`
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email: emailForPhone,
        username: finalNickname,
        passwordHash,
        phone,
        phoneVerified: true,
        ...(qqOpenId ? { qqOpenId } : {}),
        membership: { create: { tier: 'free' } },
        ...(marketAgentId ? { marketAgentId } : {}),
      },
      select: { id: true, email: true, username: true, phone: true, qqOpenId: true, createdAt: true, membership: { select: { credits: true } } },
    })

    // Personal Tenant (Phase 1.0): 自动创建
    let personalTenantId: string | undefined
    try {
      const { ensurePersonalTenant } = await import('../services/platform/governance/services/personal-tenant.service.js')
      const result = await ensurePersonalTenant({
        userId: user.id,
        userName: finalNickname,
      })
      personalTenantId = result.tenantId
    } catch (e) {
      console.error('[Auth/Register] Failed to create Personal Tenant:', e)
      // 不阻塞注册流程
    }

    // 赠送注册积分
    try {
      await prisma.membership.update({
        where: { userId: user.id },
        data: { credits: { increment: 58 } },
      })
      await prisma.coinLog.create({
        data: { userId: user.id, amount: 0, type: 'reward', remark: '注册赠送(已禁用)' },
      })
    } catch (e) {
      console.error('Registration reward note failed:', e)
    }

    const u = user as any
    const accessToken = fastify.jwt.sign({ id: user.id, email: user.email, tokenVersion: 1 })

    return {
      accessToken,
      user: { id: u.id, email: u.email, username: u.username, phone: maskPhone(u.phone), memberTier: u.memberTier, credits: u.membership?.credits ?? 0, agentStatus: u.agentStatus, agentLevel: u.agentLevel },
    }
  })

  // POST /api/auth/login — 邮箱+密码 or 手机号+密码 or 账号+密码
  fastify.post('/api/auth/login', async (request, reply) => {
    let { email, phone, account, password } = request.body as any

    // IP 限速防护：同一 IP+账号 5 次失败后封禁 15 分钟
    const ip = request.ip || (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown'
    const key = `${ip}:${account || email || phone}`
    const attempt = loginAttempts.get(key)
    if (attempt && Date.now() < attempt.blockedUntil) {
      return reply.status(429).send({ error: '登录尝试过于频繁，请15分钟后重试' })
    }

    // 限速记录：记录失败尝试
    const recordFailedAttempt = () => {
      const newAttempt = loginAttempts.get(key) || { count: 0, blockedUntil: 0 }
      newAttempt.count++
      if (newAttempt.count >= 5) {
        newAttempt.blockedUntil = Date.now() + 15 * 60 * 1000 // 15分钟
      }
      loginAttempts.set(key, newAttempt)
    }

    // 兼容 account 字段（支持手机号、邮箱、用户名）
    if (account && !email && !phone) {
      // 先当手机号查
      const userByPhone = await prisma.user.findUnique({ where: { phone: account } })
      if (userByPhone) {
        phone = account
        email = userByPhone.email
      } else {
        // 再当邮箱查
        const userByEmail = await prisma.user.findUnique({ where: { email: account } })
        if (userByEmail) {
          email = account
        } else {
          // 最后当用户名查
          const userByName = await prisma.user.findFirst({ where: { username: account } })
          if (!userByName) {
            recordFailedAttempt()
            return reply.status(401).send({ error: '账号未注册' })
          }
          email = userByName.email
        }
      }
    }

    // 如果传了 phone 但没传 email，通过 phone 反查邮箱
    if (phone && !email) {
      const userByPhone = await prisma.user.findUnique({ where: { phone } })
      if (!userByPhone) {
        recordFailedAttempt()
        return reply.status(401).send({ error: '手机号未注册' })
      }
      email = userByPhone.email
    }

    if (!email || !password) {
      recordFailedAttempt()
      return reply.status(400).send({ error: '请输入邮箱和密码' })
    }

    try {
      const result = await authService.login(email, password, fastify)
      // 登录成功，清除限速计数
      loginAttempts.delete(key)
      return result
    } catch (e: any) {
      recordFailedAttempt()
      return reply.status(e.statusCode || 401).send({ error: e.message || '邮箱或密码错误' })
    }
  })

  // POST /api/auth/refresh
  fastify.post('/api/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as any
    if (!refreshToken) {
      return reply.status(400).send({ error: '缺少 refreshToken' })
    }
    try {
      const jwt = await import('jsonwebtoken')
      const refreshSecret = process.env.JWT_REFRESH_SECRET
      if (!refreshSecret) {
        return reply.status(500).send({ success: false, error: '服务器未配置刷新令牌密钥' })
      }
      const decoded = jwt.default.verify(refreshToken, refreshSecret) as any
      if (!decoded || !decoded.id) {
        return reply.status(401).send({ error: '无效的 refreshToken' })
      }
      // 生成新的 accessToken
      const newAccessToken = fastify.jwt.sign({
        id: decoded.id,
        email: decoded.email,
        tokenVersion: (decoded.tokenVersion || 0) + 1,
      })
      // 生成新的 refreshToken（用 refreshSecret，更长过期时间）
      const newRefreshToken = jwt.default.sign(
        { id: decoded.id, email: decoded.email, tokenVersion: (decoded.tokenVersion || 0) + 1 },
        refreshSecret,
        { expiresIn: '7d' }
      )
      return toApiResponse({accessToken: newAccessToken, refreshToken: newRefreshToken}) satisfies ApiResponse<unknown>;
    } catch (e: any) {
      if (e.name === 'TokenExpiredError') {
        return reply.status(401).send({ error: 'refreshToken 已过期，请重新登录' })
      }
      return reply.status(401).send({ error: '无效的 refreshToken' })
    }
  })

  // GET /api/auth/user-by-email — 公开接口，通过邮箱查询用户（不需要JWT，用于会员中心数据同步）
  fastify.get('/api/auth/user-by-email', async (request, reply) => {
    const { email } = request.query as any
    if (!email) return reply.status(400).send({ error: '缺少邮箱参数' })
    const dbUser = await prisma.user.findUnique({
      where: { email: String(email) },
      select: { id: true, email: true, username: true, memberTier: true, phone: true, createdAt: true, memberExpiresAt: true, membership: true, agentStatus: true, agentLevel: true, agentPlanId: true, agentExpiresAt: true },
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
    serialized.coins = serialized.membership?.credits ?? 0
    serialized.phone = maskPhone(serialized.phone)
    return toApiResponse({user: serialized}) satisfies ApiResponse<unknown>;
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
      select: { id: true, email: true, username: true, memberTier: true, phone: true, createdAt: true, memberExpiresAt: true, membership: true, agentStatus: true, agentLevel: true, agentPlanId: true, agentExpiresAt: true },
    })
    if (!dbUser) {
      return reply.status(404).send({ error: '用户不存在' })
    }
        // BigInt 序列化修复
    const serialized: any = JSON.parse(JSON.stringify(dbUser, (k, v) => typeof v === 'bigint' ? Number(v) : v))
    // ⭐ 统一会员等级：以 Membership.tier 为真相源，自动同步 User.memberTier
    const memTier = serialized.membership?.tier
    if (memTier && memTier !== serialized.memberTier) {
      try {
        await prisma.user.update({
          where: { id: jwtUser.id },
          data: { memberTier: memTier },
        })
        serialized.memberTier = memTier
      } catch {}
    }
    // 强制用套餐表覆盖储存空间
    try {
      const plan = await prisma.memberPlan.findUnique({ where: { level: serialized.memberTier || 'free' } })
      if (plan?.storageLimit) {
        serialized.membership = serialized.membership || {}
        serialized.membership.storageLimit = Number(plan.storageLimit) * 1024 * 1024
      }
    } catch {}
    serialized.coins = serialized.membership?.credits ?? 0
    serialized.phone = maskPhone(serialized.phone)
    return toApiResponse({user: serialized}) satisfies ApiResponse<unknown>;
  })

  // GET /api/auth/plans — 用户可访问的套餐列表
  fastify.get('/api/auth/plans', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const plans = await prisma.memberPlan.findMany({ orderBy: { sortOrder: 'asc' } })
    return toApiResponse({success: true, data: plans}) satisfies ApiResponse<unknown>;
  })

  // GET /api/user/profile — 获取当前用户信息
  fastify.get('/api/user/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, memberTier: true, memberExpiresAt: true, createdAt: true, membership: { select: { credits: true } } },
    })
    if (!user) return reply.status(404).send({ success: false, error: '用户不存在' })
    return toApiResponse({success: true, data: user}) satisfies ApiResponse<unknown>;
  })

  // POST /api/auth/logout — 退出登录（清除 cookie）
  fastify.post('/api/auth/logout', async (request, reply) => {
    reply.header('Set-Cookie', 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax')
    return toApiResponse({success: true, message: '已退出'}) satisfies ApiResponse<unknown>;
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

