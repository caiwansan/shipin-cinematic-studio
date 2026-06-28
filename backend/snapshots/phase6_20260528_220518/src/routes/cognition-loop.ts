import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Cognition Loop — API Routes (Async Job Mode)
 *
 * - POST /api/v1/cognition/run — 提交认知循环任务，返回 jobId
 * - GET /api/v1/cognition/intent/:projectId/:episodeId — 查询 Intent State
 * - POST /api/v1/cognition/enforce — 强制执行意图检查
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { jobStore, runCognitionJob } from '../jobs/index.js'
import { intentStateManager } from '../cognition-loop/director-intent-state.js'
import { enforceIntentOnAgentOutput, validatePipelineOutput } from '../cognition-loop/intent-enforcement.js'
import { analyzeIntentDrift } from '../cognition-loop/intent-feedback-analyzer.js'

export default async function cognitionRoutes(fastify: FastifyInstance) {
  // ============================================================
  // POST /api/v1/cognition/run — 异步提交认知循环
  // ============================================================
  fastify.post('/api/v1/cognition/run', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, episodeId, script, totalEpisodes } = request.body as any
    if (!projectId || !episodeId || !script) {
      return reply.status(400).send({ success: false, error: '缺少必要参数' })
    }

    const jobId = jobStore.create('cognition', { projectId, episodeId })

    runCognitionJob(jobId, script, projectId, episodeId, totalEpisodes || 60).catch(err => {
      console.error(`[CognitionWorker] Job ${jobId} failed:`, err.message)
      jobStore.fail(jobId, err.message).catch(e => console.error('[Cognition] fail error:', e.message))
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
  // GET /api/v1/cognition/intent/:projectId/:episodeId — 获取 Intent State
  // ============================================================
  fastify.get('/api/v1/cognition/intent/:projectId/:episodeId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, episodeId } = request.params as any
    const intent = intentStateManager.getIntent(projectId, episodeId)
    if (!intent) {
      return reply.status(404).send({ success: false, error: '未找到该项目的 Intent State' })
    }
    return { success: true, data: intent } satisfies ApiResponse<unknown>;

  })

  // ============================================================
  // POST /api/v1/cognition/enforce — 强制执行意图检查
  // ============================================================
  fastify.post('/api/v1/cognition/enforce', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, episodeId, agentOutput, agentName } = request.body as any
    if (!projectId || !episodeId || !agentOutput) {
      return reply.status(400).send({ success: false, error: '缺少必要参数' })
    }
    const intent = intentStateManager.getIntent(projectId, episodeId)
    if (!intent) {
      return reply.status(404).send({ success: false, error: '未找到 Intent State' })
    }
    const result = enforceIntentOnAgentOutput(intent, agentOutput, agentName || 'unknown')
    return { success: true, data: result } satisfies ApiResponse<unknown>;

  })

  // ============================================================
  // POST /api/v1/cognition/validate — 验证输出
  // ============================================================
  fastify.post('/api/v1/cognition/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId, episodeId, pipelineOutput } = request.body as any
    if (!projectId || !episodeId || !pipelineOutput) {
      return reply.status(400).send({ success: false, error: '缺少必要参数' })
    }
    const intent = intentStateManager.getIntent(projectId, episodeId)
    if (!intent) {
      return reply.status(404).send({ success: false, error: '未找到 Intent State' })
    }
    const validation = validatePipelineOutput(intent, pipelineOutput)
    const drift = analyzeIntentDrift(intent, pipelineOutput)
    return { success: true, data: { validation, driftReport: drift, needsCorrection: drift.overallDriftScore > 0.3 } } satisfies ApiResponse<unknown>;

  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "cognition-loop",
  "mode": "LEGACY"
};

