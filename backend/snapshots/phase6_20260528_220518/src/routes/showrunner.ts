import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Showrunner Core — API Routes (Async Job Mode)
 *
 * 所有耗时操作通过 Job 异步执行：
 * - POST /api/v1/showrunner/plan — 提交规划任务，返回 jobId
 * - POST /api/v1/showrunner/execute — 提交执行任务，返回 jobId
 * - GET /api/v1/showrunner/status/:projectId — 查询项目状态
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { jobStore, runShowrunnerJob } from '../jobs/index.js'
import { jobQueue } from '../jobs/job-queue.js'
import { worldMemory } from '../services/world-memory.service.js'

export default async function showrunnerRoutes(fastify: FastifyInstance) {
  // ============================================================
  // POST /api/v1/showrunner/plan — 异步提交制片规划
  // ============================================================
  fastify.post('/api/v1/showrunner/plan', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, projectId, totalEpisodes } = request.body as any
    if (!script || !projectId) {
      return reply.status(400).send({ success: false, error: '缺少 script 或 projectId' })
    }

    // 创建 Job
    const jobId = jobStore.create('showrunner', { projectId, scriptLength: script.length })

    // 入队
    jobQueue.enqueue(jobId, 'showrunner', 1, projectId).catch(e =>
      console.error(`[JobQueue] enqueue failed: ${e.message}`))

    // 异步执行（不 await，立即返回）
    const userId = (request.user as any)?.id || 'anonymous'
    runShowrunnerJob(jobId, script, totalEpisodes || 60, projectId, userId).catch(err => {
      console.error(`[ShowrunnerWorker] Job ${jobId} failed:`, err.message)
      jobStore.fail(jobId, err.message).catch(e => console.error('[JobStore] fail error:', e.message))
    })

    return {
      success: true,
      data: {
        jobId,
        status: 'queued',
        pollUrl: `/api/v1/jobs/${jobId}`,
        resultUrl: `/api/v1/jobs/${jobId}/result`,
      },
    }
  })

  // ============================================================
  // POST /api/v1/showrunner/execute — 异步提交规划+执行
  // ============================================================
  fastify.post('/api/v1/showrunner/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, projectId, totalEpisodes } = request.body as any
    if (!script || !projectId) {
      return reply.status(400).send({ success: false, error: '缺少 script 或 projectId' })
    }

    const jobId = jobStore.create('showrunner', { projectId, mode: 'execute' })

    const userId = (request.user as any)?.id || 'anonymous'
    runShowrunnerJob(jobId, script, totalEpisodes || 60, projectId, userId).catch(err => {
      console.error(`[ShowrunnerWorker] Job ${jobId} failed:`, err.message)
      jobStore.fail(jobId, err.message).catch(e => console.error('[JobStore] fail error:', e.message))
    })

    return {
      success: true,
      data: {
        jobId,
        status: 'queued',
        pollUrl: `/api/v1/jobs/${jobId}`,
      },
    }
  })

  // ============================================================
  // GET /api/v1/showrunner/status/job/:jobId — 单 Job 统一状态 (from DB)
  // ============================================================
  fastify.get('/api/v1/showrunner/status/job/:jobId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = request.params as any
    const job = await jobStore.get(jobId)
    if (!job) {
      return reply.status(200).send({
        success: true,
        data: {
          jobId,
          status: 'not_found',
          stage: '',
          progress: 0,
          updatedAt: null,
          result: null,
          error: null,
        },
      })
    }
    return {
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        stage: job.currentStage,
        progress: job.progress / 100,
        updatedAt: job.updatedAt,
        result: job.result,
        error: job.error,
        trace: job.trace,
      },
    }
  })

  // ============================================================
  // GET /api/v1/showrunner/status/:projectId — 项目状态
  // ============================================================
  fastify.get('/api/v1/showrunner/status/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as any
    const projectJobs = await jobStore.listByProject(projectId)
    const allJobs = projectJobs.map(j => ({
      jobId: j.jobId,
      status: j.status,
      progress: j.progress,
      currentStage: j.currentStage,
    }))

    try {
      const { graphScheduler } = await import('../scheduler/graph-scheduler.js')
      const allOutputs = graphScheduler.getAllOutputs?.() || []
      const projectOutputs = allOutputs.filter((g: any) => g.projectId === projectId)
      return {
        success: true,
        data: { projectId, jobs: allJobs, graphs: projectOutputs.map((g: any) => ({ graphId: g.graphId, status: g.status })) },
      }
    } catch {
      return { success: true, data: { projectId, jobs: allJobs, graphs: [] } } satisfies ApiResponse<unknown>;

    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "ASYNC"
};

