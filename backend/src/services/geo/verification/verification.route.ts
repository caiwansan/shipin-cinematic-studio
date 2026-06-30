import { FastifyInstance } from 'fastify'
import { VerificationService } from './verification.service'
import { VerificationEngine } from './verification-engine'
import { InMemoryJobRunner } from './verification-job-runner'
import { VerificationPolicyService } from './verification-policy.service'
import { TimelineService } from './timeline.service'
import { prisma } from '../../utils/index.js'
const jobRunner = new InMemoryJobRunner()
const policyService = new VerificationPolicyService(prisma)
const engine = new VerificationEngine(prisma, jobRunner, undefined, policyService)
const service = new VerificationService(prisma, engine)
const timelineService = new TimelineService(prisma)

export async function geoVerificationRoutes(app: FastifyInstance) {
  // POST /api/geo/verification/run — 执行验证
  app.post('/api/geo/verification/run', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId, executionId, optimizationType, triggerSource } = req.body as any
      if (!projectId || !optimizationType) {
        return reply.status(400).send({ success: false, error: 'projectId and optimizationType required' })
      }
      const result = await service.run({
        executionId: executionId || undefined,
        projectId,
        optimizationType,
        triggerSource: triggerSource || 'manual',
      })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/verification/job/:executionId — 获取 job 状态
  app.get('/api/geo/verification/job/:executionId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { executionId } = req.params as any
      const status = await service.getJobStatus(executionId)
      return { success: true, data: { executionId, status } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/verification/history/:projectId — 验证历史
  app.get('/api/geo/verification/history/:projectId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const { limit, offset } = req.query as any
      const history = await service.getHistory(projectId, Number(limit) || 20, Number(offset) || 0)
      return { success: true, data: history }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/verification/compare/:beforeExecutionId/:afterExecutionId — 前后对比
  app.get('/api/geo/verification/compare/:beforeExecutionId/:afterExecutionId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { beforeExecutionId, afterExecutionId } = req.params as any
      const result = await service.compare(beforeExecutionId, afterExecutionId)
      if (!result) return reply.status(404).send({ success: false, error: 'Not found' })
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/verification/evidence/:projectId — 证据列表
  app.get('/api/geo/verification/evidence/:projectId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const { limit, offset } = req.query as any
      const results = await service.getRepository().findHistory(projectId, Number(limit) || 20, Number(offset) || 0)
      const evidence = results.filter(r => r.execution).map(r => ({
        projectId,
        executionId: r.execution!.id,
        delta: r.delta,
        isImprovement: r.isImprovement,
        verifiedAt: r.verifiedAt,
      }))
      return { success: true, data: evidence }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/verification/timeline/:projectId — 验证时间轴
  app.get('/api/geo/verification/timeline/:projectId', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const { projectId } = req.params as any
      const { limit } = req.query as any
      const events = await timelineService.getTimeline(projectId, Number(limit) || 20)
      return { success: true, data: events }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
