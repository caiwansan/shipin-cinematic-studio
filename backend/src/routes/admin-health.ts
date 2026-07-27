/**
 * routes/admin-health.ts — Beta 运营健康检查
 * Sprint 4.3.3
 *
 * 轻量监控：企业状态、Agent 运行、失败任务、渠道异常
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminHealthRoutes(app: FastifyInstance) {

  /**
   * GET /api/admin/health
   * Beta 运营健康看板
   */
  app.get('/api/admin/health', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const now = Date.now()
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000)
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000)

      const [
        totalEnterprises,
        activeAgents,
        failedTasks24h,
        staleEnterprises,
        channelAccounts,
        activeProviders,
        recentErrors,
      ] = await Promise.all([
        // 企业总数
        prisma.organization.count(),
        // 活跃 Agent
        prisma.enterpriseAgentInstance.count({ where: { runtimeStatus: 'active' } }),
        // 24h 失败任务
        prisma.enterpriseAgentTask.count({
          where: { status: 'failed', startedAt: { gte: oneDayAgo } },
        }),
        // 3 天未活跃企业（有 agent 但无任务）
        prisma.enterpriseAgentInstance.count({
          where: { runtimeStatus: 'active', lastActiveAt: { lt: threeDaysAgo } },
        }),
        // 渠道状态
        prisma.enterpriseChannelAccount.count(),
        // 有效模型配置（使用 provider_state 表）
        prisma.providerState.count(),
        // 近 24h 错误任务
        prisma.enterpriseAgentTask.count({
          where: { status: 'failed', startedAt: { gte: oneDayAgo } },
        }),
      ])

      // 渠道连接状态
      const channelStatuses = await prisma.enterpriseChannelAccount.groupBy({
        by: ['connectionStatus'],
        _count: { id: true },
      })

      return reply.send({
        code: 0,
        message: 'success',
        data: {
          timestamp: new Date().toISOString(),
          overview: {
            totalEnterprises,
            activeAgents,
            failedTasks24h,
            staleAgents: staleEnterprises,
            activeProviders,
            totalChannels: channelAccounts,
          },
          channels: channelStatuses.map(c => ({
            status: c.connectionStatus,
            count: c._count.id,
          })),
          alerts: [
            failedTasks24h > 10 ? `近 24h 有 ${failedTasks24h} 个任务失败` : null,
            staleEnterprises > 0 ? `${staleEnterprises} 个 Agent 3 天未活跃` : null,
          ].filter(Boolean),
        },
      })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' })
    }
  })
}
