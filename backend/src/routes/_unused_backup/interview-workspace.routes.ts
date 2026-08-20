/**
 * interview-workspace.routes.ts — 面试管理 API
 * Sprint-06: 企业 HR 面试管理
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export async function interviewWorkspaceRoutes(fastify: FastifyInstance) {

  // 503: Interview 关系尚未完成同步
  fastify.addHook('onRequest', async (_request, reply) => {
    return reply.status(503).send({ error: 'Interview module is under maintenance', module: 'interview-workspace', status: 'maintenance' })
  })

  // ─── 面试详情（含问题、评价、笔记、决策）───
  fastify.get('/api/enterprise/interview/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }

    try {
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
          job: { select: { title: true, description: true, requirements: true, salary: true, location: true } },
          questions: { orderBy: { createdAt: 'asc' } },
          evaluation: true,
          notes: { orderBy: { createdAt: 'desc' } },
          decision: true,
          pipeline: { select: { id: true, candidateName: true, stage: true, screeningScore: true } },
        },
      })

      if (!session) return reply.status(404).send({ error: '面试不存在' })

      return {
        success: true,
        data: {
          id: session.id,
          title: session.title,
          candidateName: session.candidateName,
          status: session.status,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          createdAt: session.createdAt,
          job: session.job,
          pipeline: session.pipeline,
          questions: session.questions,
          evaluation: session.evaluation,
          notes: session.notes,
          decision: session.decision,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取面试详情失败', detail: e.message })
    }
  })

  // ─── 更新面试状态 ───
  fastify.patch('/api/enterprise/interview/:sessionId/status', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const { status } = request.body as { status: string }

    const validStatuses = ['preparing', 'ongoing', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({ error: `无效状态，有效值: ${validStatuses.join(', ')}` })
    }

    try {
      const data: any = { status }
      if (status === 'ongoing') data.startedAt = new Date()
      if (status === 'completed') data.completedAt = new Date()

      const session = await prisma.interviewSession.update({
        where: { id: sessionId },
        data,
      })

      return { success: true, data: session }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新状态失败', detail: e.message })
    }
  })

  // ─── 创建面试笔记 ───
  fastify.post('/api/enterprise/interview/:sessionId/notes', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const { content } = request.body as { content: string }

    if (!content?.trim()) {
      return reply.status(400).send({ error: '笔记内容不能为空' })
    }

    try {
      const note = await prisma.interviewNote.create({
        data: {
          sessionId,
          content: content.trim(),
        },
      })

      return { success: true, data: note }
    } catch (e: any) {
      return reply.status(500).send({ error: '创建笔记失败', detail: e.message })
    }
  })

  // ─── 更新面试笔记 ───
  fastify.patch('/api/enterprise/interview/notes/:noteId', async (request, reply) => {
    const { noteId } = request.params as { noteId: string }
    const { content } = request.body as { content: string }

    if (!content?.trim()) {
      return reply.status(400).send({ error: '笔记内容不能为空' })
    }

    try {
      const note = await prisma.interviewNote.update({
        where: { id: noteId },
        data: { content: content.trim() },
      })

      return { success: true, data: note }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新笔记失败', detail: e.message })
    }
  })

  // ─── 删除面试笔记 ───
  fastify.delete('/api/enterprise/interview/notes/:noteId', async (request, reply) => {
    const { noteId } = request.params as { noteId: string }

    try {
      await prisma.interviewNote.delete({ where: { id: noteId } })
      return { success: true }
    } catch (e: any) {
      return reply.status(500).send({ error: '删除笔记失败', detail: e.message })
    }
  })

  // ─── 面试决策 ───
  fastify.post('/api/enterprise/interview/:sessionId/decision', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const { decision, reason } = request.body as { decision: string; reason?: string }

    const validDecisions = ['recommend_offer', 'hold', 'reject']
    if (!validDecisions.includes(decision)) {
      return reply.status(400).send({ error: `无效决策，有效值: ${validDecisions.join(', ')}` })
    }

    try {
      // 保存决策
      const decisionRecord = await prisma.interviewDecision.upsert({
        where: { sessionId },
        update: { decision, reason },
        create: { sessionId, decision, reason },
      })

      // 更新面试状态为 completed
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: 'completed', completedAt: new Date() },
      })

      // 同步 Pipeline 状态
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: { pipelineId: true },
      })

      if (session?.pipelineId) {
        const pipelineStage = decision === 'recommend_offer' ? 'offer' : decision === 'hold' ? 'interview' : 'rejected'
        await prisma.recruitmentPipeline.update({
          where: { id: session.pipelineId },
          data: { stage: pipelineStage, lastActivityAt: new Date() },
        })
      }

      return { success: true, data: decisionRecord }
    } catch (e: any) {
      return reply.status(500).send({ error: '保存决策失败', detail: e.message })
    }
  })

  // ─── 面试时间线 ───
  fastify.get('/api/enterprise/interview/:sessionId/timeline', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }

    try {
      const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
          notes: { orderBy: { createdAt: 'asc' } },
          decision: true,
          evaluation: true,
        },
      })

      if (!session) return reply.status(404).send({ error: '面试不存在' })

      // 构建时间线
      const events: Array<{ time: Date; type: string; title: string; description?: string }> = []

      events.push({ time: session.createdAt, type: 'created', title: '创建面试' })

      if (session.startedAt) {
        events.push({ time: session.startedAt, type: 'started', title: '开始面试' })
      }

      for (const note of session.notes) {
        events.push({ time: note.createdAt, type: 'note', title: '添加笔记', description: note.content.substring(0, 50) })
      }

      if (session.evaluation) {
        events.push({ time: session.evaluation.createdAt, type: 'evaluation', title: 'AI 评价完成' })
      }

      if (session.decision) {
        const decisionTitle = session.decision.decision === 'recommend_offer' ? '建议录用' : session.decision.decision === 'hold' ? '暂缓' : '拒绝'
        events.push({ time: session.decision.createdAt, type: 'decision', title: decisionTitle, description: session.decision.reason })
      }

      if (session.completedAt) {
        events.push({ time: session.completedAt, type: 'completed', title: '面试完成' })
      }

      // 按时间排序
      events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

      return { success: true, data: events }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取时间线失败', detail: e.message })
    }
  })
}
