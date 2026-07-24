/**
 * interview.routes.ts — 面试助手 API
 *
 * Phase 2-P2: AI 面试助手
 * - 生成面试方案
 * - 面试评价报告
 * - 面试管理
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { InterviewAgent } from '../agents/job/interview-agent'

const prisma = new PrismaClient()

export async function interviewRoutes(fastify: FastifyInstance) {

  // 503: Interview 关系尚未完成同步
  fastify.addHook('onRequest', async (_request, reply) => {
    return reply.status(503).send({ error: 'Interview module is under maintenance', module: 'interview', status: 'maintenance' })
  })

  // ─── 生成面试方案 ───

  fastify.post('/api/enterprise/interview/plan', async (request, reply) => {
    const body = request.body as {
      workspaceId: string
      jobId: string
      resumeId?: string
      candidateName: string
      level?: string
    }

    if (!body.workspaceId || !body.jobId || !body.candidateName) {
      return reply.status(400).send({ error: 'workspaceId, jobId, candidateName 都是必填' })
    }

    try {
      // 获取岗位信息
      const job = await prisma.jobPosting.findUnique({
        where: { id: body.jobId },
      })
      if (!job) {
        return reply.status(404).send({ error: '岗位不存在' })
      }

      // 获取简历信息
      let resumeProfile: any = null
      if (body.resumeId) {
        resumeProfile = await prisma.resumeProfile.findFirst({
          where: { resumeId: body.resumeId },
        })
      }

      const agent = new InterviewAgent()

      // 构建岗位上下文
      const jobContext = {
        title: job.title,
        skills: job.skillRequirements || [],
        salary: job.salary || '',
        location: job.location || '',
        requirements: job.requirements?.split(/[,，、\n]/) || [],
        level: body.level || 'mid',
      }

      // 构建简历上下文
      const resumeContext = {
        name: body.candidateName,
        skills: resumeProfile?.skills || [],
        experienceYears: resumeProfile?.experienceYears || 0,
        education: resumeProfile?.education || '',
        city: resumeProfile?.city || '',
        careerGoal: resumeProfile?.careerGoal || '',
        projects: resumeProfile?.projects || '',
      }

      // 生成面试方案
      const plan = agent.generateInterviewPlan(jobContext, resumeContext)

      // 创建面试会话
      const session = await prisma.interviewSession.create({
        data: {
          workspaceId: body.workspaceId,
          jobId: body.jobId,
          resumeId: body.resumeId,
          candidateName: body.candidateName,
          title: plan.title,
          status: 'preparing',
        },
      })

      // 保存面试问题
      for (const q of plan.questions) {
        await prisma.interviewQuestion.create({
          data: {
            sessionId: session.id,
            category: q.category,
            question: q.question,
            expectedAnswer: q.expectedAnswer,
            followUp: q.followUp,
          },
        })
      }

      return {
        success: true,
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
        },
        plan: {
          title: plan.title,
          totalQuestions: plan.totalQuestions,
          estimatedDuration: plan.estimatedDuration,
          focusAreas: plan.focusAreas,
          riskAreas: plan.riskAreas,
          questions: plan.questions,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '生成面试方案失败', detail: e.message })
    }
  })

  // ─── 获取面试方案详情 ───

  fastify.get('/api/enterprise/interview/plan/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }

    try {
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
          questions: { orderBy: { createdAt: 'asc' } },
          evaluation: true,
          job: { select: { title: true, salary: true, location: true } },
        },
      })

      if (!session) {
        return reply.status(404).send({ error: '面试会话不存在' })
      }

      return {
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
          candidateName: session.candidateName,
          createdAt: session.createdAt,
          job: session.job,
          questions: session.questions,
          evaluation: session.evaluation,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取面试方案失败', detail: e.message })
    }
  })

  // ─── 更新面试状态 ───

  fastify.post('/api/enterprise/interview/status', async (request, reply) => {
    const body = request.body as {
      sessionId: string
      status: string
    }

    if (!body.sessionId || !body.status) {
      return reply.status(400).send({ error: 'sessionId 和 status 都是必填' })
    }

    try {
      const data: any = {
        status: body.status,
        updatedAt: new Date(),
      }
      if (body.status === 'ongoing' && !data.startedAt) {
        data.startedAt = new Date()
      }
      if (body.status === 'completed') {
        data.completedAt = new Date()
      }

      await prisma.interviewSession.update({
        where: { id: body.sessionId },
        data,
      })

      return { success: true, message: '状态更新成功' }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新失败', detail: e.message })
    }
  })

  // ─── 更新面试问题答案 ───

  fastify.post('/api/enterprise/interview/answer', async (request, reply) => {
    const body = request.body as {
      questionId: string
      answer: string
      score?: number
    }

    if (!body.questionId || !body.answer) {
      return reply.status(400).send({ error: 'questionId 和 answer 都是必填' })
    }

    try {
      await prisma.interviewQuestion.update({
        where: { id: body.questionId },
        data: {
          answer: body.answer,
          ...(body.score !== undefined ? { score: body.score } : {}),
        },
      })

      return { success: true, message: '答案更新成功' }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新失败', detail: e.message })
    }
  })

  // ─── 生成面试评价报告 ───

  fastify.post('/api/enterprise/interview/evaluate', async (request, reply) => {
    const body = request.body as {
      sessionId: string
    }

    if (!body.sessionId) {
      return reply.status(400).send({ error: 'sessionId 是必填' })
    }

    try {
      // 获取面试会话
      const session = await prisma.interviewSession.findUnique({
        where: { id: body.sessionId },
        include: {
          questions: true,
          job: { select: { title: true } },
        },
      })

      if (!session) {
        return reply.status(404).send({ error: '面试会话不存在' })
      }

      // 获取简历信息
      let resumeProfile: any = null
      if (session.resumeId) {
        resumeProfile = await prisma.resumeProfile.findFirst({
          where: { resumeId: session.resumeId },
        })
      }

      const agent = new InterviewAgent()

      // 生成评价报告
      const evaluation = agent.generateEvaluation({
        jobTitle: session.job?.title || '',
        questions: session.questions.map(q => ({
          category: q.category,
          question: q.question,
          score: q.score || 70,
          answer: q.answer || undefined,
        })),
        resumeStrengths: resumeProfile?.strengths || [],
        resumeRisks: resumeProfile?.weaknesses || [],
      })

      // 保存评价报告
      const saved = await prisma.interviewEvaluation.create({
        data: {
          sessionId: body.sessionId,
          overallScore: evaluation.overallScore,
          technicalScore: evaluation.technicalScore,
          communicationScore: evaluation.communicationScore,
          cultureScore: evaluation.cultureScore,
          strengths: evaluation.strengths,
          risks: evaluation.risks,
          recommendation: evaluation.recommendation,
          summary: evaluation.summary,
          nextSteps: evaluation.nextSteps,
        },
      })

      // 更新面试状态为已完成
      await prisma.interviewSession.update({
        where: { id: body.sessionId },
        data: { status: 'completed', completedAt: new Date() },
      })

      return {
        success: true,
        evaluation: {
          id: saved.id,
          overallScore: saved.overallScore,
          technicalScore: saved.technicalScore,
          communicationScore: saved.communicationScore,
          cultureScore: saved.cultureScore,
          strengths: saved.strengths,
          risks: saved.risks,
          recommendation: saved.recommendation,
          summary: saved.summary,
          nextSteps: saved.nextSteps,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '生成评价报告失败', detail: e.message })
    }
  })

  // ─── 获取面试列表 ───

  fastify.get('/api/enterprise/interviews', async (request, reply) => {
    const { workspaceId, jobId, status } = request.query as {
      workspaceId?: string
      jobId?: string
      status?: string
    }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const sessions = await prisma.interviewSession.findMany({
        where: {
          workspaceId,
          ...(jobId ? { jobId } : {}),
          ...(status ? { status } : {}),
        },
        include: {
          job: { select: { title: true, salary: true } },
          evaluation: { select: { overallScore: true, recommendation: true } },
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      return {
        interviews: sessions.map(s => ({
          id: s.id,
          title: s.title,
          candidateName: s.candidateName,
          status: s.status,
          jobTitle: s.job?.title || '',
          questionCount: s._count.questions,
          overallScore: s.evaluation?.overallScore || null,
          recommendation: s.evaluation?.recommendation || null,
          createdAt: s.createdAt,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取面试列表失败', detail: e.message })
    }
  })

  // ─── 获取面试评价详情 ───

  fastify.get('/api/enterprise/interview/evaluation/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }

    try {
      const evaluation = await prisma.interviewEvaluation.findFirst({
        where: { sessionId },
      })

      if (!evaluation) {
        return reply.status(404).send({ error: '评价报告不存在' })
      }

      return { evaluation }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取评价报告失败', detail: e.message })
    }
  })

  // ─── 获取面试统计 ───

  fastify.get('/api/enterprise/interview/stats', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const totalInterviews = await prisma.interviewSession.count({ where: { workspaceId } })
      const completedInterviews = await prisma.interviewSession.count({
        where: { workspaceId, status: 'completed' },
      })

      const avgScore = await prisma.interviewEvaluation.aggregate({
        _avg: { overallScore: true },
        where: { session: { workspaceId } },
      })

      const statusStats = await prisma.interviewSession.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { status: true },
      })

      return {
        stats: {
          totalInterviews,
          completedInterviews,
          avgScore: Math.round(avgScore._avg.overallScore || 0),
          statusDistribution: statusStats.map(s => ({
            status: s.status,
            count: s._count.status,
          })),
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取统计失败', detail: e.message })
    }
  })
}
