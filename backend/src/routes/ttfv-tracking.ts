// routes/ttfv-tracking.ts — TTFV 事件追踪 API
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { ttfvEventService } from '../services/enterprise/ttfv-event.service.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'
import { toApiResponse } from '../contracts/runtime/toApiResponse.js'

export default async function ttfvRoutes(app: FastifyInstance) {

  // GET /api/enterprise/ttfv — 当前企业 TTFV 状态
  app.get('/api/enterprise/ttfv', async (request, reply) => {
    try {
      const userId = (request.user as any)?.userId
      if (!userId) return reply.status(401).send(toApiResponse({ success: false, message: '未登录' }))
      const orgId = await getOrganizationIdForUser(userId)
      if (!orgId) return reply.status(404).send(toApiResponse({ success: false, message: '未找到企业' }))

      const ttfv = await ttfvEventService.calculateTTFV(orgId)
      const events = await ttfvEventService.getEnterpriseEventChain(orgId)

      return toApiResponse({
        success: true,
        data: {
          organizationId: orgId,
          ttfvMinutes: ttfv,
          isCompleted: ttfv !== null,
          events,
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // GET /api/admin/enterprise/ttfv/beta-overview — Beta 客户 TTFV 概览
  app.get('/api/admin/enterprise/ttfv/beta-overview', async (request, reply) => {
    try {
      const orgs = await prisma.organization.findMany({
        include: { subscription: true },
      })

      const results = []
      for (const org of orgs) {
        const ttfv = await ttfvEventService.calculateTTFV(org.id)
        const events = await ttfvEventService.getEnterpriseEventChain(org.id)

        const paymentSuccess = events.find((e) => e.action === 'enterprise.lifecycle.payment_success')
        const firstOutcome = events.find((e) => e.action === 'enterprise.employee.first_outcome_created')

        results.push({
          organizationId: org.id,
          name: org.name,
          planName: org.subscription?.snapshotName || '-',
          status: org.subscription?.status || 'none',
          paymentSuccessAt: paymentSuccess?.createdAt?.toISOString() || null,
          firstOutcomeAt: firstOutcome?.createdAt?.toISOString() || null,
          ttfvMinutes: ttfv,
        })
      }

      const completedCount = results.filter((r) => r.ttfvMinutes !== null).length
      const avgTTFV =
        completedCount > 0
          ? Math.round(
              (results.reduce((s, r) => s + (r.ttfvMinutes || 0), 0) / completedCount) * 10
            ) / 10
          : 0

      return toApiResponse({
        success: true,
        data: {
          total: results.length,
          completed: completedCount,
          averageTtfv: avgTTFV,
          companies: results,
        },
      })
    } catch (err: any) {
      return reply.status(500).send(toApiResponse({ success: false, message: err.message }))
    }
  })

  // GET /api/admin/enterprise/ttfv/beta-conversion — Beta 转化漏斗
  app.get('/api/admin/enterprise/ttfv/beta-conversion', async () => {
    const stages = [
      'enterprise.lifecycle.signup',
      'enterprise.lifecycle.pricing_viewed',
      'enterprise.lifecycle.payment_created',
      'enterprise.lifecycle.payment_success',
      'enterprise.lifecycle.subscription_active',
      'enterprise.employee.created',
      'enterprise.employee.first_task_started',
      'enterprise.employee.first_outcome_created',
    ]

    const counts: Record<string, number> = {}
    for (const stage of stages) {
      counts[stage] = await prisma.agentAuditTrail.count({
        where: { action: stage },
      })
    }
    const signupCount = counts['enterprise.lifecycle.signup'] || 1

    const funnel = stages.map((stage) => ({
      stage,
      count: counts[stage] || 0,
      rate: Math.round(((counts[stage] || 0) / signupCount) * 100),
    }))

    return toApiResponse({ success: true, data: { funnel, counts } })
  })
}
