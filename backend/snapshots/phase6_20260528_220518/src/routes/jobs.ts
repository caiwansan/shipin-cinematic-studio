import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Job API — 查询长任务状态和结果 (v2 PostgreSQL)
 *
 * - GET /api/v1/jobs/:jobId — 查询任务状态
 * - GET /api/v1/jobs/:jobId/result — 获取任务结果
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { jobStore } from '../jobs/job-store.js'

export default async function jobRoutes(fastify: FastifyInstance) {
  // ============================================================
  // GET /api/v1/jobs/:jobId — 查询任务状态
  // ============================================================
  fastify.get('/api/v1/jobs/:jobId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = request.params as any
    const job = await jobStore.get(jobId)
    if (!job) {
      return reply.status(404).send({ success: false, error: '任务不存在' })
    }
    return {
      success: true,
      data: {
        jobId: job.jobId,
        type: job.type,
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage,
        trace: job.trace,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    }
  })

  // ============================================================
  // GET /api/v1/jobs/:jobId/result — 获取任务结果
  // ============================================================
  fastify.get('/api/v1/jobs/:jobId/result', async (request: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = request.params as any
    const job = await jobStore.get(jobId)
    if (!job) {
      return reply.status(404).send({ success: false, error: '任务不存在' })
    }
    if (job.status !== 'completed') {
      return reply.status(200).send({ success: true, data: { status: job.status, progress: job.progress, currentStage: job.currentStage } })
    }
    return { success: true, data: { status: 'completed', result: job.result } } satisfies ApiResponse<unknown>;

  })
}
