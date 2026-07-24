import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export const jobPostingRoutes = async (fastify: FastifyInstance) => {
  // ─── GET /enterprise/jobs — 职位列表 ───
  fastify.get('/enterprise/jobs', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { workspaceId } = request.query as any
      const jobs = await prisma.jobPosting.findMany({
        where: workspaceId ? { workspaceId } : {},
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return reply.status(200).send({ items: jobs, total: jobs.length })
    } catch (error: any) {
      request.log.error(`[job-posting] list: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /enterprise/jobs/:id — 职位详情 ───
  fastify.get('/enterprise/jobs/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { workspaceId } = request.query as any
      const job = await prisma.jobPosting.findFirst({
        where: { id, ...(workspaceId ? { workspaceId } : {}) },
      })
      if (!job) return reply.status(404).send({ error: 'Job not found' })
      return reply.status(200).send(job)
    } catch (error: any) {
      request.log.error(`[job-posting] detail: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /enterprise/jobs — 创建职位（维护中） ───
  fastify.post('/enterprise/jobs', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'job-posting', status: 'maintenance' })
  })

  // ─── PUT /enterprise/jobs/:id — 更新职位（维护中） ───
  fastify.put('/enterprise/jobs/:id', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'job-posting', status: 'maintenance' })
  })

  // ─── DELETE /enterprise/jobs/:id — 删除职位（维护中） ───
  fastify.delete('/enterprise/jobs/:id', { preHandler: [fastify.authenticate] }, async (_req, reply) => {
    return reply.status(503).send({ error: 'Under maintenance', module: 'job-posting', status: 'maintenance' })
  })
}
