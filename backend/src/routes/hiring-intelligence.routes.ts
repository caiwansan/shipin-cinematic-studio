/**
 * hiring-intelligence.routes.ts — Hiring Intelligence 数据沉淀 API
 * Sprint 08: 招聘决策数据沉淀为数据资产
 *
 * GET /api/enterprise/hiring-intelligence/insights
 *   - 招聘洞察汇总（面试人数、Offer人数、录用人数、平均匹配度等）
 *   - 支持按时间范围查询
 *
 * GET /api/enterprise/hiring-intelligence/decisions
 *   - 招聘决策历史记录
 *   - 支持按企业/岗位/时间范围查询
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { resolveEnterpriseId } from '../services/enterprise-context.service.js'

export async function hiringIntelligenceRoutes(fastify: FastifyInstance) {

  // ── JWT Auth ──
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ── GET /api/enterprise/hiring-intelligence/insights ──
  // 招聘洞察汇总 — Command Center 展示用
  fastify.get('/api/enterprise/hiring-intelligence/insights', async (request, reply) => {
    const userId = (request.user as any)?.id || (request.user as any)?.userId
    const { range = 'month' } = request.query as { range?: string }

    const enterpriseId = await resolveEnterpriseId(userId)
    if (!enterpriseId) {
      return reply.status(400).send({ error: 'No enterprise identity' })
    }

    // Calculate date range
    const now = new Date()
    const startDate = new Date()
    if (range === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else if (range === 'month') {
      startDate.setMonth(now.getMonth() - 1)
    } else if (range === 'quarter') {
      startDate.setMonth(now.getMonth() - 3)
    } else {
      startDate.setMonth(now.getMonth() - 1) // default month
    }

    try {
      // 1. Job postings count
      const [totalJobs, activeJobs] = await Promise.all([
        prisma.jobPosting.count({ where: { enterpriseId } }),
        prisma.jobPosting.count({ where: { enterpriseId, status: 'active' } }),
      ])

      // 2. Interview stats
      const [totalInterviews, completedInterviews, interviewsInPeriod] = await Promise.all([
        prisma.interviewSession.count({
          where: { workspace: { enterpriseId } },
        }),
        prisma.interviewSession.count({
          where: { workspace: { enterpriseId }, status: { in: ['completed', 'decision_made'] } },
        }),
        prisma.interviewSession.count({
          where: {
            workspace: { enterpriseId },
            createdAt: { gte: startDate },
          },
        }),
      ])

      // 3. Average interview score
      const avgScoreResult = await prisma.interviewEvaluation.aggregate({
        where: { session: { workspace: { enterpriseId } } },
        _avg: { overallScore: true },
      })

      // 4. Decision breakdown
      const decisionGroups = await prisma.interviewDecision.groupBy({
        by: ['decision'],
        where: { session: { workspace: { enterpriseId } } },
        _count: { decision: true },
      })

      const decisions: Record<string, number> = {}
      for (const g of decisionGroups) {
        decisions[g.decision] = g._count.decision
      }

      // 5. Pipeline stats
      const pipelineStats = await prisma.recruitmentPipeline.groupBy({
        by: ['stage'],
        where: { workspace: { enterpriseId } },
        _count: { stage: true },
      })

      const pipeline: Record<string, number> = {}
      for (const g of pipelineStats) {
        pipeline[g.stage] = g._count.stage
      }

      // 6. Match score average
      const avgMatchResult = await prisma.candidateMatch.aggregate({
        where: { workspace: { enterpriseId } },
        _avg: { matchScore: true },
        _count: { matchScore: true },
      })

      // 7. Candidates in period
      const candidatesInPeriod = await prisma.candidateMatch.count({
        where: {
          workspace: { enterpriseId },
          createdAt: { gte: startDate },
        },
      })

      return reply.send({
        success: true,
        data: {
          period: range,
          periodStart: startDate.toISOString(),
          jobs: { total: totalJobs, active: activeJobs },
          interviews: {
            total: totalInterviews,
            completed: completedInterviews,
            inPeriod: interviewsInPeriod,
            avgScore: Math.round(avgScoreResult._avg?.overallScore || 0),
          },
          decisions: {
            hire: decisions.hire || 0,
            reject: decisions.reject || 0,
            nextRound: decisions.next_round || 0,
            pending: decisions.pending || 0,
          },
          pipeline: {
            discovered: pipeline.discovered || 0,
            screening: pipeline.screening || 0,
            interview: pipeline.interview || 0,
            offer: pipeline.offer || 0,
            hired: pipeline.hired || 0,
            rejected: pipeline.rejected || 0,
          },
          matches: {
            total: avgMatchResult._count?.matchScore || 0,
            avgScore: Math.round(avgMatchResult._avg?.matchScore || 0),
            inPeriod: candidatesInPeriod,
          },
        },
      })
    } catch (error: any) {
      request.log.error(`[hiring-intelligence] insights: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to fetch insights' })
    }
  })

  // ── GET /api/enterprise/hiring-intelligence/decisions ──
  // 招聘决策历史 — 支持分页和筛选
  fastify.get('/api/enterprise/hiring-intelligence/decisions', async (request, reply) => {
    const userId = (request.user as any)?.id || (request.user as any)?.userId
    const { jobId, status, limit = '20', offset = '0' } = request.query as {
      jobId?: string
      status?: string
      limit?: string
      offset?: string
    }

    const enterpriseId = await resolveEnterpriseId(userId)
    if (!enterpriseId) {
      return reply.status(400).send({ error: 'No enterprise identity' })
    }

    try {
      const where: any = {
        session: { workspace: { enterpriseId } },
        ...(status ? { decision: status } : {}),
        ...(jobId ? { session: { jobId } } : {}),
      }

      const [decisions, total] = await Promise.all([
        prisma.interviewDecision.findMany({
          where,
          include: {
            session: {
              select: {
                id: true,
                candidateName: true,
                title: true,
                job: { select: { title: true } },
                evaluation: {
                  select: {
                    overallScore: true,
                    recommendation: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: Math.min(parseInt(limit), 50),
          skip: parseInt(offset),
        }),
        prisma.interviewDecision.count({ where }),
      ])

      return reply.send({
        success: true,
        data: {
          decisions: decisions.map((d: any) => ({
            id: d.id,
            decision: d.decision,
            reason: d.reason,
            createdBy: d.createdBy,
            createdAt: d.createdAt,
            session: d.session ? {
              id: d.session.id,
              candidateName: d.session.candidateName,
              jobTitle: d.session.job?.title || '',
              overallScore: d.session.evaluation?.overallScore || null,
              recommendation: d.session.evaluation?.recommendation || null,
            } : null,
          })),
          total,
        },
      })
    } catch (error: any) {
      request.log.error(`[hiring-intelligence] decisions: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to fetch decisions' })
    }
  })

  // ── POST /api/enterprise/hiring-intelligence/decisions ──
  // 记录招聘决策（通过 sessionId 关联到面试会话）
  // 注意：InterviewDecision 的 sessionId 是 @unique，每个 Session 只能有一条决策
  fastify.post('/api/enterprise/hiring-intelligence/decisions', async (request, reply) => {
    const userId = (request.user as any)?.id || (request.user as any)?.userId
    const body = request.body as {
      sessionId: string
      decision: string
      reason?: string
    }

    if (!body.sessionId) {
      return reply.status(400).send({ error: 'sessionId required' })
    }
    if (!body.decision) {
      return reply.status(400).send({ error: 'decision required' })
    }

    const VALID_DECISIONS = ['hire', 'reject', 'next_round', 'pending', 'offer']
    if (!VALID_DECISIONS.includes(body.decision)) {
      return reply.status(400).send({ error: `decision must be one of: ${VALID_DECISIONS.join(', ')}` })
    }

    const enterpriseId = await resolveEnterpriseId(userId)
    if (!enterpriseId) {
      return reply.status(400).send({ error: 'No enterprise identity' })
    }

    try {
      // Verify session belongs to this enterprise
      const session = await prisma.interviewSession.findFirst({
        where: { id: body.sessionId, workspace: { enterpriseId } },
      })
      if (!session) {
        return reply.status(404).send({ error: 'Session not found or not owned by enterprise' })
      }

      // Create or update decision
      const decision = await prisma.interviewDecision.upsert({
        where: { sessionId: body.sessionId },
        create: {
          sessionId: body.sessionId,
          decision: body.decision,
          reason: body.reason || null,
          createdBy: userId,
        },
        update: {
          decision: body.decision,
          reason: body.reason || null,
          createdBy: userId,
        },
      })

      return reply.status(201).send({ success: true, data: decision })
    } catch (error: any) {
      request.log.error(`[hiring-intelligence] create decision: ${error.message}`)
      return reply.status(500).send({ error: 'Failed to record decision' })
    }
  })
}
