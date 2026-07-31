/**
 * BETA-08.1: Subscription & Entitlement API
 *
 * GET  /api/enterprise/subscription         — 企业订阅+Entitlement+用量
 * POST /api/enterprise/subscription/sync-entitlement
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

async function getSubscriptionData(userId: string) {
  const member = await (prisma as any).orgMember.findFirst({
    where: { userId },
    include: { organization: true },
  })
  if (!member) return null

  const orgId = member.organizationId || member.organization?.id
  if (!orgId) return null

  const subscription = await prisma.enterpriseSubscription.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  })

  let totalAgents = 0
  try {
    totalAgents = await prisma.enterpriseAgentProfile.count({
      where: { organizationId: orgId, status: 'active' },
    })
  } catch { /* ignore */ }

  const orgName = member.organization?.name || ''

  return {
    planName: subscription ? '专业版' : '免费版',
    status: subscription?.status || 'active',
    maxEmployees: subscription?.snapshotMaxEmployees || 3,
    maxAgents: subscription?.snapshotMaxEmployees || 3,
    totalAgents,
    orgName,
    orgId,
  }
}

export async function registerSubscriptionRoutes(app: FastifyInstance) {
  // GET /api/enterprise/subscription
  app.get('/api/enterprise/subscription', async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      if (!userId) {
        return reply.status(401).send({ success: false, error: 'Unauthorized' })
      }

      const data = await getSubscriptionData(userId)
      if (!data) {
        return reply.status(200).send({ success: true, data: null })
      }

      return reply.send({ code: 0, data })
    } catch (err: any) {
      request.log.error(`[subscription] error: ${err.message}`)
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })
}
