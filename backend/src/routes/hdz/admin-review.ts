import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { loadReviewConfig } from '../../services/hdz/reviewer.service.js'

/**
 * admin-review.ts — 横刀评分后台管理路由
 *
 * GET  /api/admin/hdz/review-config    读取评分阈值
 * PUT  /api/admin/hdz/review-config    更新评分阈值
 */

export default async function adminReviewRoutes(app: FastifyInstance) {
  // GET — 读取评分阈值
  app.get('/api/admin/hdz/review-config', {
    preHandler: [app.authenticate],
  }, async (_request, _reply) => {
    const row = await prisma.routeConfig.findFirst({
      where: { scope: 'route:hdz-reviewer-config', key: 'review-threshold' },
    })
    const passScore = (row?.value as any)?.passScore ?? 80
    return { success: true, data: { passScore } }
  })

  // PUT — 更新评分阈值
  app.put('/api/admin/hdz/review-config', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user as any
    // 检查 admin 权限
    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return reply.status(403).send({ success: false, error: '需要管理员权限' })
    }
    const { passScore } = request.body as any
    if (typeof passScore !== 'number' || passScore < 0 || passScore > 100) {
      return reply.status(400).send({ success: false, error: 'passScore 必须是 0-100 的整数' })
    }

    const existing = await prisma.routeConfig.findFirst({
      where: { scope: 'route:hdz-reviewer-config', key: 'review-threshold' },
    })

    if (existing) {
      await prisma.routeConfig.update({
        where: { id: existing.id },
        data: { value: { passScore } },
      })
    } else {
      await prisma.routeConfig.create({
        data: {
          scope: 'route:hdz-reviewer-config',
          key: 'review-threshold',
          value: { passScore },
          label: '横刀评分通过线',
        },
      })
    }

    // 重新加载评分配置
    await loadReviewConfig()

    return { success: true, data: { passScore } }
  })
}
