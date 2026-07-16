/**
 * Enterprise Intelligence Routes
 * /api/enterprise/:tenantId/intelligence/*
 *
 * Phase 4.2 Sprint 4.2.1 — Enterprise Signal Foundation
 * Phase 4.2 Sprint 4.2.2 — Decision Intelligence v1
 * Phase 4.2 Sprint 4.2.3 — Action Loop v1
 * CTO Contract: Signal Canonical Model + Decision Object + Action Lifecycle + Priority Score + Evidence Graph + Action Status History
 */
import type { FastifyInstance } from 'fastify'
import { operationEventService } from '../services/enterprise/intelligence/operation-event.service.js'
import { signalService } from '../services/enterprise/intelligence/signal.service.js'
import { decisionService } from '../services/enterprise/intelligence/decision.service.js'
import { decisionRankingService } from '../services/enterprise/intelligence/decision-ranking.service.js'
import { actionService } from '../services/enterprise/intelligence/action.service.js'
import { actionLifecycleService } from '../services/enterprise/intelligence/action-lifecycle.service.js'
import { actionApprovalService } from '../services/enterprise/intelligence/action-approval.service.js'
import { actionAuditService } from '../services/enterprise/intelligence/action-audit.service.js'
import { enterpriseContextService } from '../services/enterprise/enterprise-context.service.js'
import { outcomeService } from '../services/enterprise/intelligence/outcome.service.js'
import { decisionFeedbackService } from '../services/enterprise/intelligence/decision-feedback.service.js'
import { tenantOwnershipGuard } from '../enterprise/reality/tenant-guard.js'
import { withDataSource } from '../enterprise/reality/demo-boundary.js'
import { prisma } from '../utils/index.js'

