/**
 * routes/admin-enterprises.ts — Admin 企业总览控制台
 * Sprint 4.3.2 — Beta Preparation
 *
 * 运营视角：企业列表、状态监控、风险提示
 * 复用现有模型，禁止新增复杂后台体系
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminEnterpriseRoutes(app: FastifyInstance) {

  /**
   * GET /api/admin/enterprises
   * 企业列表（运营总览）
   */
  app.get('/api/admin/enterprises', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { search, status, page = '1', pageSize = '20' } = request.query as any
      const pageNum = Math.max(1, parseInt(page) || 1)
      const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20))
      const skip = (pageNum - 1) * size

      // 构建过滤条件
      const where: any = {}
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { profile: { businessSummary: { contains: search, mode: 'insensitive' } } },
        ]
      }

      const [orgs, total] = await Promise.all([
        prisma.organization.findMany({
          where,
          skip,
          take: size,
          orderBy: { createdAt: 'desc' },
          include: {
            profile: true,
            subscription: {
              include: { plan: true },
            },
            aiProviders: {
              select: { id: true, provider: true, model: true, status: true, enabled: true },
            },
          },
        }),
        prisma.organization.count({ where }),
      ])

      // 计算每个企业的最近活跃和风险
      const now = Date.now()
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000)

      const list = await Promise.all(orgs.map(async (org) => {
        // 聚合查询：AI员工、渠道、任务、模型绑定
        const [agentCount, channelCount, taskCount, modelBindings, lastTask] = await Promise.all([
          prisma.enterpriseAgentInstance.count({ where: { tenantId: org.id } }),
          prisma.agentChannelBinding.count({ where: { tenantId: org.id } }),
          prisma.enterpriseAgentTask.count({ where: { tenantId: org.id } }),
          prisma.employeeModelBinding.count({ where: { tenantId: org.id, enabled: true } }),
          prisma.enterpriseAgentTask.findFirst({
            where: { tenantId: org.id },
            orderBy: { startedAt: 'desc' },
            select: { startedAt: true },
          }),
        ])

        // 风险标记
        const risks: string[] = []
        if (agentCount === 0) risks.push('no_agent')
        if (modelBindings === 0 && agentCount > 0) risks.push('no_model')
        if (channelCount === 0 && agentCount > 0) risks.push('no_channel')
        if (!lastTask || lastTask.startedAt < threeDaysAgo) risks.push('inactive')

        // 订阅状态
        const sub = org.subscription
        let subStatus = 'none'
        if (sub) {
          if (sub.status === 'active' && (!sub.expireAt || sub.expireAt > new Date())) subStatus = 'active'
          else if (sub.expireAt && sub.expireAt <= new Date()) subStatus = 'expired'
          else subStatus = sub.status
        }

        return {
          id: org.id,
          name: org.name || org.profile?.businessSummary || '未命名企业',
          industry: org.profile?.industry || null,
          createdAt: org.createdAt,
          plan: sub?.plan?.displayName || sub?.plan?.name || '未订阅',
          planStatus: subStatus,
          aiEmployeeCount: agentCount,
          modelCount: org.aiProviders?.length || 0,
          activeModels: modelBindings,
          channelCount,
          totalTasks: taskCount,
          lastActiveAt: lastTask?.startedAt || null,
          risks,
        }
      }))

      return reply.send({
        code: 0,
        message: 'success',
        data: {
          list,
          pagination: {
            page: pageNum,
            pageSize: size,
            total,
            totalPages: Math.ceil(total / size),
          },
        },
      })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' })
    }
  })

  /**
   * GET /api/admin/enterprises/:id
   * 企业详情（运营视角）
   */
  app.get('/api/admin/enterprises/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const org = await prisma.organization.findUnique({
        where: { id },
        include: {
          profile: true,
          subscription: {
            include: { plan: true },
          },
          aiProviders: {
            select: { id: true, provider: true, model: true, status: true, enabled: true },
          },
        },
      })

      if (!org) {
        return reply.status(404).send({ code: 404, message: '企业不存在' })
      }

      // 独立查询关联数据（无 Prisma 关系，用 tenantId 查询）
      const [agentInstances, channelAccounts, channelBindings] = await Promise.all([
        prisma.enterpriseAgentInstance.findMany({
          where: { tenantId: id },
        }),
        prisma.enterpriseChannelAccount.findMany({
          where: { tenantId: id },
        }),
        prisma.agentChannelBinding.findMany({
          where: { tenantId: id },
        }),
      ])

      // AI 员工详情
      const agents = await Promise.all(agentInstances.map(async (inst) => {
        const [binding, channelCount, taskCount, profile] = await Promise.all([
          prisma.employeeModelBinding.findFirst({
            where: { employeeId: inst.employeeId, enabled: true },
          }),
          prisma.agentChannelBinding.count({
            where: { agentInstanceId: inst.id },
          }),
          prisma.enterpriseAgentTask.count({
            where: { agentInstanceId: inst.id },
          }),
          prisma.enterpriseAgentProfile.findUnique({
            where: { id: inst.employeeId },
            select: { name: true, role: true, agentType: true },
          }),
        ])

        return {
          id: inst.id,
          name: profile?.name || '未命名',
          role: profile?.role || profile?.agentType || 'unknown',
          status: inst.runtimeStatus,
          model: binding?.modelName || '未绑定',
          provider: binding?.providerConfigId ? org.aiProviders.find(p => p.id === binding.providerConfigId)?.provider || 'unknown' : 'none',
          channelCount,
          taskCount,
          lastActiveAt: inst.lastActiveAt,
        }
      }))

      // 风险
      const risks: Array<{ type: string; message: string }> = []
      if (agentInstances.length === 0) {
        risks.push({ type: 'warning', message: '该企业尚未创建 AI 员工' })
      }
      const noModelAgents = agents.filter(a => a.model === '未绑定').length
      if (noModelAgents > 0) {
        risks.push({ type: 'urgent', message: `${noModelAgents} 个 AI 员工未绑定模型` })
      }
      if (channelBindings.length === 0) {
        risks.push({ type: 'suggestion', message: '未连接渠道，AI 无法交互' })
      }

      // 订阅
      const sub = org.subscription
      let planInfo = { name: '未订阅', status: 'none', expireAt: null as Date | null }
      if (sub) {
        planInfo = {
          name: sub.plan?.displayName || sub.plan?.name || '未知',
          status: sub.status,
          expireAt: sub.expireAt,
        }
      }

      return reply.send({
        code: 0,
        message: 'success',
        data: {
          id: org.id,
          name: org.name || org.profile?.businessSummary || '未命名企业',
          industry: org.profile?.industry,
          businessSummary: org.profile?.businessSummary,
          createdAt: org.createdAt,
          plan: planInfo,
          agents,
          channels: channelAccounts.map(c => ({
            id: c.id,
            name: c.channelName,
            type: c.channelType,
            status: c.connectionStatus,
          })),
          models: org.aiProviders.map(m => ({
            id: m.id,
            provider: m.provider,
            model: m.model,
            status: m.status,
            enabled: m.enabled,
          })),
          risks,
          stats: {
            totalTasks: await prisma.enterpriseAgentTask.count({ where: { tenantId: id } }),
            totalAgents: agentInstances.length,
            totalChannels: channelAccounts.length,
            totalModels: org.aiProviders.length,
          },
        },
      })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' })
    }
  })

  /**
   * GET /api/admin/enterprises/stats
   * 平台统计
   */
  app.get('/api/admin/enterprises/stats', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const [
        totalEnterprises,
        activeAgents,
        totalAgents,
        totalTasks,
        totalChannels,
      ] = await Promise.all([
        prisma.organization.count(),
        prisma.enterpriseAgentInstance.count({ where: { runtimeStatus: 'active' } }),
        prisma.enterpriseAgentInstance.count(),
        prisma.enterpriseAgentTask.count(),
        prisma.enterpriseChannelAccount.count(),
      ])

      return reply.send({
        code: 0,
        message: 'success',
        data: {
          totalEnterprises,
          activeAgents,
          totalAgents,
          totalTasks,
          totalChannels,
        },
      })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message || 'Internal error' })
    }
  })
}
