import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function communityLikeRoutes(fastify: FastifyInstance) {
  // POST /api/community/likes — 点赞/取消点赞（toggle）
  fastify.post('/api/community/likes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { postId, commentId } = request.body as {
      postId?: string
      commentId?: string
    }

    if (!postId && !commentId) {
      return reply.status(400).send({ error: '请指定 postId 或 commentId' })
    }

    if (postId) {
      // 帖子点赞 toggle
      const existing = await prisma.communityLike.findUnique({
        where: { postId_userId: { postId, userId } },
      })

      if (existing) {
        // 取消点赞
        await prisma.communityLike.delete({ where: { id: existing.id } })
        await prisma.communityPost.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
        })
        return { liked: false }
      } else {
        // 点赞
        await prisma.communityLike.create({
          data: { postId, userId },
        })
        await prisma.communityPost.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
        })
        return { liked: true }
      }
    }

    if (commentId) {
      // 评论点赞 toggle
      const existing = await prisma.communityCommentLike.findUnique({
        where: { commentId_userId: { commentId, userId } },
      })

      if (existing) {
        await prisma.communityCommentLike.delete({ where: { id: existing.id } })
        await prisma.communityComment.update({
          where: { id: commentId },
          data: { likeCount: { decrement: 1 } },
        })
        return { liked: false }
      } else {
        await prisma.communityCommentLike.create({
          data: { commentId, userId },
        })
        await prisma.communityComment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
        })
        return { liked: true }
      }
    }
  })

  // GET /api/community/posts/:id/likes/status — 当前用户点赞状态
  fastify.get('/api/community/posts/:id/likes/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { id: postId } = request.params as { id: string }

    const liked = await prisma.communityLike.findUnique({
      where: { postId_userId: { postId, userId } },
    })

    return { liked: !!liked }
  })
}
