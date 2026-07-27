/**
 * Enterprise Outcome Visibility Layer — API Routes
 * OI-02: Outcome Truth Layer → CEO Dashboard 展示
 *
 * 设计原则:
 * - organizationId 来自 JWT (Identity Resolution)
 * - 禁止从 URL tenantId 查询 Outcome
 * - 所有查询均通过组织隔离
 */
import type { FastifyInstance } from 'fastify'
import { OutcomeSummaryService } from '../platform/outcome/outcome-summary.service.js'
import { OutcomeQueryService } from '../platform/outcome/outcome-query.service.js'
import { OutcomeService, ImpactService } from '../platform/outcome/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'
import { ttfvEventService } from '../services/enterprise/ttfv-event.service.js'

export async function enterpriseOutcomeRoutes(app: FastifyInstance) {
  // JWT 认证
  app.addHook('preHandler', app.authenticate)

  // ── Outcome Summary (CEO 首页) ──

  /**
   * GET /api/enterprise/outcomes/summary
   * 返回 CEO Daily Brief: AI Workforce Today
   * Query: period=TODAY|WEEK|MONTH (默认 TODAY)
   */
  app.get('/summary', async (request, reply) => {
    try {
      const user = request.user as any
      const { period } = request.query as { period?: 'TODAY' | 'WEEK' | 'MONTH' }

      // OI-02: Identity Resolution (禁止 URL tenantId)
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const dto = await OutcomeSummaryService.getSummary(orgId, { period })
      // OI-02: 转换为前端 CTO 规范格式
      const topMetric = dto.totalImpact[0]
      return reply.send({
        code: 0,
        data: {
          period: dto.period,
          totals: {
            actions: dto.totalActions,
            outcomes: dto.totalOutcomes,
            impactValue: topMetric ? formatImpactValue(topMetric) : '-',
          },
          agents: dto.agentBreakdown.map((a) => ({
            agentId: a.agentId,
            agentName: a.agentName,
            actionsCompleted: a.actions,
            outcomesGenerated: a.outcomes,
            impactValue: a.topImpact ? formatImpactValue(a.topImpact) : '-',
            topOutcome: a.topOutcome,
          })),
        },
      })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  // ── Action → Outcome Timeline ──

  /**
   * GET /api/enterprise/outcomes/timeline
   * 返回 Action → Outcome Timeline
   * Query: limit, offset
   */
  app.get('/timeline', async (request, reply) => {
    try {
      const user = request.user as any
      const { limit, offset } = request.query as { limit?: string; offset?: string }

      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const timeline = await OutcomeQueryService.getTimeline(orgId, {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      })
      return reply.send({ code: 0, data: timeline })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  // ── AI Employee Impact Card ──

  /**
   * GET /api/enterprise/outcomes/agents/:agentId/impact
   * 返回指定 Agent 的 Impact Card
   */
  app.get('/agents/:agentId/impact', async (request, reply) => {
    try {
      const user = request.user as any
      const { agentId } = request.params as { agentId: string }

      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const impact = await OutcomeQueryService.getAgentImpact(orgId, agentId)
      if (!impact) {
        return reply.status(404).send({ code: 404, message: 'AGENT_NOT_FOUND' })
      }

      return reply.send({ code: 0, data: impact })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })

  // ── Create Outcome (Action Completed → Outcome Captured) ──

  /**
   * POST /api/enterprise/outcomes
   * 从 Action Completed 创建 OutcomeRecord
   * Body: { actionId, type, description, evidence?, impact? }
   */
  app.post('/', async (request, reply) => {
    try {
      const user = request.user as any
      const body = request.body as {
        actionId?: string
        agentId?: string
        type?: string
        description?: string
        evidence?: unknown[]
        impact?: { metricType: string; metricValue: string; unit?: string }
      }

      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      // 创建 OutcomeRecord
      const outcome = await OutcomeService.create({
        organizationId: orgId,
        actionId: body.actionId,
        agentId: body.agentId,
        type: body.type,
        description: body.description,
        evidence: body.evidence,
      })

      // 可选: 同时创建 ImpactMeasurement
      let impact = null
      if (body.impact) {
        impact = await ImpactService.record({
          organizationId: orgId,
          outcomeId: outcome.id,
          metricType: body.impact.metricType,
          metricValue: body.impact.metricValue,
          unit: body.impact.unit,
        })
      }

      // TTFV: 记录首次 Outcome 创建事件（TTFV 终点）
      await ttfvEventService.trackFirstOutcomeCreated(
        orgId,
        body.agentId || '',
        outcome.id,
        body.type || 'unknown',
      )

      return reply.status(201).send({ code: 0, data: { outcome, impact } })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}

function formatImpactValue(impact: { metricType: string; value: string; unit: string }): string {
  if (impact.metricType === 'REVENUE') return `¥${impact.value}`
  if (impact.metricType === 'COST_SAVED') return `¥${impact.value}`
  if (impact.metricType === 'TIME_SAVED') return `${impact.value}小时`
  if (impact.metricType === 'LEADS_GENERATED') return `${impact.value}个`
  return `${impact.value} ${impact.unit}`
}
