/**
 * Phase 6C-3.3 — Backpressure Control API
 */

import { FastifyInstance } from 'fastify'
import {
  startBackpressureController,
  stopBackpressureController,
  getBackpressureStatus,
  updateBackpressureConfig,
  resetBackpressure,
  getAllowedRate,
} from './backpressure-controller.js'

export async function registerBackpressureRoutes(fastify: FastifyInstance) {
  // 启动
  fastify.post('/api/sim-isolation/backpressure/start', async (request, reply) => {
    const body = request.body as any
    startBackpressureController({
      highWaterMark: body.highWaterMark ?? 100,
      lowWaterMark: body.lowWaterMark ?? 20,
      minRate: body.minRate ?? 1,
      maxRate: body.maxRate ?? 20,
      initialRate: body.initialRate ?? 10,
      emergencyThreshold: body.emergencyThreshold ?? 500,
    })
    return reply.send(await getBackpressureStatus())
  })

  // 停止
  fastify.post('/api/sim-isolation/backpressure/stop', async (_request, reply) => {
    stopBackpressureController()
    return reply.send({ message: 'Backpressure controller stopped' })
  })

  // 状态
  fastify.get('/api/sim-isolation/backpressure', async (_request, reply) => {
    return reply.send(await getBackpressureStatus())
  })

  // 配置更新
  fastify.patch('/api/sim-isolation/backpressure/config', async (request, reply) => {
    const body = request.body as any
    updateBackpressureConfig(body)
    return reply.send(await getBackpressureStatus())
  })

  // 重置
  fastify.post('/api/sim-isolation/backpressure/reset', async (_request, reply) => {
    resetBackpressure()
    return reply.send(await getBackpressureStatus())
  })

  // 当前允许速率
  fastify.get('/api/sim-isolation/backpressure/rate', async (_request, reply) => {
    return reply.send({ allowedRate: getAllowedRate() })
  })
}
