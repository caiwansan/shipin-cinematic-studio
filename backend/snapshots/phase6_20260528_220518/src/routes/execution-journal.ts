import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/execution-journal.ts — Execution Journal API
 *
 * GET  /api/projects/:id/journal       — 获取完整 journal
 * GET  /api/projects/:id/journal/recent — 获取最近 N 条
 * GET  /api/projects/:id/runtime       — replay 后的 runtime state
 *
 * POST /api/projects/:id/journal       — 追加 event（用户手动触发，如用户编辑后保存）
 */

import { FastifyInstance } from 'fastify'
import {
  getEvents,
  getRecentEvents,
  appendEvent,
  loadAndReplay,
} from '../services/execution-journal.service.js'

export default async function executionJournalRoutes(fastify: FastifyInstance) {
  // GET /api/projects/:id/journal
  fastify.get('/api/projects/:id/journal', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const events = await getEvents(id)
    return { success: true, data: events, count: events.length } satisfies ApiResponse<unknown>;

  })

  // GET /api/projects/:id/journal/recent
  fastify.get('/api/projects/:id/journal/recent', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const query = request.query as any
    const limit = parseInt(query.limit) || 20
    const events = await getRecentEvents(id, limit)
    return { success: true, data: events, count: events.length } satisfies ApiResponse<unknown>;

  })

  // GET /api/projects/:id/runtime
  fastify.get('/api/projects/:id/runtime', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const runtime = await loadAndReplay(id)
    return {
      success: true,
      data: {
        ...runtime,
        completedStages: Array.from(runtime.completedStages),
      },
    }
  })

  // POST /api/projects/:id/journal
  fastify.post('/api/projects/:id/journal', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    if (!body.eventType || !body.stage) {
      return reply.status(400).send({ success: false, error: 'eventType and stage are required' })
    }

    await appendEvent({
      type: body.eventType,
      stage: body.stage,
      timestamp: Date.now(),
      executionId: id,
      trigger: body.trigger || 'user',
      payload: body.payload || {},
    })
    return { success: true } satisfies ApiResponse<unknown>;

  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

