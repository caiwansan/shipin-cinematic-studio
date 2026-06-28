import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '../utils/index.js'

// ── JWT 校验（统一，cluster 安全，重启不丢）──
// app.jwt.verify 在 FastifyInstance 上，这里存一个引用
let _app: FastifyInstance | null = null

export function setJwtApp(app: FastifyInstance) {
  _app = app
}

export function verifyToken(token: string): { userId: string; username: string; role: string; isAdmin: boolean } | null {
  if (!_app) return null
  try {
    const decoded: any = _app.jwt.verify(token)
    return { userId: decoded.userId, username: decoded.username, role: decoded.role, isAdmin: !!decoded.isAdmin }
  } catch {
    return null
  }
}

export default async function adminAuthRoutes(app: FastifyInstance) {
  const { prisma } = await import('../utils/index.js')

  // 保存 app 引用供 verifyToken 使用
  setJwtApp(app)

  // Login
  app.post('/api/v1/admin/login', async (req, reply) => {
    const body = req.body as { email?: string; username?: string; password: string }
    const { password } = body
    const loginId = body.email || body.username || ''

    // 支持 email 或 username 登录
    const user = loginId.includes('@')
      ? await prisma.adminUser.findFirst({ where: { email: loginId } as any })
      : await prisma.adminUser.findUnique({ where: { username: loginId } })
    if (!user) return reply.status(401).send({ error: '账号或密码错误' })
    if (!user.enabled) return reply.status(403).send({ error: '账号已被禁用' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: '账号或密码错误' })

    // 签发 JWT（重启 / cluster 下也有效）
    const token = app.jwt.sign({
      userId: user.id,
      username: user.username,
      role: user.role,
      isAdmin: true,
    }, { expiresIn: '24h' })
    return {
      token,
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    }
  })

  // Me
  app.get('/api/v1/admin/me', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const user = await prisma.adminUser.findUnique({ where: { username: decoded.username } })
    if (!user) return reply.status(401).send({ error: '用户不存在' })

    return { id: user.id, username: user.username, displayName: user.displayName, role: user.role }
  })

  // List all admins
  app.get('/api/v1/admin/admins', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const decoded = verifyToken(auth.slice(7))
    if (!decoded || decoded.role !== 'superadmin') return reply.status(403).send({ error: '仅超级管理员可操作' })

    const admins = await prisma.adminUser.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, username: true, displayName: true, role: true, enabled: true, createdAt: true },
    })

    return { admins }
  })

  // Create admin
  app.post('/api/v1/admin/admins', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const decoded = verifyToken(auth.slice(7))
    if (!decoded || decoded.role !== 'superadmin') return reply.status(403).send({ error: '仅超级管理员可操作' })

    const { username, password, displayName, role } = req.body as any

    const exists = await prisma.adminUser.findUnique({ where: { username } })
    if (exists) return reply.status(409).send({ error: '账号已存在' })

    const hash = await bcrypt.hash(password, 10)
    await prisma.adminUser.create({
      data: { username, passwordHash: hash, displayName, role: role || 'operator' },
    })

    return { success: true, message: '管理员创建成功' }
  })

  // Change own password
  app.put('/api/v1/admin/password', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const decoded = verifyToken(auth.slice(7))
    if (!decoded) return reply.status(401).send({ error: 'token 无效或已过期' })

    const { currentPassword, newPassword } = req.body as any

    const user = await prisma.adminUser.findUnique({ where: { username: decoded.username } })
    if (!user) return reply.status(404).send({ error: '用户不存在' })

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) return reply.status(400).send({ error: '当前密码错误' })

    const hash = await bcrypt.hash(newPassword, 10)
    await prisma.adminUser.update({
      where: { username: decoded.username },
      data: { passwordHash: hash },
    })

    return { success: true, message: '密码修改成功' }
  })

  // Update admin (superadmin only)
  app.put('/api/v1/admin/admins/:id', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const decoded = verifyToken(auth.slice(7))
    if (!decoded || decoded.role !== 'superadmin') return reply.status(403).send({ error: '仅超级管理员可操作' })

    const { id } = req.params as { id: string }
    const body = req.body as any

    const data: any = {}
    if (body.displayName !== undefined) data.displayName = body.displayName
    if (body.role !== undefined) data.role = body.role
    if (body.enabled !== undefined) data.enabled = body.enabled
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10)

    await prisma.adminUser.update({ where: { id: parseInt(id) }, data })
    return { success: true, message: '更新成功' }
  })

  // Delete admin
  app.delete('/api/v1/admin/admins/:id', async (req, reply) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const decoded = verifyToken(auth.slice(7))
    if (!decoded || decoded.role !== 'superadmin') return reply.status(403).send({ error: '仅超级管理员可操作' })

    const { id } = req.params as { id: string }
    const user = await prisma.adminUser.findUnique({ where: { id: parseInt(id) } })
    if (!user) return reply.status(404).send({ error: '用户不存在' })
    if (user.username === decoded.username) return reply.status(400).send({ error: '不能删除自己' })

    await prisma.adminUser.delete({ where: { id: parseInt(id) } })
    return { success: true, message: '删除成功' }
  })

  // Logout
  app.post('/api/v1/admin/logout', async (req, reply) => {
    return { success: true }
  })

  // GET /api/v1/admin/projects — 管理员查看所有项目
  app.get('/api/v1/admin/projects', { preHandler: [app.authenticate] }, async (req, reply) => {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true, version: true, createdAt: true, updatedAt: true },
    })
    return { success: true, data: projects }
  })

  // GET /api/v1/admin/users — 会员列表（同步真实数据到后台）
  app.get('/api/v1/admin/users', { preHandler: [app.authenticate] }, async (req, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { membership: true },
    })
    return { success: true, data: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      phone: u.phone || '—',
      membership: u.membership?.tier || 'free',
      vip: u.memberTier !== 'free' ? (u.memberTier === 'premium' ? '黄金会员' : u.memberTier === 'vip_year' ? '钻石会员' : u.memberTier === 'vip_test' ? '白银会员' : u.memberTier) : '',
      status: 'active',
      createdAt: u.createdAt,
      coins: u.coins,
      credits: u.membership?.credits || 0,
      memberExpiresAt: u.memberExpiresAt,
    })) }
  })

}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

