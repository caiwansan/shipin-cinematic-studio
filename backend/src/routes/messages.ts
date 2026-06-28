import type { ApiResponse } from '../contracts/api/base.js';
// 私信系统 API
import { FastifyInstance } from 'fastify'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js';

export default async function (fastify: FastifyInstance) {
  const prisma = (fastify as any).prisma

  // 管理员发私信
  fastify.post('/api/messages/send', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { id: fromId } = request.user
    const { toId, content, media } = request.body

    if (!toId || !content) {
      return reply.status(400).send({ error: '收件人和内容不能为空' })
    }

    const toUser = await prisma.user.findUnique({ where: { id: toId }, select: { id: true } })
    if (!toUser) return reply.status(404).send({ error: '用户不存在' })

    const msg = await prisma.userMessage.create({
      data: { fromId, toId, content, media: media || null },
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } },
      },
    })
    return toApiResponse({success: true, message: msg}) satisfies ApiResponse<unknown>;
  })

  // 获取会话列表
  fastify.get('/api/messages/conversations', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user

    const messages = await prisma.userMessage.findMany({
      where: {
        OR: [{ fromId: userId }, { toId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { id: true, username: true } },
        toUser: { select: { id: true, username: true } },
      },
    })

    const conversations = new Map()
    for (const msg of messages) {
      const otherId = msg.fromId === userId ? msg.toId : msg.fromId
      if (!conversations.has(otherId)) {
        conversations.set(otherId, {
          userId: otherId,
          username: msg.fromId === userId ? msg.toUser.username : msg.fromUser.username,
          lastMessage: msg.content,
          lastTime: msg.createdAt,
          unread: (!msg.read && msg.toId === userId) ? 1 : 0,
        })
      } else {
        const conv = conversations.get(otherId)
        if (!msg.read && msg.toId === userId) conv.unread++
      }
    }

    return toApiResponse({conversations: Array.from(conversations.values()).sort((a: any, b: any) =>
        new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
      ),}) satisfies ApiResponse<unknown>;
  })

  // 获取和某人的聊天记录
  fastify.get('/api/messages/:userId', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { id: myId } = request.user
    const { userId } = request.params
    const page = Math.max(1, parseInt(request.query.page || '1', 10) || 1)
    const pageSize = Math.min(50, parseInt(request.query.pageSize || '20', 10) || 20)

    const where = {
      OR: [
        { fromId: myId, toId: userId },
        { fromId: userId, toId: myId },
      ],
    }

    const [messages, total] = await Promise.all([
      prisma.userMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          fromUser: { select: { id: true, username: true } },
        },
      }),
      prisma.userMessage.count({ where }),
    ])

    await prisma.userMessage.updateMany({
      where: { toId: myId, fromId: userId, read: false },
      data: { read: true },
    })

    return {
      messages: messages.reverse(),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  })

  // 未读消息数
  fastify.get('/api/messages/unread/count', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const count = await prisma.userMessage.count({
      where: { toId: userId, read: false },
    })
    return toApiResponse({count}) satisfies ApiResponse<unknown>;
  })

  // 删除私信
  fastify.delete('/api/messages/:id', { preHandler: [(fastify as any).authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { id } = request.params

    const msg = await prisma.userMessage.findUnique({ where: { id } })
    if (!msg) return reply.status(404).send({ error: '消息不存在' })
    if (msg.toId !== userId && msg.fromId !== userId) {
      return reply.status(403).send({ error: '无权删除' })
    }

    await prisma.userMessage.delete({ where: { id } })
    return toApiResponse({success: true}) satisfies ApiResponse<unknown>;
  })

  // 搜索用户（用于私信选人）
  fastify.get('/api/messages/users/search', async (request: any, reply: any) => {
    const q = (request.query as any).q || ''
    if (!q || q.length < 2) return toApiResponse({users: []}) satisfies ApiResponse<unknown>;
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, username: true, email: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })
    return toApiResponse({users}) satisfies ApiResponse<unknown>;
  })
}
