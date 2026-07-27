// routes/enterprise-health.ts — 企业数字部门健康中心
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'

export default async function enterpriseHealthRoutes(app: FastifyInstance) {

  // GET /api/enterprise/health — 企业数字部门健康状态
  app.get('/api/enterprise/health', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))

      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          profile: true,
          subscription: { include: { plan: true } },
          aiProviders: true,
        },
      })

      if (!org) return reply.status(404).send(toApiResponse({ success: false, message: '企业不存在' }))

      // 1. 企业基础
      const orgReady = !!org.profile?.businessSummary

      // 2. AI 员工
      const agents = await prisma.enterpriseAgentInstance.findMany({
        where: { tenantId: orgId },
        include: { profile: true },
      })
      const agentStatus = agents.map((a: any) => ({
        id: a.id,
        name: a.profile?.displayName || a.profile?.name || '未命名',
        role: a.role,
        status: a.status,
        hasProfile: !!a.profile,
        hasSoul: !!a.profile?.soul,
        hasHermesBinding: !!a.hermesProfileId,
      }))

      // 3. LLM 配置
      const providers = org.aiProviders || []
      const llmConnected = providers.some((p: any) => p.enabled && p.status === 'active')

      // 4. 渠道连接
      const channels = await prisma.agentChannelBinding.findMany({ where: { tenantId: orgId } })
      const channelStatus = {
        total: channels.length,
        active: channels.filter((c: any) => c.status === 'active').length,
        list: channels.map((c: any) => ({ provider: c.provider, status: c.status })),
      }

      // 5. 首次任务
      const tasks = await prisma.enterpriseAgentTask.findMany({
        where: { tenantId: orgId },
        orderBy: { startedAt: 'desc' },
        take: 5,
      })
      const firstMissionComplete = tasks.some((t: any) => t.status === 'completed')

      // 6. 订阅状态
      const sub = org.subscription
      const subStatus = sub ? {
        status: sub.status,
        planName: sub.snapshotName || sub.plan?.displayName,
        expireAt: sub.expireAt,
        autoRenew: sub.autoRenew,
        maxEmployees: sub.snapshotMaxEmployees,
        maxChannels: sub.snapshotMaxChannels,
      } : null

      // 7. 综合健康评分
      const checks = [
        { key: 'organization', label: '企业资料', status: orgReady ? 'ready' : 'warning' },
        { key: 'subscription', label: '订阅状态', status: sub?.status === 'active' ? 'ready' : sub ? 'warning' : 'error' },
        { key: 'agents', label: 'AI 员工', status: agents.length > 0 ? 'ready' : 'warning' },
        { key: 'llm', label: 'LLM 配置', status: llmConnected ? 'ready' : 'warning' },
        { key: 'channels', label: '渠道连接', status: channelStatus.active > 0 ? 'ready' : 'warning' },
        { key: 'firstMission', label: '首次任务', status: firstMissionComplete ? 'ready' : 'warning' },
      ]
      const readyCount = checks.filter((c: any) => c.status === 'ready').length
      const healthScore = Math.round((readyCount / checks.length) * 100)

      return toApiResponse({
        success: true,
        data: {
          healthScore,
          overallStatus: healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical',
          checks,
          agents: agentStatus,
          llm: { connected: llmConnected, providers: providers.length },
          channels: channelStatus,
          subscription: subStatus,
          recentTasks: tasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status, startedAt: t.startedAt })),
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })
}
