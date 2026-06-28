import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { containsSensitiveWord } from '../../services/community/sensitive-word.service.js'
import { rewardComment } from '../../services/community/community-reward.service.js'

export default async function communityCommentRoutes(fastify: FastifyInstance) {
  // POST /api/community/comments — 发表评论（需认证）
  fastify.post('/api/community/comments', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { postId, content, parentId } = request.body as {
      postId: string
      content: string
      parentId?: string
    }

    if (!postId) {
      return reply.status(400).send({ error: 'postId 不能为空' })
    }
    if (!content || !content.trim()) {
      return reply.status(400).send({ error: '评论内容不能为空' })
    }
    if (content.length > 5000) {
      return reply.status(400).send({ error: '评论不能超过5000个字符' })
    }

    // 检查帖子是否存在
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { id: true },
    })
    if (!post) {
      return reply.status(404).send({ error: '帖子不存在' })
    }

    // 敏感词检查
    const sensitiveWord = await containsSensitiveWord(content)
    if (sensitiveWord) {
      return reply.status(400).send({ error: `评论包含敏感词: ${sensitiveWord}` })
    }

    // 如果提供了 parentId，验证父评论是否存在
    if (parentId) {
      const parentComment = await prisma.communityComment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true },
      })
      if (!parentComment || parentComment.postId !== postId) {
        return reply.status(400).send({ error: '父评论不存在或不属于该帖子' })
      }
    }

    const comment = await prisma.communityComment.create({
      data: {
        postId,
        userId,
        content: content.trim(),
        parentId: parentId || null,
      },
    })

    // 更新帖子的评论数
    await prisma.communityPost.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    })

    // 积分奖励
    try {
      await rewardComment(userId)
    } catch (err) {
      console.warn('[Community] Failed to reward comment:', err)
    }

    return { comment }
  })

  // DELETE /api/community/comments/:id — 删除评论（需认证+作者本人）
  fastify.delete('/api/community/comments/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = (request as any).user
    const { id } = request.params as { id: string }

    const comment = await prisma.communityComment.findUnique({
      where: { id },
      select: { userId: true, postId: true },
    })

    if (!comment) {
      return reply.status(404).send({ error: '评论不存在' })
    }
    if (comment.userId !== userId) {
      return reply.status(403).send({ error: '只能删除自己的评论' })
    }

    await prisma.communityComment.delete({ where: { id } })

    // 减少帖子评论数
    await prisma.communityPost.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    })

    return { success: true }
  })
}
