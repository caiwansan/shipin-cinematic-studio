import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { approvePost, rejectPost, softDeletePost, getActiveModerator } from '../../services/community/moderation.service.js'

/**
 * COMMUNITY-MODERATOR-01 社区版主体系（掌柜 2026-08-07）
 * - 会员申请成为版主（POST /api/community/moderator/apply）
 * - 版主管理帖子：审核通过/驳回/加精/置顶/删帖（JWT + active 版主）
 * - 站长审批申请：GET /api/community/admin/moderator/applications + approve/reject + 卸任
 * - 角色：moderator=版主 / co_moderator=副版主（权限相同，称号区分；审批时站长指定）
 */
export default async function communityModeratorRoutes(fastify: FastifyInstance) {
  // 站长鉴权（AdminUser + x-admin-token，与 posts.ts adminCheck 一致）
  async function adminCheck(request: any, reply: any) {
    const token = request.headers['x-admin-token']
    if (!token) return reply.status(401).send({ error: '未登录' })
    try {
      const decoded: any = fastify.jwt.verify(token)
      const user = await prisma.adminUser.findUnique({ where: { username: decoded.username } })
      if (!user) return reply.status(401).send({ error: '管理员不存在' })
      request.adminUser = user
    } catch (e) {
      return reply.status(401).send({ error: 'Token 无效或已过期' })
    }
  }

  // 版主鉴权：先走 fastify.authenticate（JWT + tokenVersion），再校验 active 版主身份
  async function moderatorCheck(request: any, reply: any) {
    const userId = (request.user as any)?.id
    if (!userId) return reply.status(401).send({ error: '未登录' })
    const mod = await getActiveModerator(userId)
    if (!mod) return reply.status(403).send({ error: '需要版主权限' })
    request.moderator = mod
  }

  // ── 公开：在职版主列表 ──
  fastify.get('/api/community/moderators', async (request, reply) => {
    const mods = await prisma.communityModerator.findMany({
      where: { status: 'active' },
      orderBy: [{ role: 'asc' }, { approvedAt: 'asc' }],
    })
    const users = await prisma.user.findMany({
      where: { id: { in: mods.map(m => m.userId) } },
      select: { id: true, nickname: true, username: true, avatarUrl: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))
    return {
      moderators: mods.map(m => {
        const u = userMap.get(m.userId)
        return {
          userId: m.userId,
          role: m.role,
          nickname: u?.nickname || u?.username || '社区用户',
          avatarUrl: u?.avatarUrl || null,
          approvedAt: m.approvedAt,
        }
      }),
    }
  })

  // ── 我的版主身份（JWT）──
  fastify.get('/api/community/moderator/me', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const userId = (request.user as any)?.id
    const mod = await prisma.communityModerator.findUnique({ where: { userId } })
    return {
      isModerator: !!mod && mod.status === 'active',
      role: mod?.role || null,
      status: mod?.status || null,
      applyNote: mod?.applyNote || null,
    }
  })

  // ── 会员申请成为版主（JWT）──
  fastify.post('/api/community/moderator/apply', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const userId = (request.user as any)?.id
    const body = (request.body || {}) as { note?: string }
    const applyNote = (body.note || '').toString().trim().slice(0, 200)

    const existing = await prisma.communityModerator.findUnique({ where: { userId } })
    if (existing) {
      if (existing.status === 'active') {
        return reply.status(409).send({ error: '您已是社区版主，无需重复申请' })
      }
      if (existing.status === 'pending') {
        return reply.status(409).send({ error: '申请处理中，请耐心等待' })
      }
      if (existing.status === 'removed') {
        return reply.status(409).send({ error: '您已被卸任，暂不能重新申请' })
      }
      // rejected → 允许重申
      await prisma.communityModerator.update({
        where: { id: existing.id },
        data: { status: 'pending', applyNote, approvedBy: null, approvedAt: null },
      })
      return { success: true, status: 'pending', reapplied: true }
    }

    const mod = await prisma.communityModerator.create({
      data: { userId, role: 'moderator', status: 'pending', applyNote },
    })
    return { success: true, status: mod.status, id: mod.id }
  })

  // ── 站长：申请列表 ──
  fastify.get('/api/community/admin/moderator/applications', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const list = await prisma.communityModerator.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const users = await prisma.user.findMany({
      where: { id: { in: list.map(m => m.userId) } },
      select: { id: true, nickname: true, username: true, avatarUrl: true, email: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))
    return {
      applications: list.map(m => {
        const u = userMap.get(m.userId)
        return {
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          applyNote: m.applyNote,
          approvedBy: m.approvedBy,
          approvedAt: m.approvedAt,
          createdAt: m.createdAt,
          nickname: u?.nickname || u?.username || '社区用户',
          username: u?.username || '',
          avatarUrl: u?.avatarUrl || null,
        }
      }),
    }
  })

  // ── 站长：批准申请（指定角色 moderator / co_moderator）──
  fastify.patch('/api/community/admin/moderator/applications/:id/approve', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as { role?: string }
    const role = body.role === 'co_moderator' ? 'co_moderator' : 'moderator'
    const mod = await prisma.communityModerator.findUnique({ where: { id } })
    if (!mod) return reply.status(404).send({ error: '申请不存在' })
    if (mod.status === 'active') return reply.status(409).send({ error: '已是版主' })

    await prisma.communityModerator.update({
      where: { id },
      data: { status: 'active', role, approvedBy: request.adminUser?.username || 'admin', approvedAt: new Date() },
    })
    return { success: true, role }
  })

  // ── 站长：驳回申请 ──
  fastify.patch('/api/community/admin/moderator/applications/:id/reject', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const mod = await prisma.communityModerator.findUnique({ where: { id } })
    if (!mod) return reply.status(404).send({ error: '申请不存在' })
    await prisma.communityModerator.update({
      where: { id },
      data: { status: 'rejected', approvedBy: request.adminUser?.username || 'admin', approvedAt: new Date() },
    })
    return { success: true }
  })

  // ── 站长：卸任（在职 → removed）──
  fastify.patch('/api/community/admin/moderators/:id/remove', { preHandler: [adminCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const mod = await prisma.communityModerator.findUnique({ where: { id } })
    if (!mod) return reply.status(404).send({ error: '版主不存在' })
    await prisma.communityModerator.update({
      where: { id },
      data: { status: 'removed', approvedBy: request.adminUser?.username || 'admin', approvedAt: new Date() },
    })
    return { success: true }
  })

  // ── 版主：管理列表（默认待审）──
  fastify.get('/api/community/moderator/posts', { preHandler: [fastify.authenticate, moderatorCheck] }, async (request: any, reply: any) => {
    const query = request.query as { status?: string; page?: string; pageSize?: string }
    const status = query.status || 'pending'
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize || '20', 10) || 20))
    const where: any = { status }
    if (status === 'deleted') {
      // 已删除帖也允许版主查看（含 status=deleted）
      where.status = 'deleted'
    }
    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.communityPost.count({ where }),
    ])
    const userIds = [...new Set(posts.map(p => p.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, username: true, avatarUrl: true },
    })
    const userMap = new Map(users.map(u => [u.id, u]))
    return {
      posts: posts.map(p => ({
        ...p,
        author: userMap.get(p.userId)
          ? {
              nickname: userMap.get(p.userId)!.nickname || userMap.get(p.userId)!.username,
              avatarUrl: userMap.get(p.userId)!.avatarUrl,
            }
          : null,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  })

  // ── 版主：审核通过 ──
  fastify.patch('/api/community/moderator/posts/:id/approve', { preHandler: [fastify.authenticate, moderatorCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const reviewedBy = `版主:${request.moderator.role === 'co_moderator' ? '副版主' : '版主'}`
    const r = await approvePost(id, reviewedBy)
    if (!r.ok) return reply.status(404).send({ error: r.error })
    return { success: true }
  })

  // ── 版主：驳回 ──
  fastify.patch('/api/community/moderator/posts/:id/reject', { preHandler: [fastify.authenticate, moderatorCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as { reason?: string }
    const reviewedBy = `版主:${request.moderator.role === 'co_moderator' ? '副版主' : '版主'}`
    const r = await rejectPost(id, reviewedBy, body.reason?.toString().trim().slice(0, 200) || undefined)
    if (!r.ok) return reply.status(404).send({ error: r.error })
    return { success: true }
  })

  // ── 版主：置顶/取消置顶 ──
  fastify.patch('/api/community/moderator/posts/:id/pin', { preHandler: [fastify.authenticate, moderatorCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const post = await prisma.communityPost.findUnique({ where: { id }, select: { isPinned: true } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const isPinned = !post.isPinned
    await prisma.communityPost.update({ where: { id }, data: { isPinned } })
    return { success: true, isPinned }
  })

  // ── 版主：加精/取消加精 ──
  fastify.patch('/api/community/moderator/posts/:id/essence', { preHandler: [fastify.authenticate, moderatorCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const post = await prisma.communityPost.findUnique({ where: { id }, select: { isEssence: true } })
    if (!post) return reply.status(404).send({ error: '帖子不存在' })
    const isEssence = !post.isEssence
    await prisma.communityPost.update({ where: { id }, data: { isEssence } })
    return { success: true, isEssence }
  })

  // ── 版主：删帖（软删，保留数据可追溯）──
  fastify.delete('/api/community/moderator/posts/:id', { preHandler: [fastify.authenticate, moderatorCheck] }, async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const reviewedBy = `版主:${request.moderator.role === 'co_moderator' ? '副版主' : '版主'}`
    const r = await softDeletePost(id, reviewedBy)
    if (!r.ok) return reply.status(404).send({ error: r.error })
    return { success: true }
  })
}
