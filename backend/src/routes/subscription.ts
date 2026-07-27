/**
 * BETA-08.1: Subscription & Entitlement API
 * 
 * GET /api/enterprise/subscription
 * - 返回当前企业 Subscription + Entitlement + 使用量
 * - 纯 JWT + Tenant Guard，不接传 orgId
 */

import type { FastifyInstance } from 'fastify'
import { entitlementService } from '../services/enterprise/enterprise-entitlement.service.js'
import { prisma } from '../utils/index.js'

export async function registerSubscriptionRoutes(app: FastifyInstance) {
  app.get('/api/enterprise/subscription', async (request, reply) => {
    try {
      const ctx = (request as any).tenantContext
      if (!ctx) {
        return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
      }
      const { orgId, orgName, role } = ctx

      // 获取 Subscription
      const subscription = await prisma.enterpriseSubscription.findFirst({
        where: { organizationId: orgId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      })

      // 获取 Entitlement（实时权益）
      const entitlement = await entitlementService.getCurrentEntitlement(orgId)

      // 统计 Agent 使用量
      const agentStats = await prisma.enterpriseAgentInstance.groupBy({
        by: ['status'],
        where: { tenantId: orgId },
        _count: { id: true },
      })
      const agentsByStatus = agentStats.reduce((acc, s) => {
        acc[s.status] = s._count.id
        return acc
      }, {} as Record<string, number>)

      // 组装响应
      const data = {
        organization: {
          id: orgId,
          name: orgName,
          role,
        },
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
          // Plan snapshot（购买时的冻结版本）
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
      }

      return reply.send({ code: 0, data })
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })

  /**
   * POST /api/enterprise/subscription/sync-entitlement
   * 触发 Entitlement → Agent 同步（管理员/系统调用）
   */
  app.post('/api/enterprise/subscription/sync-entitlement', async (request, reply) => {
    try {
      const ctx = (request as any).tenantContext
      if (!ctx) {
        return reply.status(403).send({ code: 403, codeKey: 'NO_TENANT', message: 'Requires organization membership' })
      }
      const { orgId } = ctx

      const result = await entitlementService.syncAgents(orgId)
      return reply.send({ code: 0, data: result })
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })
}
