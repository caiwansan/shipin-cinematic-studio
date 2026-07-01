// ════════════════════════════════════════════════════════════
// KH2-T006 — Publishing API
// ════════════════════════════════════════════════════════════
// All publishing goes through PublishingEngine.
// No page directly calls adapters.
// ════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PublishingEngine } from './publishing-engine'
import { PublisherRegistry } from './publisher-registry'
import { PublishingQueue } from './publishing-queue'
import { KnowledgePackageRepository } from '../repository/package-repository'

export function registerPublishingRoutes(
  fastify: FastifyInstance,
  opts: {
    registry: PublisherRegistry
    engine: PublishingEngine
  },
) {
  // ── POST /knowledge/publish — 发布 ──
  fastify.post('/api/knowledge/publish', async (request, reply) => {
    const body = request.body as any
    if (!body.packageId || !body.publisherName) {
      return reply.status(400).send({
        success: false,
        error: 'packageId and publisherName are required',
      })
    }

    try {
      const result = await opts.engine.publish({
        packageId: body.packageId,
        publisherName: body.publisherName,
        config: body.config,
        initiatedBy: (request as any).user?.id || 'anonymous',
      })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(422).send({ success: false, error: err.message })
    }
  })

  // ── GET /knowledge/publish/jobs — 任务列表 ──
  fastify.get('/api/knowledge/publish/jobs', async (request) => {
    const query = request.query as any
    const result = await opts.engine.listJobs({
      status: query.status,
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
    })
    return { success: true, data: result }
  })

  // ── GET /knowledge/publish/jobs/:id — 任务详情 ──
  fastify.get('/api/knowledge/publish/jobs/:id', async (request, reply) => {
    const { id } = request.params as any
    const job = await opts.engine.getJob(id)
    if (!job) {
      return reply.status(404).send({ success: false, error: 'Job not found' })
    }
    return { success: true, data: job }
  })

  // ── POST /knowledge/publish/jobs/:id/retry — 重试 ──
  fastify.post('/api/knowledge/publish/jobs/:id/retry', async (request, reply) => {
    const { id } = request.params as any
    const job = await opts.engine.retry(id)
    if (!job) {
      return reply.status(404).send({ success: false, error: 'Job not found or cannot retry' })
    }
    return { success: true, data: job }
  })

  // ── POST /knowledge/publish/jobs/:id/cancel — 取消 ──
  fastify.post('/api/knowledge/publish/jobs/:id/cancel', async (request, reply) => {
    const { id } = request.params as any
    const cancelled = await opts.engine.cancel(id)
    if (!cancelled) {
      return reply.status(422).send({
        success: false,
        error: 'Job cannot be cancelled (running, succeeded, or not found)',
      })
    }
    return { success: true, data: { cancelled: true } }
  })

  // ── GET /knowledge/publish/publishers — 已注册 Publisher 列表 ──
  fastify.get('/api/knowledge/publish/publishers', async (_request) => {
    const publishers = opts.registry.getAll().map(p => ({
      name: p.name,
      type: p.type,
      capabilities: p.capabilities,
    }))
    return { success: true, data: publishers }
  })
}
