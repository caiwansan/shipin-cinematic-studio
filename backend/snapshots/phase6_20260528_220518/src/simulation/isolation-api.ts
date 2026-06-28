/**
 * Phase 6C-3.1 — Simulation Isolation API
 *
 * 所有 simulation 流量走独立 API 端点，不碰任何 production 表。
 */

import { FastifyInstance } from 'fastify'
import {
  ensureIsolationTables,
  dropIsolationTables,
  createSimTask,
  bulkCreateSimTasks,
  cancelSimTask,
  getSimTaskStats,
  getSimCostTotal,
  startSimWorker,
  stopSimWorker,
  getSimWorkerState,
} from './isolation-layer.js'

export async function registerIsolationRoutes(fastify: FastifyInstance) {
  // ============================================================
  // 隔离环境控制
  // ============================================================

  // 初始化隔离表
  fastify.post('/api/sim-isolation/init', async (_request, reply) => {
    await ensureIsolationTables()
    return reply.send({ message: 'Isolation tables ready' })
  })

  // 清理隔离表
  fastify.post('/api/sim-isolation/cleanup', async (_request, reply) => {
    await dropIsolationTables()
    return reply.send({ message: 'Isolation tables dropped' })
  })

  // ============================================================
  // 模拟任务操作（只写 simulation_tasks 表）
  // ============================================================

  // 创建模拟任务
  fastify.post('/api/sim-isolation/tasks', async (request, reply) => {
    const body = request.body as any
    const task = await createSimTask({
      taskType: body.taskType ?? 'text_script',
      priority: body.priority ?? 3,
      payload: body.payload ?? {},
      userModel: body.userModel,
    })
    return reply.send(task)
  })

  // 批量创建
  fastify.post('/api/sim-isolation/tasks/bulk', async (request, reply) => {
    const body = request.body as any
    const count = await bulkCreateSimTasks(body.count ?? 1, {
      taskType: body.taskType ?? 'text_script',
      priority: body.priority ?? 3,
      payload: body.payload ?? {},
    })
    return reply.send({ created: count })
  })

  // 取消任务
  fastify.post('/api/sim-isolation/tasks/:id/cancel', async (request, reply) => {
    const { id } = request.params as any
    const ok = await cancelSimTask(id)
    return reply.send({ cancelled: ok })
  })

  // 任务统计
  fastify.get('/api/sim-isolation/tasks/stats', async (_request, reply) => {
    const stats = await getSimTaskStats()
    const cost = await getSimCostTotal()
    return reply.send({ ...stats, totalCost: cost })
  })

  // ============================================================
  // Simulation Worker 控制
  // ============================================================

  // 启动 Simulation Worker
  fastify.post('/api/sim-isolation/worker/start', async (request, reply) => {
    const body = request.body as any
    startSimWorker({
      concurrency: body.concurrency,
      processTimeMs: body.processTimeMs,
      failRate: body.failRate,
    })
    return reply.send(getSimWorkerState())
  })

  // 停止 Simulation Worker
  fastify.post('/api/sim-isolation/worker/stop', async (_request, reply) => {
    stopSimWorker()
    return reply.send(getSimWorkerState())
  })

  // Worker 状态
  fastify.get('/api/sim-isolation/worker', async (_request, reply) => {
    return reply.send(getSimWorkerState())
  })
}
