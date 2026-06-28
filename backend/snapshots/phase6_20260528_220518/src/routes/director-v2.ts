/**
 * director-v2.routes.ts — Director OS v2 API Routes
 *
 * 在 `/api/v2/director` 路径下挂载 director-v2 的 4 个生产入口。
 * 与老系统 `/api/v1/director` 共存，不冲突。
 *
 * 入口：
 *   POST /api/v2/director/generate   — 剧本生成
 *   GET  /api/v2/director/preview    — 只读预览
 *   POST /api/v2/director/refine     — 安全修正
 *   GET  /api/v2/director/status     — 系统状态 + 演化读数
 */

import type { FastifyInstance } from 'fastify'
import { directorApi } from '../director-v2/runtime/api-surface.js'

export default async function directorV2Routes(app: FastifyInstance) {
  // generate — 剧本生成
  app.post('/api/v2/director/generate', async (request, reply) => {
    try {
      const input = request.body as any
      console.log(`[director-v2] generate called. ENV DEEPSEEK_KEY length: ${(process.env.DEEPSEEK_API_KEY || '').length}`)
      const result = await directorApi.generate({
        script: input.script,
        projectId: input.projectId,
        intentHint: input.intentHint,
        totalEpisodes: input.totalEpisodes,
      })
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // preview — 只读预览
  app.get('/api/v2/director/preview', async (request, reply) => {
    try {
      const query = request.query as any
      const result = await directorApi.preview({
        sessionId: query.sessionId,
        focus: query.focus,
      })
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // refine — 安全修正
  app.post('/api/v2/director/refine', async (request, reply) => {
    try {
      const input = request.body as any
      const result = await directorApi.refine({
        sessionId: input.sessionId,
        hint: input.hint,
      })
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // status — 系统状态 + 演化读数
  app.get('/api/v2/director/status', async (request, reply) => {
    try {
      const query = request.query as any
      const result = await directorApi.status(query.sessionId)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

