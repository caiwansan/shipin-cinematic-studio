/**
 * enterprise-home.ts — 企业首页 API
 *
 * CTO Directive: Enterprise Overview Domain Separation
 * - GET /api/enterprise/home
 * - 只接受普通企业 JWT（不 requireAdmin）
 * - 返回当前企业自己的数据
 * - 不引用 Admin Repository / Admin Mapper
 *
 * CTO Directive: Enterprise Identity Binding
 * JWT user.id → getEnterpriseContext() → enterpriseId
 * 不再使用 user.tenantId / user.enterpriseId / user.id 作为 fallback
 */

import type { FastifyInstance } from 'fastify'
import { enterpriseHomeRepository } from '../repositories/recruitment/enterprise-home.repository.js'
import { mapEnterpriseHome } from '../mappers/recruitment/enterprise-home.mapper.js'
import { getEnterpriseContext } from '../repositories/recruitment/enterprise-member.repository.js'

export async function enterpriseHomeRoutes(app: FastifyInstance) {
  // 所有企业接口都需要 JWT 认证（普通用户 JWT，非 admin）
  app.addHook('preHandler', app.authenticate)

  // GET /api/enterprise/home — 企业招聘中心首页数据
  app.get('/api/enterprise/home', async (request, reply) => {
    try {
      const user = request.user as any
      const userId = user?.id

      if (!userId) {
        return reply.status(401).send({ error: '未授权', message: 'token 无效' })
      }

      // 通过 EnterpriseMember 关联获取企业上下文
      const context = await getEnterpriseContext(userId)

      if (!context) {
        // 无企业成员关系 → 返回空状态提示
        return reply.status(200).send({
          hasEnterprise: false,
          message: '请先创建或加入企业',
          todayMetrics: { conversations: 0, interviews: 0, campaigns: 0, newResumes: 0, offers: 0, hires: 0 },
          funnel: [],
          needsAttention: [],
          activityFeed: [],
          departmentHealth: { status: 'unknown', message: '请先创建或加入企业', activeCount: 0, pausedCount: 0 },
        })
      }

      // 计算今日零点
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const rawData = await enterpriseHomeRepository.fetchHomeData({
        enterpriseId: context.enterpriseId,
        today,
      })

      const dto = mapEnterpriseHome(rawData)

      return reply.send({ hasEnterprise: true, ...dto })
    } catch (error: any) {
      request.log.error({ err: error }, 'Failed to fetch enterprise home')
      return reply.status(500).send({
        error: 'Failed to fetch enterprise home',
        message: error.message,
      })
    }
  })
}
