import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function assetRoutes(fastify: FastifyInstance) {
  // GET /assets — 获取当前用户的作品列表（个人空间）
  fastify.get('/assets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { type, page = '1', pageSize = '20' } = request.query as any

    const where: any = { userId }
    if (type && type !== 'all') where.type = type

    const [data, total] = await Promise.all([
      prisma.userAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.userAsset.count({ where }),
    ])

    return { data, total, page: Number(page), pageSize: Number(pageSize) }
  })

  // GET /api/assets/:id
  fastify.get('/assets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const asset = await prisma.userAsset.findUnique({ where: { id } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })
    return asset
  })

  // DELETE /api/assets/:id — 删除作品
  fastify.delete('/assets/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { id } = request.params as any

    const asset = await prisma.userAsset.findUnique({ where: { id } })
    if (!asset) return reply.status(404).send({ error: '作品不存在' })
    if (asset.userId !== userId) return reply.status(403).send({ error: '无权限' })

    await prisma.userAsset.delete({ where: { id } })
    return { success: true }
  })

  // POST /assets/user-asset — 保存生成的素材到个人资产
  fastify.post('/assets/user-asset', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { title, type, url, prompt, source } = request.body as any
    if (!url) return reply.status(400).send({ error: '缺少素材 URL' })
    const asset = await prisma.userAsset.create({
      data: {
        userId,
        title: title || '未命名素材',
        type: type || 'image',
        url,
        prompt: prompt || '',
        fileSize: 0,
        source: source || 'user_upload',
      },
    })
    return { success: true, data: { id: asset.id, url: asset.url } }
  })
}
