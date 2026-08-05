import type { FastifyInstance, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'

/**
 * USER-FOLLOW-01 关注体系（2026-08-06 掌柜定稿）
 * 好友 = 关注关系：单方面关注 / 互相关注
 * - 会员中心昵称卡片积分下方：关注数 / 粉丝数
 * - 好友列表：我关注的 + 关注我的（含互相关注）
 */
export default async function userFollowRoutes(fastify: FastifyInstance) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  async function userDisplay(userId: string) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, avatarUrl: true, lastActiveAt: true },
    })
    if (!u) return null
    const presence = await prisma.imUserPresence.findUnique({ where: { uid: u.id } })
    return {
      id: u.id,
      name: u.username || u.email.split('@')[0],
      email: u.email,
      avatar: u.avatarUrl || '',
      online: presence?.online ?? false,
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    }
  }

  // POST /api/user/follow — 关注（幂等；不能关注自己）
  fastify.post('/api/user/follow', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { targetId } = (request.body as any) || {}
    if (!targetId || !uuidRe.test(targetId)) {
      return reply.status(400).send({ success: false, error: 'targetId 必填' })
    }
    if (targetId === userId) {
      return reply.status(400).send({ success: false, error: '不能关注自己' })
    }
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } })
    if (!target) {
      return reply.status(404).send({ success: false, error: '用户不存在' })
    }
    await prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId: userId, followingId: targetId } },
      create: { followerId: userId, followingId: targetId },
      update: {},
    })
    // 是否互相关注
    const mutual = !!(await prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: targetId, followingId: userId } },
      select: { id: true },
    }))
    return toApiResponse({ success: true, following: true, mutual }) satisfies unknown
  })

  // POST /api/user/unfollow — 取关（幂等）
  fastify.post('/api/user/unfollow', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { targetId } = (request.body as any) || {}
    if (!targetId || !uuidRe.test(targetId)) {
      return reply.status(400).send({ success: false, error: 'targetId 必填' })
    }
    await prisma.userFollow.deleteMany({ where: { followerId: userId, followingId: targetId } })
    return toApiResponse({ success: true, following: false }) satisfies unknown
  })

  // GET /api/user/follow/stats — 关注/粉丝统计（会员中心昵称卡片）
  fastify.get('/api/user/follow/stats', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const [followingCount, followerCount] = await Promise.all([
      prisma.userFollow.count({ where: { followerId: userId } }),
      prisma.userFollow.count({ where: { followingId: userId } }),
    ])
    return toApiResponse({ followingCount, followerCount }) satisfies unknown
  })

  // GET /api/user/follow/list?type=following|follower|all — 好友列表
  // following=我关注的 / follower=关注我的 / all=合并（好友 tab 数据源）
  fastify.get('/api/user/follow/list', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const type = (request.query as any).type || 'all'
    const [following, followers] = await Promise.all([
      prisma.userFollow.findMany({ where: { followerId: userId }, select: { followingId: true }, orderBy: { createdAt: 'desc' } }),
      prisma.userFollow.findMany({ where: { followingId: userId }, select: { followerId: true }, orderBy: { createdAt: 'desc' } }),
    ])
    const followingSet = new Set(following.map((f) => f.followingId))
    const followerSet = new Set(followers.map((f) => f.followerId))
    let idSet: Set<string>
    if (type === 'following') idSet = followingSet
    else if (type === 'follower') idSet = followerSet
    else {
      idSet = new Set([...followingSet, ...followerSet])
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [...idSet] } },
      select: { id: true, username: true, email: true, avatarUrl: true, lastActiveAt: true },
    })
    const presences = await prisma.imUserPresence.findMany({ where: { uid: { in: [...idSet] } } })
    const presenceMap = new Map(presences.map((p) => [p.uid, p.online]))
    const data = users
      .map((u) => {
        const isFollowing = followingSet.has(u.id)
        const isFollower = followerSet.has(u.id)
        return {
          id: u.id,
          name: u.username || u.email.split('@')[0],
          email: u.email,
          avatar: u.avatarUrl || '',
          online: presenceMap.get(u.id) ?? false,
          lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
          relation: isFollowing && isFollower ? 'mutual' : isFollowing ? 'following' : 'follower',
        }
      })
      .sort((a, b) => {
        const rank = (r: string) => (r === 'mutual' ? 0 : r === 'following' ? 1 : 2)
        if (rank(a.relation) !== rank(b.relation)) return rank(a.relation) - rank(b.relation)
        if (a.online !== b.online) return a.online ? -1 : 1
        return (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
      })
    return toApiResponse({ users: data }) satisfies unknown
  })

  // POST /api/user/follow/status — 批量查询我对这些人的关注状态（名录/资料卡点亮）
  fastify.post('/api/user/follow/status', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const { targetIds } = (request.body as any) || {}
    const list = Array.isArray(targetIds)
      ? [...new Set(targetIds.filter((id: any) => typeof id === 'string' && uuidRe.test(id)))].slice(0, 200)
      : []
    if (!list.length) return toApiResponse({ status: {} }) satisfies unknown
    const rows = await prisma.userFollow.findMany({
      where: { followerId: userId, followingId: { in: list } },
      select: { followingId: true },
    })
    const status: Record<string, boolean> = {}
    for (const id of list) status[id] = false
    for (const r of rows) status[r.followingId] = true
    return toApiResponse({ status }) satisfies unknown
  })

  // GET /api/user/follow/mutual-ids — 互相关注 uid 集合（前端好友 tab 排序/标注）
  fastify.get('/api/user/follow/mutual-ids', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const userId = request.user.id as string
    const [following, followers] = await Promise.all([
      prisma.userFollow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
      prisma.userFollow.findMany({ where: { followingId: userId }, select: { followerId: true } }),
    ])
    const followingSet = new Set(following.map((f) => f.followingId))
    const mutual = followers.filter((f) => followingSet.has(f.followerId)).map((f) => f.followerId)
    return toApiResponse({ mutual }) satisfies unknown
  })
}
