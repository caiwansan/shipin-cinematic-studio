import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../types/index.js'
import bcrypt from 'bcryptjs'
import { prisma } from '../utils/index.js'

interface RegisterInput {
  email: string
  username: string
  password: string
}

export const authService = {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  },

  async register(input: RegisterInput) {
    const { email, username, password } = input
    const passwordHash = await this.hashPassword(password)
    // 如果没传 username，用 email @ 前部分
    const finalUsername = username?.trim() || email.split('@')[0]
    const user = await prisma.user.create({
      data: {
        email,
        username: finalUsername,
        passwordHash,
        membership: { create: { tier: 'free' } },
      },
      select: { id: true, email: true, username: true, createdAt: true, membership: { select: { credits: true } } },
    })
    return { user }
  },

  async login(email: string, _password: string, fastify: FastifyInstance) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      const err: any = new Error('邮箱或密码错误')
      err.statusCode = 401
      throw err
    }
    // 密码验证
    if (user.passwordHash) {
      const bcryptMod = await import('bcryptjs')
      const bcrypt = bcryptMod.default || bcryptMod
      const valid = await bcrypt.compare(_password, user.passwordHash)
      if (!valid) {
        console.warn('[LOGIN] 密码对比失败 email:', email, 'pwd_len:', _password?.length, 'hash:', user.passwordHash?.substring(0, 20) + '...')
        const err: any = new Error('邮箱或密码错误')
        err.statusCode = 401
        throw err
      }
    }
    // 单设备登录：递增 tokenVersion，旧 token 失效
    const newVersion = (user.tokenVersion || 1) + 1
    await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: newVersion } })
    // SPRINT-MEDIA-IDENTITY-ALIGN-01 T03: JWT 注入 organizationId（昆仑镜身份链）
    const { getOrganizationIdForUser } = await import('./enterprise/organization/identity-bootstrap.service.js')
    const organizationId = (await getOrganizationIdForUser(user.id)) || undefined
    const token = (fastify as any).jwt.sign({ id: user.id, email: user.email, tokenVersion: newVersion, organizationId } as any)
    return {
      accessToken: token,
      user: { id: user.id, email: user.email, username: user.username, memberTier: user.memberTier, credits: (user as any).membership?.credits ?? 0, agentStatus: user.agentStatus, agentLevel: user.agentLevel, organizationId: organizationId || null },
    }
  },
}
