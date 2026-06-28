import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { verifyCaptcha } from './captcha.js'

export default async function smsRoutes(fastify: FastifyInstance) {
  // POST /api/sms/send — 发送短信验证码
  fastify.post('/api/sms/send', async (request, reply) => {
    const { phone, captchaToken, captchaCode } = request.body as any

    if (!phone || !captchaToken || !captchaCode) {
      return reply.status(400).send({ error: '缺少必要参数' })
    }

    // 校验图形验证码
    const valid = await verifyCaptcha(captchaToken, captchaCode)
    if (!valid) {
      return reply.status(400).send({ error: '图形验证码错误或已过期' })
    }

    // 校验手机号格式（+86 11位）
    if (!/^1\d{10}$/.test(phone)) {
      return reply.status(400).send({ error: '手机号格式不正确' })
    }

    // 生成6位随机码
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // 存储到 SmsCode 表
    await prisma.smsCode.create({
      data: {
        phone,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟有效
      },
    })

    // Mock 短信发送
    console.log(`[SMS MOCK] 发送验证码到 ${phone}: ${code}`)

    return { success: true } satisfies ApiResponse<unknown>;

  })

  // POST /api/email/send-code — 发送邮箱验证码
  fastify.post('/api/email/send-code', async (request, reply) => {
    const { email, captchaToken, captchaCode } = request.body as any

    if (!email || !captchaToken || !captchaCode) {
      return reply.status(400).send({ error: '缺少必要参数' })
    }

    // 校验图形验证码
    const valid = await verifyCaptcha(captchaToken, captchaCode)
    if (!valid) {
      return reply.status(400).send({ error: '图形验证码错误或已过期' })
    }

    // 校验邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.status(400).send({ error: '邮箱格式不正确' })
    }

    // 生成6位随机码
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // 存储到 EmailCode 表
    await prisma.emailCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟有效
      },
    })

    // Mock 邮件发送
    console.log(`[EMAIL MOCK] 发送验证码到 ${email}: ${code}`)

    return { success: true } satisfies ApiResponse<unknown>;

  })
}
