/**
 * routes/kernel-command.ts — Kernel v1 API 路由
 *
 * 提供两个入口：
 * POST /api/v2/kernel/command  → 唯一写入口（含 validate）
 * GET  /api/v2/kernel/read     → 唯一读入口
 * GET  /api/v2/kernel/rebuild  → EventLog→EntityGraph 重建验证
 */

import { FastifyInstance } from 'fastify'
import { kernel } from '../kernel-v1/kernel.js'

export default async function kernelRoutes(fastify: FastifyInstance) {
  // =================================================================
  // 唯一写入口
  // =================================================================
  fastify.post('/api/v2/kernel/command', async (request, reply) => {
    try {
      const result = await kernel.command(request.body as any)
      return reply.send(result)
    } catch (err: any) {
      const status = err.code === 'KERNEL_VIOLATION' ? 403 : 400
      return reply.status(status).send({
        ok: false,
        error: err.message,
        code: err.code ?? 'KERNEL_ERROR',
      })
    }
  })

  // =================================================================
  // 唯一读入口
  // =================================================================
  fastify.get('/api/v2/kernel/read', async (request, reply) => {
    const { projectId } = request.query as any
    if (!projectId) {
      return reply.status(400).send({ ok: false, error: 'missing projectId' })
    }

    try {
      const state = await kernel.read(projectId)
      return reply.send(state)
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message })
    }
  })

  // =================================================================
  // EventLog → EntityGraph 重建验证
  // =================================================================
  fastify.get('/api/v2/kernel/rebuild', async (request, reply) => {
    const { projectId } = request.query as any
    if (!projectId) {
      return reply.status(400).send({ ok: false, error: 'missing projectId' })
    }

    try {
      const state = await kernel.rebuildProjectState(projectId)
      return reply.send({
        ok: true,
        rebuilt: true,
        state,
      })
    } catch (err: any) {
      return reply.status(500).send({ ok: false, error: err.message })
    }
  })
}
