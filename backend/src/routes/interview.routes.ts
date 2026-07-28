import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireEnterpriseWorkspaceContext } from '../services/enterprise-context.service.js'

export const interviewRoutes = async (fastify: FastifyInstance) => {
  // ─── GET /enterprise/interviews — 面试列表 ───
  fastify.get('/enterprise/interviews', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as any

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = workspaceId ? await requireEnterpriseWorkspaceContext(userId, workspaceId) : null
      if (workspaceId && !wsc) return reply.status(403).send({ error: 'Workspace access denied' })

      const sessions = await prisma.interviewSession.findMany({
        where: wsc ? { workspaceId: wsc.workspace.id } : {},
        include: {
          job: true,
          pipeline: true,
          questions: { orderBy: { createdAt: 'asc' } },
          evaluation: true,
          decision: true,
          notes: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return reply.status(200).send({ items: sessions, total: sessions.length })
    } catch (error: any) {
      request.log.error(`[interview] list: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /enterprise/interviews/:id — 面试详情 ───
  fastify.get('/enterprise/interviews/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as any

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = workspaceId ? await requireEnterpriseWorkspaceContext(userId, workspaceId) : null
      if (workspaceId && !wsc) return reply.status(403).send({ error: 'Workspace access denied' })

      const session = await prisma.interviewSession.findFirst({
        where: { id, ...(wsc ? { workspaceId: wsc.workspace.id } : {}) },
        include: {
          job: true,
          pipeline: true,
          questions: { orderBy: { createdAt: 'asc' } },
          evaluation: true,
          decision: true,
          notes: { orderBy: { createdAt: 'desc' } },
        },
      })
      if (!session) return reply.status(404).send({ error: 'Interview not found' })
      return reply.status(200).send(session)
    } catch (error: any) {
      request.log.error(`[interview] detail: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /enterprise/interviews — 创建面试 ───
  fastify.post('/enterprise/interviews', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId, jobId, pipelineId, candidateName, title, interviewerId } = request.body as any

      if (!workspaceId || !jobId || !candidateName) {
        return reply.status(400).send({ error: 'workspaceId, jobId, candidateName 都是必填' })
      }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })
      const workspace = wsc.workspace

      // 校验岗位存在
      const job = await prisma.jobPosting.findFirst({
        where: { id: jobId, enterpriseId: workspace.enterpriseId },
      })
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const session = await prisma.interviewSession.create({
        data: {
          workspaceId,
          jobId,
          pipelineId: pipelineId || null,
          candidateName,
          title: title || `${candidateName} - ${job.title} 面试`,
          interviewerId: interviewerId || null,
          status: 'preparing',
        },
        include: { job: true, pipeline: true, questions: true, evaluation: true },
      })

      return reply.status(201).send({ success: true, session })
    } catch (error: any) {
      request.log.error(`[interview] create error: ${error.message}`)
      return reply.status(500).send({ error: 'Create failed', detail: error.message })
    }
  })

  // ─── POST /enterprise/interviews/:id/evaluate — 提交评估 ───
  fastify.post('/enterprise/interviews/:id/evaluate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId, overallScore, technicalScore, communicationScore, cultureScore, strengths, risks, recommendation, summary, nextSteps } = request.body as any

      if (!workspaceId) {
        return reply.status(400).send({ error: 'workspaceId is required' })
      }

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
      if (!wsc) return reply.status(403).send({ error: 'Workspace access denied' })

      const session = await prisma.interviewSession.findFirst({
        where: { id, workspaceId: wsc.workspace.id },
      })
      if (!session) {
        return reply.status(404).send({ error: 'Interview not found' })
      }

      // Upsert 评估
      const evaluation = await prisma.interviewEvaluation.upsert({
        where: { sessionId: id },
        create: {
          sessionId: id,
          overallScore: overallScore || 0,
          technicalScore: technicalScore || 0,
          communicationScore: communicationScore || 0,
          cultureScore: cultureScore || 0,
          strengths: strengths || [],
          risks: risks || [],
          recommendation: recommendation || 'pending',
          summary: summary || '',
          nextSteps: nextSteps || [],
        },
        update: {
          overallScore: overallScore || 0,
          technicalScore: technicalScore || 0,
          communicationScore: communicationScore || 0,
          cultureScore: cultureScore || 0,
          strengths: strengths || [],
          risks: risks || [],
          recommendation: recommendation || 'pending',
          summary: summary || '',
          nextSteps: nextSteps || [],
        },
      })

      // 更新面试状态为已完成
      await prisma.interviewSession.update({
        where: { id },
        data: { status: 'completed', completedAt: new Date() },
      })

      return reply.status(200).send({ success: true, evaluation })
    } catch (error: any) {
      request.log.error(`[interview] evaluate error: ${error.message}`)
      return reply.status(500).send({ error: 'Evaluate failed', detail: error.message })
    }
  })

  // ─── DELETE /enterprise/interviews/:id — 删除面试 ───
  fastify.delete('/enterprise/interviews/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const userId = (request as any).user?.id || (request as any).userId
      const { workspaceId } = request.query as any

      // Observation Sprint Step 1-B-2: workspace tenant boundary guard
      const wsc = workspaceId ? await requireEnterpriseWorkspaceContext(userId, workspaceId) : null
      if (workspaceId && !wsc) return reply.status(403).send({ error: 'Workspace access denied' })

      const session = await prisma.interviewSession.findFirst({
        where: { id, ...(wsc ? { workspaceId: wsc.workspace.id } : {}) },
      })
      if (!session) {
        return reply.status(404).send({ error: 'Interview not found' })
      }

      // 级联删除: Questions → Evaluation → Decision → Notes → Session
      await prisma.interviewQuestion.deleteMany({ where: { sessionId: id } })
      await prisma.interviewEvaluation.deleteMany({ where: { sessionId: id } })
      await prisma.interviewDecision.deleteMany({ where: { sessionId: id } })
      await prisma.interviewNote.deleteMany({ where: { sessionId: id } })
      await prisma.interviewSession.delete({ where: { id } })

      return reply.status(200).send({ success: true })
    } catch (error: any) {
      request.log.error(`[interview] delete error: ${error.message}`)
      return reply.status(500).send({ error: 'Delete failed', detail: error.message })
    }
  })
}
