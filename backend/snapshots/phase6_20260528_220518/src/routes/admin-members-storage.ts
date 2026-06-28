/**
 * admin-members-storage.ts — 会员存储信息 API（用于 COS 用户存储页面）
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function adminMembersStorageRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/members-storage', async (request: any, reply: any) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        membership: true,
      },
    })

    // 聚合每个用户的文件存储信息
    const result = await Promise.all(users.map(async (user) => {
      // 查询该用户所有 asset 的 fileSize 总和
      const agg = await prisma.userAsset.aggregate({
        where: { userId: user.id },
        _sum: { fileSize: true },
      })
      // 查 asset 总数量
      const fileCount = await prisma.userAsset.count({
        where: { userId: user.id },
      })

      const storageUsed = Number(agg._sum.fileSize || 0)
      const storageLimit = user.membership?.storageLimit
        ? Number(user.membership.storageLimit) * 1024 * 1024
        : 100 * 1024 * 1024 // 默认 100MB
      const memberTier = user.membership?.tier || 'free'

      return {
        id: user.id,
        userId: user.id,
        username: user.username || user.email?.split('@')[0] || '未命名',
        email: user.email,
        phone: '',
        memberTier,
        coins: Number(user.coins || 0),
        createdAt: user.createdAt,
        storageUsed,
        storageLimit,
        fileCount,
        quota: storageLimit,
        usedBytes: storageUsed,
        files: fileCount,
      }
    }))

    return { success: true, data: result }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};
