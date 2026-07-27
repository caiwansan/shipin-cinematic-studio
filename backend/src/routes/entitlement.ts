/**
 * BETA-08.1: Entitlement API — 权益视角（只读）
 * 
 * GET /api/enterprise/entitlement → 当前企业权益 + 使用量
 * 
 * 设计原则：
 * - Subscription 定义"买了什么" → enterprise-subscription.ts 负责
 * - Entitlement 定义"当前能用什么" → 本路由负责
 * - 禁止前端传入 orgId，全部通过 Tenant Guard 解析
 */

import type { FastifyInstance } from 'fastify'
import { entitlementService } from '../services/enterprise/enterprise-entitlement.service.js'
import { prisma } from '../utils/index.js'

export async function registerEntitlementRoutes(app: FastifyInstance) {
  /**
   * GET /api/enterprise/entitlement
   * 当前企业权益（ Subscription + Entitlement + 实时使用量 ）
   */
  app.get('/api/enterprise/entitlement', async (request, reply) => {
    try {
      const ctx = (request as any).tenantContext
      if (!ctx) {
        return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
      }
      const { orgId, orgName, role } = ctx

      // 获取 Subscription（购买记录）
      const subscription = await prisma.enterpriseSubscription.findFirst({
        where: { organizationId: orgId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      })

      // 获取实时权益
      const entitlement = await entitlementService.getCurrentEntitlement(orgId)

      // 统计 Agent（按 status 分组）
      const agentStats = await prisma.enterpriseAgentInstance.groupBy({
        by: ['status'],
        where: { tenantId: orgId },
        _count: { id: true },
      })
      const agentsByStatus: Record<string, number> = {}
      for (const s of agentStats) {
        agentsByStatus[s.status] = s._count.id
      }

      // 组装响应
      return reply.send({
        code: 0,
        data: {
          organization: { id: orgId, name: orgName, role },
          subscription: subscription ? {
            id: subscription.id,
            status: subscription.status,
            plan: subscription.plan ? {
              id: subscription.plan.id,
              name: subscription.plan.displayName,
              price: subscription.plan.price,
              billingCycle: subscription.plan.billingCycle,
            } : null,
            startedAt: subscription.startAt,
            expireAt: subscription.expireAt,
            autoRenew: subscription.autoRenew,
            snapshot: {
              name: subscription.snapshotName,
              price: subscription.snapshotPrice,
              maxEmployees: subscription.snapshotMaxEmployees,
              maxChannels: subscription.snapshotMaxChannels,
              maxMembers: subscription.snapshotMaxMembers,
              features: subscription.snapshotFeatures,
            },
          } : null,
          entitlement: entitlement ? {
            id: entitlement.id,
            status: entitlement.status,
            agents: entitlement.agents,
            channels: entitlement.channels,
            members: entitlement.members,
            storage: entitlement.storage,
            features: entitlement.features,
            effectiveFrom: entitlement.effectiveFrom,
            effectiveUntil: entitlement.effectiveUntil,
          } : null,
          usage: {
            agents: {
              total: Object.values(agentsByStatus).reduce((a, b) => a + b, 0),
              byStatus: agentsByStatus,
            },
          },
        },
      })
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })

  /**
   * POST /api/enterprise/entitlement/sync
   * 触发 Entitlement → Agent 同步
   */
  app.post('/api/enterprise/entitlement/sync', async (request, reply) => {
    try {
      const ctx = (request as any).tenantContext
      if (!ctx) {
        return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
      }
      const result = await entitlementService.syncAgents(ctx.orgId)
      return reply.send({ code: 0, data: result })
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })
}
