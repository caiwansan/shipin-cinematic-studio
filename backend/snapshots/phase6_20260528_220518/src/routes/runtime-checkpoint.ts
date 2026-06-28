import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/runtime-checkpoint.ts — BLOCKER-1 Checkpoint API
 */

import { FastifyInstance } from 'fastify'
import {
  getCheckpoint,
  saveCheckpoint,
  initCheckpoint,
  updateStageCheckpoint,
  completeStage,
  failStage,
  setCurrentStage,
  canResume,
  getResumeInfo,
} from '../services/runtime-checkpoint.service.js'

export default async function runtimeCheckpointRoutes(fastify: FastifyInstance) {
  // GET /api/projects/:id/checkpoint — 获取 checkpoint
  fastify.get('/api/projects/:id/checkpoint', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const checkpoint = await getCheckpoint(id)
    return { success: true, data: checkpoint } satisfies ApiResponse<unknown>;

  })

  // GET /api/projects/:id/checkpoint/resume-info — 获取恢复信息
  fastify.get('/api/projects/:id/checkpoint/resume-info', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const checkpoint = await getCheckpoint(id)
    const info = getResumeInfo(checkpoint)
    return { success: true, ...info } satisfies ApiResponse<unknown>;

  })

  // PUT /api/projects/:id/checkpoint — 全量保存 checkpoint
  fastify.put('/api/projects/:id/checkpoint', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { checkpoint } = request.body as any
    if (!checkpoint) {
      return reply.status(400).send({ success: false, error: 'checkpoint is required' })
    }
    await saveCheckpoint(id, checkpoint)
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // POST /api/projects/:id/checkpoint/init — 初始化 checkpoint
  fastify.post('/api/projects/:id/checkpoint/init', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { stages } = request.body as { stages: string[] }
    if (!stages || !Array.isArray(stages)) {
      return reply.status(400).send({ success: false, error: 'stages array is required' })
    }
    const cp = await initCheckpoint(id, stages)
    return { success: true, data: cp } satisfies ApiResponse<unknown>;

  })

  // POST /api/projects/:id/checkpoint/stage/:stageKey/complete
  fastify.post('/api/projects/:id/checkpoint/stage/:stageKey/complete', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { stageKey } = request.params as any
    const cp = await completeStage(id, stageKey)
    return { success: true, data: cp } satisfies ApiResponse<unknown>;

  })

  // POST /api/projects/:id/checkpoint/stage/:stageKey/fail
  fastify.post('/api/projects/:id/checkpoint/stage/:stageKey/fail', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { stageKey } = request.params as any
    const { error } = request.body as { error: string }
    const cp = await failStage(id, stageKey, error || 'unknown error')
    return { success: true, data: cp } satisfies ApiResponse<unknown>;

  })

  // POST /api/projects/:id/checkpoint/stage/:stageKey/start
  fastify.post('/api/projects/:id/checkpoint/stage/:stageKey/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { stageKey } = request.params as any
    const cp = await setCurrentStage(id, stageKey)
    return { success: true, data: cp } satisfies ApiResponse<unknown>;

  })
}
