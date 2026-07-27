/**
 * routes/enterprise-agents.ts — AI 员工实例管理
 *
 * 产品原则：
 * - 用户购买套餐后，自动生成 EnterpriseAgentInstance
 * - 用户进入新媒体运营部门，看到的是"自己的 AI 员工"
 * - 套餐变更会影响员工生命周期
 *
 * Enterprise Route Governance Fix (Phase 1-3):
 * - 路由前缀统一由 index.ts 注册时指定 { prefix: '/api/enterprise' }
 * - 认证链路: JWT → authenticate → getOrganizationIdForUser → orgId
 * - 禁止从 URL / Query 获取 tenantId
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export default async function enterpriseAgentRoutes(fastify: FastifyInstance) {

  // ─── Phase 2: 认证链路 — 所有企业域路由必须经过 JWT 验证 ───
  fastify.addHook('preHandler', fastify.authenticate)

  // ─── Phase 3: Tenant Context 统一解析 — JWT userId → DB 查询 → orgId ───
  fastify.addHook('preHandler', async (request, reply) => {
    const user = request.user as any
    const userId = user?.id
    if (!userId) {
      return reply.status(401).send({ error: '未授权', message: 'token 无效' })
    }
    const orgId = await getOrganizationIdForUser(userId)
    ;(request as any)._orgId = orgId
    if (!orgId) {
      return reply.send({
        code: 403,
        codeKey: 'NO_TENANT',
        message: 'User has no organization. Requires onboarding.',
        data: { instances: [], requiresOnboarding: true },
      })
    }
  })

  // GET /media-department/agents — 当前企业的 AI 员工实例列表
  // 实际路径: /api/enterprise/media-department/agents (prefix 由 index.ts 注入)
  fastify.get('/media-department/agents', async (request, reply) => {
    const orgId = (request as any)._orgId

    if (!orgId) {
      return reply.send({
        code: 403,
        codeKey: 'NO_TENANT',
        message: 'User has no organization. Requires onboarding.',
        data: { instances: [], requiresOnboarding: true },
      })
    }

    // 从数据库查询该组织的 AI 员工实例（严格按 orgId 隔离）
    const instances = await prisma.enterpriseAgentInstance.findMany({
      where: { tenantId: orgId },
      orderBy: { createdAt: 'asc' },
    })

    // 通过 employeeId 关联查询 EnterpriseAgentProfile（无直接 Prisma relation）
    const employeeIds = instances.map((inst) => inst.employeeId)
    const profiles = employeeIds.length > 0
      ? await prisma.enterpriseAgentProfile.findMany({
          where: { id: { in: employeeIds } },
          select: {
            id: true,
            name: true,
            description: true,
            agentType: true,
            capabilities: true,
            avatarUrl: true,
          },
        })
      : []
    const profileMap = new Map(profiles.map((p) => [p.id, p]))

    return {
      code: 0,
      data: {
        organizationId: orgId,
        instances: instances.map((inst) => {
          const profile = profileMap.get(inst.employeeId)
          return {
            id: inst.id,
            name: profile?.name || 'AI 员工',
            type: profile?.agentType || 'unknown',
            status: inst.runtimeStatus,
            runtime: inst.runtime,
            capabilities: profile?.capabilities ? JSON.parse(profile.capabilities) : [],
            emergencyStop: inst.lifecycleState === 'EMERGENCY_STOP',
            createdAt: inst.createdAt,
            lastActiveAt: inst.lastActiveAt,
            totalTasks: inst.totalTasks,
            totalErrors: inst.totalErrors,
            metadata: inst.metadata,
          }
        }),
      },
    }
  })

  // GET /media-department/agents/summary — 统计摘要
  // 实际路径: /api/enterprise/media-department/agents/summary
  fastify.get('/media-department/agents/summary', async (request) => {
    const orgId = (request as any)._orgId

    const [total, active, paused] = await Promise.all([
      prisma.enterpriseAgentInstance.count({ where: { tenantId: orgId } }),
      prisma.enterpriseAgentInstance.count({ where: { tenantId: orgId, runtimeStatus: 'active' } }),
      prisma.enterpriseAgentInstance.count({ where: { tenantId: orgId, runtimeStatus: 'paused' } }),
    ])

    return { code: 0, data: { total, active, paused, capacity: 20 } }
  })
}
