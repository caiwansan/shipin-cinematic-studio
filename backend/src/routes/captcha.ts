import { FastifyInstance } from 'fastify'
import svgCaptcha from 'svg-captcha'
import crypto from 'crypto'
import { prisma } from '../utils/index.js'

export async function verifyCaptcha(captchaToken: string, captchaCode: string): Promise<boolean> {
  const captcha = await prisma.captcha.findUnique({
    where: { token: captchaToken },
  })
  if (!captcha) return false
  if (captcha.used) return false
  if (captcha.expiresAt < new Date()) return false

  const codeHash = crypto.createHash('sha256').update(captchaCode.toLowerCase()).digest('hex')
  if (captcha.code !== codeHash) return false

  // Mark as used
  await prisma.captcha.update({
    where: { id: captcha.id },
    data: { used: true },
  })
  return true
}

export default async function captchaRoutes(fastify: FastifyInstance) {
  // GET /api/captcha — 生成图形验证码
  fastify.get('/api/captcha', async (_request, reply) => {
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: '0o1il',
      noise: 2,
      color: true,
      background: '#1a1a2e',
      width: 120,
      height: 40,
    })

    // sha256 hash the text for storage
    const textHash = crypto.createHash('sha256').update(captcha.text.toLowerCase()).digest('hex')
    const token = crypto.randomUUID()

    await prisma.captcha.create({
      data: {
        token,
        code: textHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    })

    return {
      svg: captcha.data,
      token,
    }
  })
}
