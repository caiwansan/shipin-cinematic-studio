/**
 * Sprint-08D: Interview Agent Domain
 * 
 * AI 面试官的核心工作对象 — InterviewSession
 * 
 * Architecture (CTO Frozen):
 *   Conversation 负责：是否值得进一步沟通
 *   Interview 负责：是否适合录用
 *   两个阶段独立，不无限增长
 * 
 * Domain 独立性：
 *   Campaign、Conversation、Interview 不互相引用
 *   统一通过 Job Posting + Candidate 建立联系
 * 
 * Status Lifecycle:
 *   preparing → question_ready → in_progress → evaluating → completed → decision_made
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { InterviewAgent, JobContext, ResumeContext } from '../agents/job/interview-agent.js'
import { requireEnterpriseWorkspaceContext } from '../services/enterprise-context.service.js'

const prisma = new PrismaClient()
const interviewAgent = new InterviewAgent()

// ─── Status Constants ───
const INTERVIEW_STATUS = {
  PREPARING: 'preparing',
  QUESTION_READY: 'question_ready',
  IN_PROGRESS: 'in_progress',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  DECISION_MADE: 'decision_made',
} as const

const STATUS_TRANSITIONS: Record<string, string[]> = {
  preparing: ['question_ready'],
  question_ready: ['in_progress', 'preparing'], // 允许重新生成
  in_progress: ['evaluating'],
  evaluating: ['completed'],
  completed: ['decision_made', 'in_progress'], // 允许重新评估
  decision_made: [], // 终态
}

// ─── Helpers ───

function getWorkspaceId(req: FastifyRequest): string {
  return (req.query as any)?.workspaceId || (req.body as any)?.workspaceId || ''
}

function isValidTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

function buildJobContext(job: any): JobContext {
  return {
    title: job.title || '',
    skills: job.skills || [],
    salary: job.salary || '',
    location: job.location || '',
    requirements: job.requirements || [],
    level: job.level || 'mid',
  }
}

function buildResumeContext(candidateName: string, resume?: any): ResumeContext {
  if (!resume) {
    return {
      name: candidateName,
      skills: [],
      experienceYears: 0,
      education: '',
      city: '',
      careerGoal: '',
      projects: '',
    }
  }
  return {
    name: candidateName,
    skills: resume.skills || [],
    experienceYears: resume.experienceYears || 0,
    education: resume.education || '',
    city: resume.city || '',
    careerGoal: resume.careerGoal || '',
    projects: resume.projects || '',
  }
}

// ─── Routes ───

export default async function recruitmentInterviewRoutes(fastify: FastifyInstance) {

  /**
   * GET /api/enterprise/recruitment-interview
   * 列出当前 workspace 的所有 Interview Session
   * Query: workspaceId, status?, limit?, offset?
   */
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).user?.id || (req as any).userId
    const workspaceId = getWorkspaceId(req)
    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })

    // Observation Sprint Step 1-B-2: workspace tenant boundary guard
    const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
    if (!wsc) return reply.status(403).send({ success: false, message: 'Workspace access denied' })

    const { status, limit = '50', offset = '0' } = req.query as any
    const where: any = { workspaceId: wsc.workspace.id }
    if (status) where.status = status

    const [sessions, total] = await Promise.all([
      prisma.interviewSession.findMany({
        where,
        include: {
          job: { select: { id: true, title: true } },
          questions: { select: { id: true, category: true, score: true } },
          evaluation: { select: { id: true, overallScore: true, recommendation: true } },
          decision: { select: { id: true, decision: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
      }),
      prisma.interviewSession.count({ where }),
    ])

    return reply.send({ success: true, data: { sessions, total } })
  })

  /**
   * GET /api/enterprise/recruitment-interview/:id
   * 获取 Interview 详情（含 Questions + Evaluation + Decision + Notes）
   */
  fastify.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const userId = (req as any).user?.id || (req as any).userId
    const workspaceId = getWorkspaceId(req)

    // Observation Sprint Step 1-B-2: workspace tenant boundary guard
    const wsc = workspaceId ? await requireEnterpriseWorkspaceContext(userId, workspaceId) : null
    if (workspaceId && !wsc) return reply.status(403).send({ success: false, message: 'Workspace access denied' })

    const session = await prisma.interviewSession.findFirst({
      where: { id, ...(wsc ? { workspaceId: wsc.workspace.id } : {}) },
      include: {
        job: { select: { id: true, title: true, description: true, salary: true, location: true, requirements: true } },
        pipeline: { select: { id: true } },
        questions: { orderBy: { createdAt: 'asc' } },
        evaluation: true,
        decision: true,
        notes: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    return reply.send({ success: true, data: session })
  })

  /**
   * POST /api/enterprise/recruitment-interview
   * 创建 Interview Session
   * Body: { workspaceId, jobId, candidateName, pipelineId?, resumeId?, title?, interviewerId? }
   */
  fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    const userId = (req as any).user?.id || (req as any).userId
    const { workspaceId, jobId, candidateName, pipelineId, resumeId, title, interviewerId } = body

    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })
    if (!jobId) return reply.status(400).send({ success: false, message: 'jobId required' })
    if (!candidateName) return reply.status(400).send({ success: false, message: 'candidateName required' })

    // Observation Sprint Step 1-B-2: workspace tenant boundary guard
    const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
    if (!wsc) return reply.status(403).send({ success: false, message: 'Workspace access denied' })
    const ws = wsc.workspace

    // Validate job posting
    const job = await prisma.jobPosting.findFirst({
      where: { id: jobId, enterpriseId: ws.enterpriseId },
    })
    if (!job) return reply.status(404).send({ success: false, message: 'Job posting not found' })

    const session = await prisma.interviewSession.create({
      data: {
        workspaceId,
        jobId,
        pipelineId: pipelineId || null,
        candidateName,
        title: title || `${candidateName} - ${job.title} 面试`,
        interviewerId: interviewerId || null,
        status: INTERVIEW_STATUS.PREPARING,
      },
      include: { job: true },
    })

    return reply.status(201).send({ success: true, data: session })
  })

  /**
   * POST /api/enterprise/recruitment-interview/:id/generate-questions
   * AI 生成面试题目（基于 Job + Resume）
   * 调用 InterviewAgent.generateInterviewPlan()
   * 生成后状态: preparing → question_ready
   */
  fastify.post('/:id/generate-questions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const userId = (req as any).user?.id || (req as any).userId
    const workspaceId = getWorkspaceId(req)

    // Observation Sprint Step 1-B-2: workspace tenant boundary guard
    const wsc = workspaceId ? await requireEnterpriseWorkspaceContext(userId, workspaceId) : null
    if (workspaceId && !wsc) return reply.status(403).send({ success: false, message: 'Workspace access denied' })

    const session = await prisma.interviewSession.findFirst({
      where: { id, ...(wsc ? { workspaceId: wsc.workspace.id } : {}) },
      include: { job: true },
    })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    if (!isValidTransition(session.status, INTERVIEW_STATUS.QUESTION_READY)) {
      return reply.status(409).send({
        success: false,
        message: `Cannot generate questions from status: ${session.status}. Allowed from: preparing, question_ready (regenerate)`,
      })
    }

    // Build contexts
    const jobContext = buildJobContext(session.job)
    const resumeContext = buildResumeContext(session.candidateName)

    // Generate interview plan using template engine
    const plan = interviewAgent.generateInterviewPlan(jobContext, resumeContext)

    // Delete old questions if regenerating
    await prisma.interviewQuestion.deleteMany({ where: { sessionId: id } })

    // Create questions in DB
    const questions = await Promise.all(
      plan.questions.map((q: any) =>
        prisma.interviewQuestion.create({
          data: {
            sessionId: id,
            category: q.category,
            question: q.question,
            expectedAnswer: q.expectedAnswer || null,
            followUp: q.followUp || null,
          },
        })
      )
    )

    // Update session status
    const updated = await prisma.interviewSession.update({
      where: { id },
      data: {
        status: INTERVIEW_STATUS.QUESTION_READY,
        updatedAt: new Date(),
      },
    })

    return reply.send({
      success: true,
      data: {
        session: updated,
        plan: {
          title: plan.title,
          totalQuestions: plan.totalQuestions,
          estimatedDuration: plan.estimatedDuration,
          focusAreas: plan.focusAreas,
          riskAreas: plan.riskAreas,
        },
        questions,
      },
    })
  })

  /**
   * POST /api/enterprise/recruitment-interview/:id/start
   * 开始面试（状态: question_ready → in_progress）
   * Body: {}
   */
  fastify.post('/:id/start', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any

    const session = await prisma.interviewSession.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    if (!isValidTransition(session.status, INTERVIEW_STATUS.IN_PROGRESS)) {
      return reply.status(409).send({
        success: false,
        message: `Cannot start from status: ${session.status}. Need question_ready.`,
      })
    }

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { status: INTERVIEW_STATUS.IN_PROGRESS, startedAt: new Date(), updatedAt: new Date() },
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * POST /api/enterprise/recruitment-interview/:id/answer
   * 提交单题答案
   * Body: { questionId, answer }
   */
  fastify.post('/:id/answer', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { questionId, answer } = body

    if (!questionId) return reply.status(400).send({ success: false, message: 'questionId required' })
    if (!answer) return reply.status(400).send({ success: false, message: 'answer required' })

    const session = await prisma.interviewSession.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    if (session.status !== INTERVIEW_STATUS.IN_PROGRESS) {
      return reply.status(409).send({ success: false, message: `Cannot answer in status: ${session.status}` })
    }

    // Update question with answer
    const question = await prisma.interviewQuestion.findFirst({
      where: { id: questionId, sessionId: id },
    })
    if (!question) return reply.status(404).send({ success: false, message: 'Question not found in this session' })

    const updated = await prisma.interviewQuestion.update({
      where: { id: questionId },
      data: { answer },
    })

    // Generate follow-up suggestion
    const followUp = interviewAgent.generateFollowUp(question.question, answer)

    return reply.send({ success: true, data: { question: updated, followUpSuggestion: followUp } })
  })

  /**
   * POST /api/enterprise/recruitment-interview/:id/submit-answers
   * 批量提交答案 + 评分（每题一个 score）
   * Body: { answers: [{ questionId, answer, score }] }
   * 状态: in_progress → evaluating
   */
  fastify.post('/:id/submit-answers', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { answers } = body

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return reply.status(400).send({ success: false, message: 'answers array required' })
    }

    const session = await prisma.interviewSession.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    if (session.status !== INTERVIEW_STATUS.IN_PROGRESS) {
      return reply.status(409).send({ success: false, message: `Cannot submit in status: ${session.status}` })
    }

    // Update all questions with answers + scores
    await Promise.all(
      answers.map((a: any) =>
        prisma.interviewQuestion.update({
          where: { id: a.questionId },
          data: {
            answer: a.answer || null,
            score: typeof a.score === 'number' ? Math.min(100, Math.max(0, a.score)) : null,
          },
        })
      )
    )

    // Move to evaluating
    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { status: INTERVIEW_STATUS.EVALUATING, updatedAt: new Date() },
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * POST /api/enterprise/recruitment-interview/:id/evaluate
   * AI 生成面试评估报告
   * 调用 InterviewAgent.generateEvaluation()
   * 状态: evaluating → completed
   */
  fastify.post('/:id/evaluate', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any

    const session = await prisma.interviewSession.findFirst({
      where: { id },
      include: {
        job: true,
        questions: true,
      },
    })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    if (session.status !== INTERVIEW_STATUS.EVALUATING && session.status !== INTERVIEW_STATUS.COMPLETED) {
      return reply.status(409).send({
        success: false,
        message: `Cannot evaluate from status: ${session.status}. Need evaluating.`,
      })
    }

    // Build evaluation input from questions
    const questions = session.questions.map((q: any) => ({
      category: q.category,
      question: q.question,
      score: q.score || 0,
      answer: q.answer || undefined,
    }))

    const evaluationInput = {
      jobTitle: session.job.title || '',
      questions,
      resumeStrengths: [],
      resumeRisks: [],
    }

    // Generate evaluation using template engine
    const result = interviewAgent.generateEvaluation(evaluationInput)

    // Upsert evaluation
    const evaluation = await prisma.interviewEvaluation.upsert({
      where: { sessionId: id },
      create: {
        sessionId: id,
        overallScore: result.overallScore,
        technicalScore: result.technicalScore,
        communicationScore: result.communicationScore,
        cultureScore: result.cultureScore,
        strengths: result.strengths,
        risks: result.risks,
        recommendation: result.recommendation,
        summary: result.summary,
        nextSteps: result.nextSteps,
      },
      update: {
        overallScore: result.overallScore,
        technicalScore: result.technicalScore,
        communicationScore: result.communicationScore,
        cultureScore: result.cultureScore,
        strengths: result.strengths,
        risks: result.risks,
        recommendation: result.recommendation,
        summary: result.summary,
        nextSteps: result.nextSteps,
      },
    })

    // Update session status
    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { status: INTERVIEW_STATUS.COMPLETED, completedAt: new Date(), updatedAt: new Date() },
    })

    return reply.send({
      success: true,
      data: {
        session: updated,
        evaluation,
      },
    })
  })

  /**
   * POST /api/enterprise/recruitment-interview/:id/decision
   * HR 做出面试决策
   * Body: { decision, reason?, createdBy? }
   * decision: hire | reject | next_round | pending
   * 状态: completed → decision_made
   */
  fastify.post('/:id/decision', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { decision, reason, createdBy } = body

    const VALID_DECISIONS = ['hire', 'reject', 'next_round', 'pending']
    if (!VALID_DECISIONS.includes(decision)) {
      return reply.status(400).send({ success: false, message: `decision must be one of: ${VALID_DECISIONS.join(', ')}` })
    }

    const session = await prisma.interviewSession.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    if (!isValidTransition(session.status, INTERVIEW_STATUS.DECISION_MADE)) {
      return reply.status(409).send({
        success: false,
        message: `Cannot make decision from status: ${session.status}. Need completed.`,
      })
    }

    const result = await prisma.interviewDecision.create({
      data: {
        sessionId: id,
        decision,
        reason: reason || null,
        createdBy: createdBy || null,
      },
    })

    const updated = await prisma.interviewSession.update({
      where: { id },
      data: { status: INTERVIEW_STATUS.DECISION_MADE, updatedAt: new Date() },
    })

    return reply.send({ success: true, data: { session: updated, decision: result } })
  })

  /**
   * POST /api/enterprise/recruitment-interview/:id/notes
   * 添加面试笔记
   * Body: { content, createdBy? }
   */
  fastify.post('/:id/notes', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { content, createdBy } = body

    if (!content) return reply.status(400).send({ success: false, message: 'content required' })

    const session = await prisma.interviewSession.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    const note = await prisma.interviewNote.create({
      data: {
        sessionId: id,
        content,
        createdBy: createdBy || null,
      },
    })

    return reply.status(201).send({ success: true, data: note })
  })

  /**
   * PATCH /api/enterprise/recruitment-interview/:id/status
   * 手动状态流转（用于修复/回退）
   * Body: { status }
   */
  fastify.patch('/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { status: newStatus } = body

    const session = await prisma.interviewSession.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    if (!isValidTransition(session.status, newStatus)) {
      return reply.status(409).send({
        success: false,
        message: `Invalid transition: ${session.status} → ${newStatus}. Allowed: ${(STATUS_TRANSITIONS[session.status] || []).join(', ')}`,
      })
    }

    const updateData: any = { status: newStatus, updatedAt: new Date() }
    if (newStatus === INTERVIEW_STATUS.IN_PROGRESS) updateData.startedAt = new Date()
    if (newStatus === INTERVIEW_STATUS.COMPLETED) updateData.completedAt = new Date()

    const updated = await prisma.interviewSession.update({ where: { id }, data: updateData })
    return reply.send({ success: true, data: updated })
  })

  /**
   * DELETE /api/enterprise/recruitment-interview/:id
   * 删除 Interview Session（级联删除 Questions/Evaluation/Decision/Notes）
   */
  fastify.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any

    const session = await prisma.interviewSession.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ success: false, message: 'Interview not found' })

    // Cascade delete
    await prisma.interviewQuestion.deleteMany({ where: { sessionId: id } })
    await prisma.interviewEvaluation.deleteMany({ where: { sessionId: id } })
    await prisma.interviewDecision.deleteMany({ where: { sessionId: id } })
    await prisma.interviewNote.deleteMany({ where: { sessionId: id } })
    await prisma.interviewSession.delete({ where: { id } })

    return reply.send({ success: true, message: 'Interview session deleted' })
  })

  /**
   * GET /api/enterprise/recruitment-interview/stats
   * Interview 统计（Dashboard 用）
   * Query: workspaceId
   */
  fastify.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).user?.id || (req as any).userId
    const workspaceId = getWorkspaceId(req)
    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })

    // Observation Sprint Step 1-B-2: workspace tenant boundary guard
    const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
    if (!wsc) return reply.status(403).send({ success: false, message: 'Workspace access denied' })

    const [
      total,
      byStatus,
      avgScore,
      decisionBreakdown,
    ] = await Promise.all([
      prisma.interviewSession.count({ where: { workspaceId: wsc.workspace.id } }),
      prisma.interviewSession.groupBy({
        by: ['status'],
        where: { workspaceId: wsc.workspace.id },
        _count: { status: true },
      }),
      prisma.interviewEvaluation.aggregate({
        where: { session: { workspaceId: wsc.workspace.id } },
        _avg: { overallScore: true },
      }),
      prisma.interviewDecision.groupBy({
        by: ['decision'],
        where: { session: { workspaceId: wsc.workspace.id } },
        _count: { decision: true },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    for (const row of byStatus) statusCounts[row.status] = row._count.status

    const decisions: Record<string, number> = {}
    for (const row of decisionBreakdown) decisions[row.decision] = row._count.decision

    return reply.send({
      success: true,
      data: {
        total,
        byStatus: statusCounts,
        avgOverallScore: Math.round(avgScore._avg?.overallScore || 0),
        decisions,
      },
    })
  })

  /**
   * POST /api/enterprise/recruitment-interview/from-conversation
   * 从 Conversation 创建 Interview（Conversation → Interview 衔接）
   * Body: { workspaceId, conversationId, jobId, candidateName }
   * 
   * CTO Rule: Conversation 负责"是否值得进一步沟通"
   *         Interview 负责"是否适合录用"
   *         两个阶段独立，通过 Job + Candidate 关联
   */
  fastify.post('/from-conversation', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    const userId = (req as any).user?.id || (req as any).userId
    const { workspaceId, conversationId, jobId, candidateName } = body

    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })
    if (!conversationId) return reply.status(400).send({ success: false, message: 'conversationId required' })
    if (!jobId) return reply.status(400).send({ success: false, message: 'jobId required' })
    if (!candidateName) return reply.status(400).send({ success: false, message: 'candidateName required' })

    // Observation Sprint Step 1-B-2: workspace tenant boundary guard
    const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
    if (!wsc) return reply.status(403).send({ success: false, message: 'Workspace access denied' })
    const ws = wsc.workspace

    // Validate conversation exists
    const conversation = await prisma.recruitmentConversation.findFirst({
      where: { id: conversationId, workspaceId },
    })
    if (!conversation) return reply.status(404).send({ success: false, message: 'Conversation not found' })

    // Validate job posting
    const job = await prisma.jobPosting.findFirst({
      where: { id: jobId, enterpriseId: ws.enterpriseId },
    })
    if (!job) return reply.status(404).send({ success: false, message: 'Job posting not found' })

    // Create Interview Session (linked via jobId + candidateName, NOT direct conversation reference)
    const session = await prisma.interviewSession.create({
      data: {
        workspaceId,
        jobId,
        candidateName,
        title: `${candidateName} - ${job.title} 面试`,
        status: INTERVIEW_STATUS.PREPARING,
      },
      include: { job: true },
    })

    return reply.status(201).send({
      success: true,
      data: {
        session,
        message: 'Interview created from conversation. Conversation and Interview are independent domains linked by Job + Candidate.',
      },
    })
  })
}
