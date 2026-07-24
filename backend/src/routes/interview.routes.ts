import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export const interviewRoutes = async (fastify: FastifyInstance) => {
  // ─── GET /enterprise/interviews — 面试列表 ───
  fastify.get('/enterprise/interviews', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { workspaceId } = request.query as any
      const sessions = await prisma.interviewSession.findMany({
        where: workspaceId ? { workspaceId } : {},
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
      const { workspaceId } = request.query as any
      const session = await prisma.interviewSession.findFirst({
        where: { id, ...(workspaceId ? { workspaceId } : {}) },
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

  // ─── POST /enterprise/interviews — 创建面试（维护中） ───
  fastify.post('/enterprise/interviews', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'interview', status: 'maintenance' })
  })

  // ─── POST /enterprise/interviews/:id/evaluate — 评估（维护中） ───
  fastify.post('/enterprise/interviews/:id/evaluate', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'interview', status: 'maintenance' })
  })

  // ─── DELETE /enterprise/interviews/:id — 删除（维护中） ───
  fastify.delete('/enterprise/interviews/:id', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'interview', status: 'maintenance' })
  })
}
