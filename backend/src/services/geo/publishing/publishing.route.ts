import { FastifyInstance } from 'fastify'
import { PublishingPipelineService } from './publishing-pipeline.service'
import { publishingAdapterRegistry } from './adapters/adapter-registry'
import { prisma } from '../../../utils/index.js'
const pipeline = new PublishingPipelineService(prisma)

export async function geoPublishingRoutes(app: FastifyInstance) {
  // POST /api/geo/publishing/preview — 发布预览
  app.post('/api/geo/publishing/preview', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const body = req.body as any
      const preview = await pipeline.preview(body)
      return { success: true, data: preview }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/publishing/submit — 提交发布
  app.post('/api/geo/publishing/submit', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const body = req.body as any
      const result = await pipeline.submit(body)
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/publishing/approve — 审核发布
  app.post('/api/geo/publishing/approve', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { publishId, reviewer, note } = req.body as any
      const result = await pipeline.approve(publishId, reviewer, note)
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/publishing/rollback — 回滚
  app.post('/api/geo/publishing/rollback', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { publishId, reason } = req.body as any
      await pipeline.rollback(publishId, reason)
      return { success: true }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/publishing/status/:projectId — 项目发布状态概览
  app.get('/api/geo/publishing/status/:projectId', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const status = await pipeline.getPipelineStatus(projectId)
      return { success: true, data: status }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/publishing/:publishId — 单条发布记录
  app.get('/api/geo/publishing/:publishId', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { publishId } = req.params as any
      const record = await pipeline.getRecord(publishId)
      if (!record) return reply.status(404).send({ success: false, error: 'Not found' })
      return { success: true, data: record }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/publishing/project/:projectId — 项目发布记录列表
  app.get('/api/geo/publishing/project/:projectId', { preHandler: [app.authenticate] }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const { limit, offset } = req.query as any
      const records = await pipeline.listRecords(projectId, Number(limit) || 20, Number(offset) || 0)
      return { success: true, data: records }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/publishing/adapters — 列出已注册的发布平台
  app.get('/api/geo/publishing/adapters', { preHandler: [app.authenticate] }, async () => {
    const adapters = publishingAdapterRegistry.list()
    const platforms = await Promise.all(
      adapters.map(async a => ({
        platform: a.platform,
        capabilities: await a.capabilities(),
        healthy: (await a.health()).healthy,
      }))
    )
    return { success: true, data: platforms }
  })
}
