import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';

// ============================================
// MEMBER-CENTER-02 用户安全（支付密码 / 绑定状态 / 重置登录密码）
// ============================================

export default async function userSecurityRoutes(fastify: FastifyInstance) {
  // GET /api/user/security — 账号绑定与安全状态总览
  fastify.get('/api/user/security', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        phoneVerified: true,
        email: true,
        wechatOpenId: true,
        qqOpenId: true,
        alipayOpenId: true,
        payPasswordHash: true,
        wechatBoundAt: true,
        alipayBoundAt: true,
      },
    })
    if (!dbUser) return reply.status(404).send({ error: '用户不存在' })

    return toApiResponse({
      phone: dbUser.phone ? `${dbUser.phone.slice(0, 3)}****${dbUser.phone.slice(-4)}` : null,
      phoneVerified: dbUser.phoneVerified,
      email: dbUser.email,
      wechatBound: !!dbUser.wechatOpenId,
      qqBound: !!dbUser.qqOpenId,
      alipayBound: !!dbUser.alipayOpenId,
      wechatBoundAt: dbUser.wechatBoundAt,
      alipayBoundAt: dbUser.alipayBoundAt,
      hasPayPassword: !!dbUser.payPasswordHash,
    }) satisfies ApiResponse<unknown>
  })

  // POST /api/user/pay-password — 设置/修改支付密码（bcrypt 存储）
  fastify.post('/api/user/pay-password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId
    const { payPassword, oldPayPassword } = request.body as any

    if (!payPassword || !/^\d{6}$/.test(String(payPassword))) {
      return reply.status(400).send({ error: '支付密码必须是 6 位数字' })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { payPasswordHash: true },
    })
    if (!dbUser) return reply.status(404).send({ error: '用户不存在' })

    // 已设置 → 需校验旧密码
    if (dbUser.payPasswordHash) {
      if (!oldPayPassword) {
        return reply.status(400).send({ error: '请先输入原支付密码' })
      }
      const bcryptMod = await import('bcryptjs')
      const bcrypt = bcryptMod.default || bcryptMod
      const valid = await bcrypt.compare(String(oldPayPassword), dbUser.payPasswordHash)
      if (!valid) {
        return reply.status(400).send({ error: '原支付密码不正确' })
      }
    }

    const bcryptMod = await import('bcryptjs')
    const bcrypt = bcryptMod.default || bcryptMod
    const hash = await bcrypt.hash(String(payPassword), 10)

    await prisma.user.update({
      where: { id: userId },
      data: { payPasswordHash: hash },
    })

    return toApiResponse({ success: true, message: '支付密码设置成功' }) satisfies ApiResponse<unknown>
  })

  // POST /api/user/pay-password/verify — 校验支付密码（提现/红包/礼物等敏感操作前调用）
  fastify.post('/api/user/pay-password/verify', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id || user.userId
    const { payPassword } = request.body as any

    if (!payPassword) {
      return reply.status(400).send({ error: '请输入支付密码' })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { payPasswordHash: true },
    })
    if (!dbUser || !dbUser.payPasswordHash) {
      return reply.status(400).send({ error: '尚未设置支付密码' })
    }

    const bcryptMod = await import('bcryptjs')
    const bcrypt = bcryptMod.default || bcryptMod
    const valid = await bcrypt.compare(String(payPassword), dbUser.payPasswordHash)
    if (!valid) {
      return reply.status(400).send({ error: '支付密码不正确' })
    }

    return toApiResponse({ success: true }) satisfies ApiResponse<unknown>
  })

  // POST /api/auth/send-reset-code — 发送重置密码邮箱验证码（MEMBER-CENTER-02 设置中心）
  fastify.post('/api/auth/send-reset-code', async (request, reply) => {
    const { email } = request.body as any
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.status(400).send({ error: '邮箱格式不正确' })
    }

    // 邮箱必须已注册
    const dbUser = await prisma.user.findUnique({ where: { email } })
    if (!dbUser) {
      return reply.status(404).send({ error: '该邮箱未注册' })
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    await prisma.emailCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    console.log(`[EMAIL MOCK] 重置密码验证码发送到 ${email}: ${code}`)
    return toApiResponse({ success: true, message: '验证码已发送' }) satisfies ApiResponse<unknown>
  })

  // POST /api/auth/reset-password — 邮箱验证码重置登录密码
  fastify.post('/api/auth/reset-password', async (request, reply) => {
    const { email, code, newPassword } = request.body as any

    if (!email || !code || !newPassword) {
      return reply.status(400).send({ error: '缺少必要参数' })
    }
    if (String(newPassword).length < 6) {
      return reply.status(400).send({ error: '新密码至少 6 位' })
    }

    // 校验验证码（最近 5 分钟、未使用、匹配）
    const emailCode = await prisma.emailCode.findFirst({
      where: { email, code: String(code), used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!emailCode) {
      return reply.status(400).send({ error: '验证码错误或已过期' })
    }

    await prisma.emailCode.update({ where: { id: emailCode.id }, data: { used: true } })

    const bcryptMod = await import('bcryptjs')
    const bcrypt = bcryptMod.default || bcryptMod
    const passwordHash = await bcrypt.hash(String(newPassword), 10)

    // 重置密码 + 提升 tokenVersion 使旧 token 全部失效
    await prisma.user.update({
      where: { email },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    })

    return toApiResponse({ success: true, message: '密码重置成功' }) satisfies ApiResponse<unknown>
  })
}