export async function enterpriseIntelligenceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)
  app.addHook('preHandler', tenantOwnershipGuard)

  // ═══════════════════════════════════════════════════════════
  // Sprint 4.2.3.1 — Enterprise Context
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/context/enterprise — 当前用户企业上下文
  app.get('/api/enterprise/:tenantId/context/enterprise', async (request, reply) => {
    const user = request.user as any
    const userId = user?.id || (request.params as any).tenantId

    const ctx = await enterpriseContextService.resolve(userId)
    return reply.send({ code: 0, data: ctx })
  })

  // GET /api/enterprise/:tenantId/governance/permissions — 当前用户权限
  app.get('/api/enterprise/:tenantId/governance/permissions', async (request, reply) => {
    const user = request.user as any
    const userId = user?.id || (request.params as any).tenantId

    const ctx = await enterpriseContextService.resolve(userId)
    return reply.send({ code: 0, data: { capabilities: ctx.capabilities, roles: ctx.roles } })
  })

  // ═══════════════════════════════════════════════════════════
  // Intelligence Feed — CEO 智能信息流
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/intelligence/feed
  app.get('/api/enterprise/:tenantId/intelligence/feed', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any

    const [todayEvents, activeSignals, pendingRecommendations] = await Promise.all([
      operationEventService.getTodayCount(tenantId),
      signalService.getActiveSignals(tenantId),
      decisionService.getPendingRecommendations(tenantId),
    ])

    const feed = {
      todayEvents,
      activeSignals: activeSignals.length,
      pendingRecommendations: pendingRecommendations.length,
      recentActions: activeSignals.slice(0, 5).map(s => ({
        time: s.detectedAt.toISOString(),
        type: 'signal',
        message: s.description || '',
        severity: s.severity,
      })),
      topRecommendations: pendingRecommendations.slice(0, 3).map(r => ({
        id: r.id,
        title: r.title,
        rationale: r.rationale || '',
        priority: r.priority,
        category: r.category,
      })),
    }

    return reply.send(withDataSource({ code: 0, data: feed }, tenantId))
  })

  // ═══════════════════════════════════════════════════════════
  // Operation Events — 运营事件
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/events — 事件时间线
  app.get('/api/enterprise/:tenantId/events', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { eventType, limit, offset, startTime, endTime } = request.query as any

    const result = await operationEventService.getTimeline(tenantId, {
      eventType,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: new Date(endTime),
    })

    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // POST /api/enterprise/:tenantId/events — 记录事件
  app.post('/api/enterprise/:tenantId/events', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const body = request.body as any

    if (!body?.eventType) {
      return reply.status(400).send({ code: 400, message: 'eventType 必填' })
    }

    const event = await operationEventService.recordEvent({
      tenantId,
      eventType: body.eventType,
      actorType: body.actorType || 'system',
      actorId: body.actorId || user?.id || 'system',
      actorName: body.actorName,
      targetType: body.targetType,
      targetId: body.targetId,
      metadata: body.metadata,
    })

    return reply.send(withDataSource({ code: 0, data: event }, tenantId))
  })

  // ═══════════════════════════════════════════════════════════
  // Signals — 业务信号
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/signals — 信号列表
  app.get('/api/enterprise/:tenantId/signals', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any

    const signals = await signalService.getActiveSignals(tenantId)
    return reply.send(withDataSource({ code: 0, data: signals }, tenantId))
  })

  // POST /api/enterprise/:tenantId/signals/detect — 触发信号检测
  app.post('/api/enterprise/:tenantId/signals/detect', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any

    const results = await signalService.detectSignals(tenantId)
    const created = []
    for (const r of results) {
      if (r.detected && r.signalType && r.severity) {
        const signal = await signalService.createSignal({
          tenantId,
          signalType: r.signalType,
          severity: r.severity,
          description: r.description || '',
          sourceEventIds: r.sourceEvents || [],
        })
        created.push(signal)
      }
    }

    return reply.send(withDataSource({ code: 0, data: { detected: results.length, created } }, tenantId))
  })

  // POST /api/enterprise/:tenantId/signals/:id/ack — 确认信号
  app.post('/api/enterprise/:tenantId/signals/:id/ack', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    const result = await signalService.acknowledgeSignal(tenantId, id)
    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // POST /api/enterprise/:tenantId/signals/:id/resolve — 解决信号
  app.post('/api/enterprise/:tenantId/signals/:id/resolve', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    const result = await signalService.resolveSignal(tenantId, id)
    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // ═══════════════════════════════════════════════════════════
  // Recommendations — 决策建议
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/recommendations — 建议列表
  app.get('/api/enterprise/:tenantId/recommendations', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { status, category, limit } = request.query as any

    const recommendations = await decisionService.getRecommendations(tenantId, {
      status,
      category,
      limit: parseInt(limit) || 20,
    })
    return reply.send(withDataSource({ code: 0, data: recommendations }, tenantId))
  })

  // POST /api/enterprise/:tenantId/recommendations/:id/approve — 批准建议
  app.post('/api/enterprise/:tenantId/recommendations/:id/approve', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    const result = await decisionService.approveRecommendation(tenantId, id)
    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // POST /api/enterprise/:tenantId/recommendations/:id/reject — 拒绝建议
  app.post('/api/enterprise/:tenantId/recommendations/:id/reject', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    const result = await decisionService.rejectRecommendation(tenantId, id)
    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // ═══════════════════════════════════════════════════════════
  // Decisions — Sprint 4.2.2 Decision Intelligence
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/decisions/top — Top N 决策建议
  app.get('/api/enterprise/:tenantId/decisions/top', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { limit } = request.query as any

    const limitNum = parseInt(limit) || 3  // default=3 (CTO frozen)
    const decisions = await decisionRankingService.getTopDecisions(tenantId, limitNum)
    return reply.send(withDataSource({ code: 0, data: decisions }, tenantId))
  })

  // GET /api/enterprise/:tenantId/decisions/:id/evidence — 决策证据图
  app.get('/api/enterprise/:tenantId/decisions/:id/evidence', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    const graph = await decisionRankingService.buildEvidenceGraph(tenantId, id)
    return reply.send(withDataSource({ code: 0, data: graph }, tenantId))
  })

  // POST /api/enterprise/:tenantId/decisions/:id/accept — 接受决策（带 note）
  app.post('/api/enterprise/:tenantId/decisions/:id/accept', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any
    const body = request.body as any
    const note = body?.note || undefined  // CEO Decision Audit Trail

    await decisionService.markReviewed(tenantId, id)
    const result = await decisionService.approveRecommendation(tenantId, id)
    // Note: accept with note stored via metadata or separate audit log
    // For MVP: mark as accepted with decision_status = 'accepted'
    const updated = await prisma.enterpriseRecommendation.update({
      where: { id, tenantId },
      data: {
        decisionStatus: 'accepted',
        status: 'approved',
        approvedAt: new Date(),
      },
    })
    return reply.send(withDataSource({ code: 0, data: updated }, tenantId))
  })

  // POST /api/enterprise/:tenantId/decisions/:id/dismiss — 忽略决策
  app.post('/api/enterprise/:tenantId/decisions/:id/dismiss', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    await decisionService.markReviewed(tenantId, id)
    const result = await decisionService.rejectRecommendation(tenantId, id)
    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // POST /api/enterprise/:tenantId/decisions/:id/expire — 标记过期
  app.post('/api/enterprise/:tenantId/decisions/:id/expire', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    const result = await decisionService.expireDecision(tenantId, id)
    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // GET /api/enterprise/:tenantId/decisions/status — 决策统计
  app.get('/api/enterprise/:tenantId/decisions/status', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any

    const [detected, reviewed, accepted, dismissed, expired] = await Promise.all([
      prisma.enterpriseRecommendation.count({ where: { tenantId, decisionStatus: 'detected' } }),
      prisma.enterpriseRecommendation.count({ where: { tenantId, decisionStatus: 'reviewed' } }),
      prisma.enterpriseRecommendation.count({ where: { tenantId, decisionStatus: 'accepted' } }),
      prisma.enterpriseRecommendation.count({ where: { tenantId, decisionStatus: 'dismissed' } }),
      prisma.enterpriseRecommendation.count({ where: { tenantId, decisionStatus: 'expired' } }),
    ])
    return reply.send(withDataSource({ code: 0, data: { detected, reviewed, accepted, dismissed, expired } }, tenantId))
  })

  // ═══════════════════════════════════════════════════════════
  // Actions — 执行生命周期
  // ═══════════════════════════════════════════════════════════

  // GET /api/enterprise/:tenantId/actions/stats — 执行统计
  app.get('/api/enterprise/:tenantId/actions/stats', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any

    const stats = await actionService.getStats(tenantId)
    return reply.send(withDataSource({ code: 0, data: stats }, tenantId))
  })

  // GET /api/enterprise/:tenantId/actions/history — 执行历史
  app.get('/api/enterprise/:tenantId/actions/history', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { status, limit } = request.query as any

    const history = await actionService.getActionHistory(tenantId, {
      status,
      limit: parseInt(limit) || 20,
    })
    return reply.send(withDataSource({ code: 0, data: history }, tenantId))
  })

  // POST /api/enterprise/:tenantId/actions/:id/execute — @deprecated 4.2.3 → 410 Gone
  app.post('/api/enterprise/:tenantId/actions/:id/execute', async (request, reply) => {
    return reply.status(410).send({
      code: 410,
      message: 'Gone: Use POST /actions/:id/start + /actions/:id/complete instead',
      _deprecated: 'Sprint 4.2.3 — split into start + complete',
    })
  })

  // ═══════════════════════════════════════════════════════════
  // Sprint 4.2.3 — Action Loop (NEW APIs)
  // ═══════════════════════════════════════════════════════════

  // POST /api/enterprise/:tenantId/decisions/:id/actions — Decision → Action
  app.post('/api/enterprise/:tenantId/decisions/:id/actions', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id: decisionId } = request.params as any
    const body = request.body as any

    if (!body?.actions || !Array.isArray(body.actions) || body.actions.length === 0) {
      return reply.status(400).send({ code: 400, message: 'actions array is required' })
    }

    const actions = await actionLifecycleService.createActionsFromDecision(tenantId, decisionId, body.actions)
    return reply.send(withDataSource({ code: 0, data: { decisionId, actions } }, tenantId))
  })

  // GET /api/enterprise/:tenantId/actions — Action 列表（分页+筛选）
  app.get('/api/enterprise/:tenantId/actions', async (request, reply) => {
    const user = request.user as any
    const { tenantId } = request.params as any
    const { status, ownerType, ownerId, decisionId, limit, offset } = request.query as any

    const result = await actionLifecycleService.listActions(tenantId, {
      status,
      ownerType,
      ownerId,
      decisionId,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    })
    return reply.send(withDataSource({ code: 0, data: result }, tenantId))
  })

  // GET /api/enterprise/:tenantId/actions/:id — Action 详情
  app.get('/api/enterprise/:tenantId/actions/:id', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    try {
      const action = await actionLifecycleService.getActionById(tenantId, id)
      return reply.send(withDataSource({ code: 0, data: action }, tenantId))
    } catch (e: any) {
      if (e.name === 'ActionNotFoundError') {
        return reply.status(404).send({ code: 404, message: 'Action not found' })
      }
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/actions/:id/approve — 审批通过
  app.post('/api/enterprise/:tenantId/actions/:id/approve', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any
    const body = request.body as any

    if (!body?.approvedBy) {
      return reply.status(400).send({ code: 400, message: 'approvedBy is required' })
    }

    try {
      let result
      // Sprint 4.2.3.1: 如果提供 govUserId，走权限校验
      if (body.govUserId) {
        // 查找 governanceTenantId
        const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)
        result = await actionApprovalService.approveActionWithPermission(
          govTenantId || tenantId, id,
          { approvedBy: body.approvedBy, approvalNote: body.approvalNote },
          body.govUserId
        )
      } else {
        // 旧入口（向后兼容）
        result = await actionApprovalService.approveAction(tenantId, id, {
          approvedBy: body.approvedBy,
          approvalNote: body.approvalNote,
        })
      }
      return reply.send(withDataSource({ code: 0, data: result }, tenantId))
    } catch (e: any) {
      if (e.name === 'ActionNotFoundError') {
        return reply.status(404).send({ code: 404, message: 'Action not found' })
      }
      if (e.name === 'InvalidStatusTransitionError') {
        return reply.status(400).send({ code: 400, message: e.message })
      }
      if (e.name === 'PermissionDeniedError') {
        return reply.status(403).send({ code: 403, message: e.message })
      }
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/actions/:id/reject — 审批拒绝
  app.post('/api/enterprise/:tenantId/actions/:id/reject', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any
    const body = request.body as any

    if (!body?.approvedBy || !body?.rejectReason) {
      return reply.status(400).send({ code: 400, message: 'approvedBy and rejectReason are required' })
    }

    try {
      let result
      // Sprint 4.2.3.1: 如果提供 govUserId，走权限校验
      if (body.govUserId) {
        const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)
        result = await actionApprovalService.approveActionWithPermission(
          govTenantId || tenantId, id,
          { approvedBy: body.approvedBy, approvalNote: body.rejectReason },
          body.govUserId
        )
      } else {
        result = await actionApprovalService.rejectAction(tenantId, id, {
          approvedBy: body.approvedBy,
          rejectReason: body.rejectReason,
        })
      }
      return reply.send(withDataSource({ code: 0, data: result }, tenantId))
    } catch (e: any) {
      if (e.name === 'ActionNotFoundError') {
        return reply.status(404).send({ code: 404, message: 'Action not found' })
      }
      if (e.name === 'InvalidStatusTransitionError') {
        return reply.status(400).send({ code: 400, message: e.message })
      }
      if (e.name === 'PermissionDeniedError') {
        return reply.status(403).send({ code: 403, message: e.message })
      }
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/actions/:id/start — 开始执行
  app.post('/api/enterprise/:tenantId/actions/:id/start', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any

    try {
      const result = await actionAuditService.startExecution(tenantId, id, user?.id || 'system')
      return reply.send(withDataSource({ code: 0, data: result }, tenantId))
    } catch (e: any) {
      if (e.name === 'ActionNotFoundError') {
        return reply.status(404).send({ code: 404, message: 'Action not found' })
      }
      if (e.name === 'ActionNotApprovedError') {
        return reply.status(403).send({ code: 403, message: e.message })
      }
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/actions/:id/complete — 标记完成
  app.post('/api/enterprise/:tenantId/actions/:id/complete', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any
    const body = request.body as any

    if (!body?.executionResult) {
      return reply.status(400).send({ code: 400, message: 'executionResult is required' })
    }

    try {
      const result = await actionAuditService.completeAction(
        tenantId, id,
        { executionResult: body.executionResult },
        user?.id || 'system'
      )
      return reply.send(withDataSource({ code: 0, data: result }, tenantId))
    } catch (e: any) {
      if (e.name === 'ActionNotFoundError') {
        return reply.status(404).send({ code: 404, message: 'Action not found' })
      }
      if (e.name === 'InvalidStatusTransitionError') {
        return reply.status(400).send({ code: 400, message: e.message })
      }
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/actions/:id/verify — 验证完成 (重写)
  app.post('/api/enterprise/:tenantId/actions/:id/verify', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id } = request.params as any
    const body = request.body as any

    if (!body?.verificationResult) {
      return reply.status(400).send({ code: 400, message: 'verificationResult is required' })
    }

    try {
      const result = await actionAuditService.verifyAction(
        tenantId, id,
        { verificationResult: body.verificationResult },
        user?.id || 'system'
      )
      return reply.send(withDataSource({ code: 0, data: result }, tenantId))
    } catch (e: any) {
      if (e.name === 'ActionNotFoundError') {
        return reply.status(404).send({ code: 404, message: 'Action not found' })
      }
      if (e.name === 'InvalidStatusTransitionError') {
        return reply.status(400).send({ code: 400, message: e.message })
      }
      throw e
    }
  })

  // ═══════════════════════════════════════════════════════════
  // Sprint 4.2.4-A — Outcome Intelligence Foundation
  // ═══════════════════════════════════════════════════════════

  // POST /api/enterprise/:tenantId/actions/:id/outcome — 创建 Outcome
  app.post('/api/enterprise/:tenantId/actions/:id/outcome', async (request, reply) => {
    const user = request.user as any
    const { tenantId, id: actionId } = request.params as any
    const body = request.body as any

    // 查找 governance context
    const govTenantId = await enterpriseContextService.getGovernanceTenantId(user?.id || tenantId)

    try {
      const outcome = await outcomeService.createOutcome({
        tenantId,
        governanceTenantId: govTenantId,
        actionId,
        outcomeType: body.outcomeType || 'OPERATIONAL',
        sourceType: body.sourceType || 'HUMAN',
        summary: body.summary,
        evidence: body.evidence,
        impactType: body.impactType,
        impactLevel: body.impactLevel,
        impactMetric: body.impactMetric,
        impactValue: body.impactValue,
        impactSource: body.impactSource || 'manual',
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      })

      // 自动创建 Feedback (CTO Contract 5)
      await decisionFeedbackService.createFeedbackFromOutcome(outcome.id)

      return reply.send(withDataSource({ code: 0, data: outcome }, tenantId))
    } catch (e: any) {
      console.error('Create outcome failed:', e)
      throw e
    }
  })

  // GET /api/enterprise/:tenantId/actions/:id/outcome — 查询 Action 的 Outcome
  app.get('/api/enterprise/:tenantId/actions/:id/outcome', async (request, reply) => {
    const { id: actionId } = request.params as any
    const outcome = await outcomeService.getOutcomeByActionId(actionId)
    return reply.send({ code: 0, data: outcome })
  })

  // PATCH /api/enterprise/:tenantId/outcomes/:outcomeId — 更新 Outcome
  app.patch('/api/enterprise/:tenantId/outcomes/:outcomeId', async (request, reply) => {
    const { outcomeId } = request.params as any
    const body = request.body as any

    try {
      const outcome = await outcomeService.updateOutcome(outcomeId, {
        outcomeType: body.outcomeType,
        summary: body.summary,
        evidence: body.evidence,
        impactType: body.impactType,
        impactLevel: body.impactLevel,
        impactMetric: body.impactMetric,
        impactValue: body.impactValue,
        impactSource: body.impactSource,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      })
      return reply.send(withDataSource({ code: 0, data: outcome }, request.params as any))
    } catch (e: any) {
      console.error('Update outcome failed:', e)
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/outcomes/:outcomeId/verify — 确认有效
  app.post('/api/enterprise/:tenantId/outcomes/:outcomeId/verify', async (request, reply) => {
    const { outcomeId } = request.params as any
    try {
      const outcome = await outcomeService.verifyOutcome(outcomeId)
      // 自动创建 Feedback
      await decisionFeedbackService.createFeedbackFromOutcome(outcomeId)
      return reply.send(withDataSource({ code: 0, data: outcome }, request.params as any))
    } catch (e: any) {
      console.error('Verify outcome failed:', e)
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/outcomes/:outcomeId/reject — 确认失败
  app.post('/api/enterprise/:tenantId/outcomes/:outcomeId/reject', async (request, reply) => {
    const { outcomeId } = request.params as any
    try {
      const outcome = await outcomeService.rejectOutcome(outcomeId)
      await decisionFeedbackService.createFeedbackFromOutcome(outcomeId)
      return reply.send(withDataSource({ code: 0, data: outcome }, request.params as any))
    } catch (e: any) {
      console.error('Reject outcome failed:', e)
      throw e
    }
  })

  // POST /api/enterprise/:tenantId/outcomes/:outcomeId/invalid — 标记无效
  app.post('/api/enterprise/:tenantId/outcomes/:outcomeId/invalid', async (request, reply) => {
    const { outcomeId } = request.params as any
    try {
      const outcome = await outcomeService.markInvalid(outcomeId)
      await decisionFeedbackService.createFeedbackFromOutcome(outcomeId)
      return reply.send(withDataSource({ code: 0, data: outcome }, request.params as any))
    } catch (e: any) {
      console.error('Mark invalid failed:', e)
      throw e
    }
  })

  // DELETE /api/enterprise/:tenantId/outcomes/:outcomeId — 删除
  app.delete('/api/enterprise/:tenantId/outcomes/:outcomeId', async (request, reply) => {
    const { outcomeId } = request.params as any
    try {
      await outcomeService.deleteOutcome(outcomeId)
      return reply.send({ code: 0, data: null })
    } catch (e: any) {
      console.error('Delete outcome failed:', e)
      throw e
    }
  })

  // GET /api/enterprise/:tenantId/outcomes — 列表
  app.get('/api/enterprise/:tenantId/outcomes', async (request, reply) => {
    const { tenantId } = request.params as any
    const { status, outcomeType, limit } = request.query as any
    const outcomes = await outcomeService.listOutcomes(tenantId, {
      status,
      outcomeType,
      limit: parseInt(limit) || 50,
    })
    return reply.send(withDataSource({ code: 0, data: outcomes }, tenantId))
  })

  // GET /api/enterprise/:tenantId/decisions/:id/feedback — Decision Feedback
  app.get('/api/enterprise/:tenantId/decisions/:id/feedback', async (request, reply) => {
    const { id: decisionId } = request.params as any
    const feedbacks = await decisionFeedbackService.listFeedbackByDecision(decisionId)
    const aggregateDelta = await decisionFeedbackService.getAggregateConfidenceDelta(decisionId)
    return reply.send({ code: 0, data: { feedbacks, aggregateDelta } })
  })

  // GET /api/enterprise/:tenantId/outcomes/stats — 统计
  app.get('/api/enterprise/:tenantId/outcomes/stats', async (request, reply) => {
    const { tenantId } = request.params as any
    const allOutcomes = await outcomeService.listOutcomes(tenantId, { limit: 1000 })
    
    const stats = {
      total: allOutcomes.length,
      byStatus: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      verified: 0,
      pending: 0,
      impact: {
        operational: 0,
        engagement: 0,
        conversion: 0,
        revenue: 0,
      },
    }

    for (const o of allOutcomes) {
      stats.byStatus[o.status] = (stats.byStatus[o.status] || 0) + 1
      stats.byType[o.outcomeType] = (stats.byType[o.outcomeType] || 0) + 1
      if (o.status === 'VERIFIED') stats.verified++
      if (o.status === 'PENDING_VERIFY') stats.pending++
      if (o.impactType && o.impactType in stats.impact) {
        stats.impact[o.impactType as keyof typeof stats.impact]++
      }
    }

    return reply.send(withDataSource({ code: 0, data: stats }, tenantId))
  })
}
