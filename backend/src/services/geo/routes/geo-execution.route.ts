// KMKI-RUNTIME-010 — Optimization Execution Routes
// GET /api/geo/executions — list executions for a project
// GET /api/geo/executions/:executionId — get single execution
// POST /api/geo/executions — create a new execution
// PATCH /api/geo/executions/:executionId/status — update status
// POST /api/geo/executions/:executionId/retry — retry a failed execution
// POST /api/geo/executions/:executionId/cancel — cancel a running execution

import { FastifyInstance } from 'fastify'
import { optimizationExecutionRepository } from '../repositories/optimization-execution.repository.js'

export default async function geoExecutionRoutes(fastify: FastifyInstance) {
  // GET /api/geo/executions?projectId=xxx&status=pending&limit=20&offset=0
  fastify.get('/api/geo/executions', { preHandler: [] }, async (request, reply) => {
    try {
      const { projectId, status, limit, offset } = request.query as any
      const where: any = {}
      if (projectId) where.projectId = projectId
      if (status) where.executionStatus = status

      const [executions, total] = await Promise.all([
        optimizationExecutionRepository.findMany(where, {
          orderBy: { startedAt: 'desc' },
          take: limit ? Number(limit) : 50,
          skip: offset ? Number(offset) : 0,
        }),
        optimizationExecutionRepository.count(where),
      ])

      return { success: true, data: { executions, total } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/executions/:executionId
  fastify.get('/api/geo/executions/:executionId', { preHandler: [] }, async (request, reply) => {
    try {
      const { executionId } = request.params as any
      const execution = await optimizationExecutionRepository.findUnique({ id: executionId })
      if (!execution) {
        return reply.status(404).send({ success: false, error: 'Execution not found' })
      }
      return { success: true, data: execution }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/executions/project/:projectId/summary — 摘要统计
  fastify.get('/api/geo/executions/project/:projectId/summary', { preHandler: [] }, async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const all = await optimizationExecutionRepository.findMany({ projectId })

      const total = all.length
      const pending = all.filter((e: any) => e.executionStatus === 'pending').length
      const running = all.filter((e: any) => e.executionStatus === 'running').length
      const completed = all.filter((e: any) => e.executionStatus === 'completed').length
      const failed = all.filter((e: any) => e.executionStatus === 'failed').length
      const cancelled = all.filter((e: any) => e.executionStatus === 'cancelled').length

      return {
        success: true,
        data: { total, pending, running, completed, failed, cancelled },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/executions — 创建新执行任务
  fastify.post('/api/geo/executions', { preHandler: [] }, async (request, reply) => {
    try {
      const { projectId, optimizationType, triggerSource, industry, brandType } = request.body as any

      if (!projectId || !optimizationType) {
        return reply.status(400).send({ success: false, error: 'projectId and optimizationType are required' })
      }

      const execution = await optimizationExecutionRepository.create({
        projectId,
        optimizationType,
        executionStatus: 'pending',
        triggerSource: triggerSource || 'manual',
        industry: industry || null,
        brandType: brandType || null,
      })

      return { success: true, data: execution }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // PATCH /api/geo/executions/:executionId/status — 更新状态
  fastify.patch('/api/geo/executions/:executionId/status', { preHandler: [] }, async (request, reply) => {
    try {
      const { executionId } = request.params as any
      const { executionStatus, completedAt } = request.body as any

      const existing = await optimizationExecutionRepository.findUnique({ id: executionId })
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Execution not found' })
      }

      const updateData: any = { executionStatus }
      if (completedAt || (executionStatus === 'completed' || executionStatus === 'failed')) {
        updateData.completedAt = completedAt || new Date().toISOString()
      }

      const updated = await optimizationExecutionRepository.update(
        { id: executionId },
        updateData,
      )

      return { success: true, data: updated }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/executions/:executionId/retry — 重试失败的 execution
  fastify.post('/api/geo/executions/:executionId/retry', { preHandler: [] }, async (request, reply) => {
    try {
      const { executionId } = request.params as any
      const existing = await optimizationExecutionRepository.findUnique({ id: executionId })
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Execution not found' })
      }

      if (existing.executionStatus !== 'failed') {
        return reply.status(400).send({ success: false, error: 'Only failed executions can be retried' })
      }

      const updated = await optimizationExecutionRepository.update(
        { id: executionId },
        {
          executionStatus: 'pending',
          completedAt: null,
        },
      )

      return { success: true, data: updated }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/executions/:executionId/cancel — 取消运行中的 execution
  fastify.post('/api/geo/executions/:executionId/cancel', { preHandler: [] }, async (request, reply) => {
    try {
      const { executionId } = request.params as any
      const existing = await optimizationExecutionRepository.findUnique({ id: executionId })
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Execution not found' })
      }

      if (existing.executionStatus !== 'pending' && existing.executionStatus !== 'running') {
        return reply.status(400).send({ success: false, error: 'Only pending or running executions can be cancelled' })
      }

      const updated = await optimizationExecutionRepository.update(
        { id: executionId },
        {
          executionStatus: 'cancelled',
          completedAt: new Date().toISOString(),
        },
      )

      return { success: true, data: updated }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
