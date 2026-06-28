/**
 * routes/job-manager.ts — 异步任务 API
 *
 * Queue + Status 管理
 */

import { FastifyInstance } from 'fastify'
import { jobQueueManager } from '../services/job-queue-manager.js'
import { asyncPipelineService } from '../services/async-pipeline.service.js'
import { RuntimeValidator } from '../services/runtime-validator.js'

export default async function jobManagerRoutes(fastify: FastifyInstance) {
  // 获取任务状态
  fastify.get('/api/v1/e/jobs/:jobId', async (request, reply) => {
    try {
      const { jobId } = request.params as any
      const job = jobQueueManager.getStatus(jobId)
      if (!job) {
        return RuntimeValidator.fail({ code: 'JOB_NOT_FOUND', message: '任务不存在' })
      }
      return RuntimeValidator.ok({
        id: job.id,
        type: job.type,
        status: job.status,
        retryCount: job.retryCount,
        error: job.error,
        result: job.result,
        createdAt: job.createdAt,
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 异步视频生成
  fastify.post('/api/v1/e/jobs/generate-video', async (request, reply) => {
    try {
      const body = request.body as any
      const jobId = await asyncPipelineService.submitVideoGeneration(body.projectId)
      return RuntimeValidator.ok({ jobId, status: 'pending' })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 异步优化
  fastify.post('/api/v1/e/jobs/optimize', async (request, reply) => {
    try {
      const body = request.body as any
      const jobId = await asyncPipelineService.submitOptimization({
        assetRegistryId: body.assetRegistryId,
        userId: body.userId || 'default',
        projectId: body.projectId,
        agentType: body.agentType || 'optimization_agent',
        optimizationTarget: body.target,
      })
      return RuntimeValidator.ok({ jobId, status: 'pending' })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 队列统计
  fastify.get('/api/v1/e/jobs/stats', async (_request, reply) => {
    try {
      const stats = jobQueueManager.stats()
      return RuntimeValidator.ok(stats)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 死信队列
  fastify.get('/api/v1/e/jobs/dead-letter', async (_request, reply) => {
    try {
      const dlq = await jobQueueManager.getDeadLetterQueue()
      return RuntimeValidator.ok(dlq)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
