import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export const pipelineRoutes = async (fastify: FastifyInstance) => {
  fastify.get('/enterprise/pipelines', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { workspaceId } = request.query as any
      const pipelines = await prisma.recruitmentPipeline.findMany({
        where: workspaceId ? { workspaceId } : {},
        include: { job: true, events: { orderBy: { createdAt: 'desc' }, take: 5 }, interviewSessions: true },
        orderBy: { createdAt: 'desc' }, take: 20,
      })
      return reply.status(200).send({ items: pipelines, total: pipelines.length })
    } catch (error: any) {
      request.log.error(`[pipeline] list: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  fastify.get('/enterprise/pipelines/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { workspaceId } = request.query as any
      const pipeline = await prisma.recruitmentPipeline.findFirst({
        where: { id, ...(workspaceId ? { workspaceId } : {}) },
        include: { job: true, events: { orderBy: { createdAt: 'desc' } }, interviewSessions: true },
      })
      if (!pipeline) return reply.status(404).send({ error: 'Pipeline not found' })
      return reply.status(200).send(pipeline)
    } catch (error: any) {
      request.log.error(`[pipeline] detail: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  fastify.post('/enterprise/pipelines', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'pipeline', status: 'maintenance' })
  })

  fastify.post('/enterprise/pipelines/:id/advance', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'pipeline', status: 'maintenance' })
  })

  fastify.delete('/enterprise/pipelines/:id', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'pipeline', status: 'maintenance' })
  })
}
