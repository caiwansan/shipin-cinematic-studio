// ─── Sprint-09E-03 Career Planning API + 09E-04 Career Action API (Fastify) ─────
// 对外暴露的职业智能分析端点 + 行动追踪端点
// 严格数据质量门控：只服务 dataQualityStatus=valid 的用户

import { FastifyInstance } from 'fastify'
import { buildCareerPlanningContext } from '../services/career/career-planning-context.js'
import {
  generateCareerIntelligence,
  formatIntelligenceForUser,
} from '../services/career/career-intelligence-engine.js'
import {
  generateCareerActions,
  validateActionPlan,
} from '../services/career/career-action-converter.js'
import {
  createActionProgressBatch,
  getUserActionProgress,
  updateActionProgress,
  processFeedback,
} from '../services/career/career-action-progress.service.js'

export const careerPlanningRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /api/career/planning
   *
   * 请求体：
   *   userGoal?: string — 用户明确的职业目标
   *   constraints?: string[] — 用户约束
   *
   * 响应：
   *   structured: CareerIntelligenceOutput（结构化分析）
   *   readable: string（面向用户的文字摘要）
   *   error?: string（数据不足时的说明）
   */
  fastify.post('/api/career/planning', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ error: '未授权' })
      }

      const { userGoal, constraints } = request.body as {
        userGoal?: string
        constraints?: string[]
      }

      // ── Step 1: 构建职业规划上下文（含数据质量门控）──
      let ctx
      try {
        ctx = await buildCareerPlanningContext(userId, userGoal, constraints)
      } catch (e: any) {
        if (e.message?.includes('legacy_unknown')) {
          return reply.status(400).send({
            error: '当前数据为历史遗留数据，暂不支持职业分析。',
            code: 'LEGACY_DATA',
          })
        }
        if (e.message?.includes('review_required')) {
          return reply.status(400).send({
            error: '数据需要人工审查后再试。',
            code: 'REVIEW_REQUIRED',
          })
        }
        if (e.message?.includes('无 CareerProfile')) {
          return reply.status(400).send({
            error: '请先完善职业信息后再进行职业分析。',
            code: 'NO_PROFILE',
            missing: ['career_profile'],
          })
        }
        throw e
      }

      // ── Step 2: 生成职业智能分析 ──
      const output = await generateCareerIntelligence(ctx)

      // ── Step 3: 生成可读摘要 ──
      const readable = formatIntelligenceForUser(output)

      // SPRINT-AGENT-OUTCOME-01: 职业规划真实生成 → 统一结果登记
      try {
        const { outcomeRegistry } = await import('../services/enterprise/outcome-registry.service.js')
        await outcomeRegistry.record({
          userId,
          workspace: 'career',
          outcomeType: 'CAREER_PLAN_CREATED',
          sourceExecutionId: `planning:${userId}:${Date.now()}`,
          metadata: { goal: userGoal || null, hasEnoughData: ctx.missingInformation.length <= 2 },
        })
      } catch (oe: any) {
        console.warn(`[CareerPlanning] outcome record skipped: ${oe.message}`)
      }

      return reply.send({
        structured: output,
        readable,
        context: {
          hasEnoughData: ctx.missingInformation.length <= 2,
          missingInfo: ctx.missingInformation,
          dataQualityStatus: ctx.dataQualityStatus,
        },
      })
    } catch (e: any) {
      console.error('[CareerPlanning] Error:', e)
      return reply.status(500).send({
        error: '职业分析失败，请稍后重试。',
        code: 'INTERNAL_ERROR',
      })
    }
  })

  /**
   * GET /api/career/planning/preview
   *
   * 快速预览：返回当前职业数据的概要，不生成完整分析
   */
  fastify.get('/api/career/planning/preview', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ error: '未授权' })
      }

      let ctx
      try {
        ctx = await buildCareerPlanningContext(userId)
      } catch (e: any) {
        const msg = e.message || ''
        if (msg.includes('legacy_unknown') || msg.includes('review_required')) {
          return reply.send({
            ready: false,
            reason: '数据质量状态不允许',
            dataQualityStatus: msg.includes('legacy_unknown') ? 'legacy_unknown' : 'review_required',
          })
        }
        if (msg.includes('无 CareerProfile')) {
          return reply.send({
            ready: false,
            reason: '未完善职业信息',
          })
        }
        throw e
      }

      const ready = ctx.missingInformation.length <= 2
      return reply.send({
        ready,
        canAnalyze: ready,
        missingInformation: ctx.missingInformation,
        dataSources: ctx.dataSources,
        dataQualityStatus: ctx.dataQualityStatus,
        yearsExperience: ctx.yearsExperience,
        workHistoryCount: ctx.workHistory.length,
        skillCount: ctx.skills.length,
      })
    } catch (e: any) {
      console.error('[CareerPlanning] Preview Error:', e)
      return reply.status(500).send({ error: '获取预览失败' })
    }
  })

  // ────────────────────────────────────────────────
  // Sprint-09E-04 Career Action API
  // ────────────────────────────────────────────────

  /**
   * POST /api/career/planning/actions
   *
   * 先执行规划，再自动生成行动计划
   * 行动自动创建 progress 记录
   */
  fastify.post('/api/career/planning/actions', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ error: '未授权' })
      }

      const { userGoal, constraints } = request.body as {
        userGoal?: string
        constraints?: string[]
      }

      // Step 1: Build context (含数据质量门控)
      let ctx
      try {
        ctx = await buildCareerPlanningContext(userId, userGoal, constraints)
      } catch (e: any) {
        if (e.message?.includes('legacy_unknown')) {
          return reply.status(400).send({ error: '历史数据暂不支持', code: 'LEGACY_DATA' })
        }
        if (e.message?.includes('无 CareerProfile')) {
          return reply.status(400).send({ error: '请完善信息', code: 'NO_PROFILE' })
        }
        throw e
      }

      // Step 2: Generate intelligence
      const output = await generateCareerIntelligence(ctx)

      // Step 3: Convert to actions
      const actionPlan = generateCareerActions(output)

      // 无路径时返回空
      if (!validateActionPlan(actionPlan) || actionPlan.actions30Days.length === 0) {
        return reply.send({
          actions: { actions30Days: [], actions90Days: [], actions12Months: [] },
          context: { hasEnoughData: false, missingInfo: ctx.missingInformation },
        })
      }

      // Step 4: Save progress records
      const allActions = [
        ...actionPlan.actions30Days,
        ...actionPlan.actions90Days,
        ...actionPlan.actions12Months,
      ]
      await createActionProgressBatch(
        userId,
        allActions.map((a) => ({
          userId,
          actionId: a.id,
          actionTitle: a.title,
          phase: a.phase,
        })),
      )

      return reply.send({
        actions: actionPlan,
        readable: formatActionsForUser(actionPlan),
        context: {
          hasEnoughData: true,
          totalActions: allActions.length,
        },
      })
    } catch (e: any) {
      console.error('[CareerAction] Error:', e)
      return reply.status(500).send({ error: '生成行动计划失败' })
    }
  })

  /**
   * GET /api/career/actions
   *
   * 查看用户的所有行动进度
   */
  fastify.get('/api/career/actions', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ error: '未授权' })
      }

      const progress = await getUserActionProgress(userId)
      return reply.send({ progress })
    } catch (e: any) {
      console.error('[CareerAction] List Error:', e)
      return reply.status(500).send({ error: '获取行动进度失败' })
    }
  })

  /**
   * PATCH /api/career/actions/:id
   *
   * 用户更新行动状态
   * ⚠️ completed 只能由用户确认（通过 evidence 字段）
   */
  fastify.patch('/api/career/actions/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ error: '未授权' })
      }

      const { id } = request.params as { id: string }
      const { status, evidence } = request.body as {
        status?: 'pending' | 'doing' | 'completed' | 'rejected'
        evidence?: string
      }

      const updated = await updateActionProgress(id, userId, {
        status,
        evidence: status === 'completed' ? evidence : undefined,
      })

      return reply.send({ progress: updated })
    } catch (e: any) {
      if (e.message === 'ACTION_NOT_FOUND') {
        return reply.status(404).send({ error: '行动记录不存在' })
      }
      console.error('[CareerAction] Update Error:', e)
      return reply.status(500).send({ error: '更新失败' })
    }
  })

  /**
   * POST /api/career/actions/feedback
   *
   * 用户反馈：完成/拒绝某个行动，影响技能和下次规划
   */
  fastify.post('/api/career/actions/feedback', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ error: '未授权' })
      }

      const { actionId, feedback, status, alternativePath } =
        request.body as {
          actionId: string
          feedback: string
          status: 'doing' | 'completed' | 'rejected'
          alternativePath?: string
        }

      if (!actionId || !feedback || !status) {
        return reply.status(400).send({ error: '缺少必填字段' })
      }

      const result = await processFeedback(
        userId,
        actionId,
        feedback,
        status,
        alternativePath,
      )

      return reply.send({ result })
    } catch (e: any) {
      if (e.message === 'ACTION_NOT_FOUND') {
        return reply.status(404).send({ error: '行动记录不存在' })
      }
      console.error('[CareerAction] Feedback Error:', e)
      return reply.status(500).send({ error: '反馈处理失败' })
    }
  })
}

/**
 * 格式化行动计划为可读文本
 */
function formatActionsForUser(plan: {
  actions30Days: any[]
  actions90Days: any[]
  actions12Months: any[]
}): string {
  const lines: string[] = []

  lines.push('📋 你的行动计划')
  lines.push('')

  if (plan.actions30Days.length > 0) {
    lines.push('未来 30 天 — 立即行动：')
    for (const a of plan.actions30Days) {
      const priority = a.priority === 'high' ? '🔴' : a.priority === 'medium' ? '🟡' : '🟢'
      lines.push(`  ${priority} ${a.title}`)
    }
    lines.push('')
  }

  if (plan.actions90Days.length > 0) {
    lines.push('未来 90 天 — 深化推进：')
    for (const a of plan.actions90Days) {
      lines.push(`  📌 ${a.title}`)
    }
    lines.push('')
  }

  if (plan.actions12Months.length > 0) {
    lines.push('未来 12 个月 — 方向落地：')
    for (const a of plan.actions12Months) {
      lines.push(`  🎯 ${a.title}`)
    }
  }

  return lines.join('\n')
}
