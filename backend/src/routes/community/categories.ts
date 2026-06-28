import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function communityCategoryRoutes(fastify: FastifyInstance) {
  // GET /api/community/categories — 返回所有分类（排序 sortOrder）
  fastify.get('/api/community/categories', async (_request, _reply) => {
    const categories = await prisma.communityCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        icon: true,
        sortOrder: true,
        postCount: true,
      },
    })
    return { categories }
  })
}
