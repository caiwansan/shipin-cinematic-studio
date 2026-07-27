/**
 * Enterprise Timeline — View Layer API
 * ER-01-TASK-03: AI 企业部门工作流水线
 *
 * 产品目标: 让 CEO 看到 AI 员工如何创造价值
 *   AI员工 → 执行动作 → 产生结果 → 形成业务影响
 *
 * 设计原则:
 * - 仅 View Layer（不新增 Event Model / Schema）
 * - organizationId 来自 JWT (Identity Resolution)
 * - 禁止从 URL tenantId 查询
 * - 严格复用 EnterpriseOperationEvent + AgentExecutionLog + OutcomeRecord + ImpactMeasurement
 * - 所有查询均通过组织隔离
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getOrganizationIdForUser } from '../services/enterprise/organization/identity-bootstrap.service.js'

export async function enterpriseTimelineRoutes(app: FastifyInstance) {
  // JWT 认证
  app.addHook('preHandler', app.authenticate)

  // ── Enterprise Timeline (CEO 工作时间线) ──

  /**
   * GET /api/enterprise/timeline
   * 返回今日 AI 工作记录时间线
   *
   * 数据聚合:
   *   EnterpriseOperationEvent → 什么时候发生了什么
   *   AgentExecutionLog       → 哪个 AI 员工执行
   *   OutcomeRecord           → 产生什么结果
   *   ImpactMeasurement       → 业务价值
   *
   * Query: date=YYYY-MM-DD (默认今天), limit (默认 50)
   */
  app.get('/timeline', async (request, reply) => {
    try {
      const user = request.user as any
      const { date, limit } = request.query as { date?: string; limit?: string }

      // Identity Resolution: JWT → organizationId (禁止 URL tenantId)
      const orgId = await getOrganizationIdForUser(user?.id)
      if (!orgId) {
        return reply.status(400).send({ code: 400, message: 'ORGANIZATION_NOT_FOUND' })
      }

      const timelineLimit = limit ? Math.min(parseInt(limit), 100) : 50

      // 计算时间范围（默认今天 00:00 ~ 23:59）
      const targetDate = date ? new Date(date) : new Date()
      const startOfDay = new Date(targetDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(targetDate)
      endOfDay.setHours(23, 59, 59, 999)

      // ═══════════════════════════════════════════════════════════════
      // 第一来源: EnterpriseOperationEvent — "什么时候发生了什么"
      // ═══════════════════════════════════════════════════════════════
      const operationEvents = await prisma.enterpriseOperationEvent.findMany({
        where: {
          tenantId: orgId,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { createdAt: 'desc' },
        take: timelineLimit,
      })

      // ═══════════════════════════════════════════════════════════════
      // 第二来源: AgentExecutionLog — "哪个 AI 员工执行"
      // ═══════════════════════════════════════════════════════════════
      const executionLogs = await prisma.agentExecutionLog.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { createdAt: 'desc' },
        take: timelineLimit,
      })

      // 获取 Agent 信息
      const agentIds = [
        ...new Set([
          ...executionLogs.map((l) => l.agentId).filter(Boolean),
          ...operationEvents.map((e) => e.actorId).filter(Boolean),
        ]),
      ] as string[]

      const agents = agentIds.length > 0
        ? await prisma.enterpriseAgentProfile.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true, agentType: true },
          })
        : []
      const agentMap = new Map(agents.map((a) => [a.id, a]))

      // ═══════════════════════════════════════════════════════════════
      // 第三来源: OutcomeRecord — "产生什么结果"
      // ═══════════════════════════════════════════════════════════════
      const outcomes = await prisma.outcomeRecord.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { createdAt: 'desc' },
        take: timelineLimit,
        select: {
          id: true,
          actionId: true,
          agentId: true,
          type: true,
          description: true,
          createdAt: true,
        },
      })

      // ═══════════════════════════════════════════════════════════════
      // 第四来源: ImpactMeasurement — "业务价值"
      // ═══════════════════════════════════════════════════════════════
      const outcomeIds = outcomes.map((o) => o.id)
      const impacts = outcomeIds.length > 0
        ? await prisma.impactMeasurement.findMany({
            where: { outcomeId: { in: outcomeIds } },
            select: {
              outcomeId: true,
              metricType: true,
              metricValue: true,
              unit: true,
            },
          })
        : []

      const impactsByOutcome = new Map<string, typeof impacts>()
      for (const impact of impacts) {
        const existing = impactsByOutcome.get(impact.outcomeId) || []
        existing.push(impact)
        impactsByOutcome.set(impact.outcomeId, existing)
      }

      // ═══════════════════════════════════════════════════════════════
      // 聚合 Timeline Items
      // ═══════════════════════════════════════════════════════════════

      // 从 OperationEvent 构建事件
      const eventItems = operationEvents.map((event) => {
        const agent = agentMap.get(event.actorId)
        return {
          id: `evt-${event.id}`,
          timestamp: event.createdAt.toISOString(),
          type: 'operation_event',
          agentId: event.actorId,
          agentName: agent?.name || event.actorName || '系统',
          agentType: agent?.agentType || event.actorType,
          action: translateEventType(event.eventType),
          actionType: event.eventType,
          targetType: event.targetType || null,
          targetId: event.targetId || null,
          outcome: null as string | null,
          impactValue: null as string | null,
          impactUnit: null as string | null,
          impactType: null as string | null,
        }
      })

      // 从 OutcomeRecord 构建事件（包含 Impact）
      const outcomeItems = outcomes.map((outcome) => {
        const agent = outcome.agentId ? agentMap.get(outcome.agentId) : null
        const outcomeImpacts = impactsByOutcome.get(outcome.id) || []
        const topImpact = outcomeImpacts.length > 0 ? outcomeImpacts[0] : null

        return {
          id: `out-${outcome.id}`,
          timestamp: outcome.createdAt.toISOString(),
          type: 'outcome',
          agentId: outcome.agentId || null,
          agentName: agent?.name || 'AI员工',
          agentType: agent?.agentType || null,
          action: outcome.description || translateOutcomeType(outcome.type),
          actionType: outcome.type,
          targetType: null,
          targetId: outcome.actionId,
          outcome: outcome.description || translateOutcomeType(outcome.type),
          impactValue: topImpact ? topImpact.metricValue : null,
          impactUnit: topImpact ? topImpact.unit : null,
          impactType: topImpact ? topImpact.metricType : null,
        }
      })

      // 合并 + 按时间排序（最新在前）
      const allItems = [...eventItems, ...outcomeItems].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      // 去重（同 timestamp + agent + action 只保留一条，优先 outcome 类型）
      const seen = new Set<string>()
      const timelineItems = allItems.filter((item) => {
        const key = `${item.agentId}-${item.actionType}-${item.action}-${item.timestamp?.slice(0, 16)}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, timelineLimit)

      // ═══════════════════════════════════════════════════════════════
      // 汇总统计
      // ═══════════════════════════════════════════════════════════════
      const totalActions = eventItems.length
      const totalOutcomes = outcomeItems.length
      const activeAgents = new Set(timelineItems.map((i) => i.agentId).filter(Boolean)).size

      // 计算总业务价值
      const totalRevenue = impacts
        .filter((i) => i.metricType === 'REVENUE' || i.metricType === 'COST_SAVED')
        .reduce((sum, i) => sum + (Number(i.metricValue) || 0), 0)

      return reply.send({
        code: 0,
        data: {
          date: startOfDay.toISOString().slice(0, 10),
          organizationId: orgId,
          summary: {
            totalActions,
            totalOutcomes,
            totalEvents: timelineItems.length,
            activeAgents,
            totalRevenue: totalRevenue > 0 ? `¥${totalRevenue.toLocaleString()}` : null,
          },
          items: timelineItems,
        },
      })
    } catch (error: any) {
      request.log.error(error)
      return reply.status(500).send({ code: 500, message: error.message })
    }
  })
}

// ─── 事件类型汉化 ───────────────────────────────────────
function translateEventType(eventType: string): string {
  const map: Record<string, string> = {
    'action.completed': '完成任务',
    'action.approved': '审批通过',
    'action.rejected': '审批驳回',
    'action.verified': '验收完成',
    'action.executed': '开始执行',
    'channel.connected': '接入渠道',
    'channel.disconnected': '断开渠道',
    'tenant.created': '创建企业',
    'tenant.governance_linked': '治理关联',
    'approval.granted': '授权通过',
    'approval.revoked': '撤销授权',
    'permission.checked': '权限检查',
    'permission.denied': '权限拒绝',
    'user.login': '用户登录',
    'user.logout': '用户登出',
    'user.tier_change': '套餐变更',
  }
  return map[eventType] || eventType
}

function translateOutcomeType(outcomeType: string): string {
  const map: Record<string, string> = {
    'OPERATIONAL': '运营成果',
    'STRATEGIC': '战略成果',
    'REVENUE': '收入增长',
    'COST_REDUCTION': '成本优化',
    'LEADS_GENERATED': '线索获取',
    'CONTENT_CREATED': '内容创作',
    'CUSTOMER_SUCCESS': '客户成功',
  }
  return map[outcomeType] || outcomeType
}
