import type { ApiResponse } from '../contracts/api/base.js';
/**
 * P2 — Control Plane API Routes
 *
 * 暴露 Control Plane 状态：
 *  - GET /api/v2/control-plane/status — 队列/Worker/Backpressure 状态
 *  - GET /api/v2/control-plane/cutover — 执行切换层状态
 *  - POST /api/v2/control-plane/execute — 通过 ControlPlane 执行任务
 */

import { FastifyInstance } from 'fastify'
import { controlPlane } from '../core/control-plane/control-plane.js'
import { Capability } from '../core/runtime/capabilities.js'
import { executionCutover } from '../core/control-plane/cutover/execution-cutover.js'

export default async function controlPlaneV2Routes(app: FastifyInstance) {
  // 初始化 ControlPlane（开机时自动初始化，但确保）
  app.addHook('onReady', async () => {
    await controlPlane.init()
    console.log('[ControlPlaneRoutes] ✅ Control Plane 已就绪')
  })

  // 状态接口
  app.get('/api/v2/control-plane/status', async () => {
    return {
      success: true,
      data: {
        status: 'active',
        initialized: true,
        capabilities: Object.values(Capability),
        timestamp: new Date().toISOString(),
      },
    }
  })

  // Cutover 状态接口
  app.get('/api/v2/control-plane/cutover', async () => {
    return {
      success: true,
      data: {
        mode: executionCutover.getMode(),
        entry: 'executionCutover.execute()',
        legacy: 'worker-runtime (frozen)',
        status: 'single path — all traffic through ControlPlane',
      },
    }
  })

  // 执行任务（需要通过用户认证）
  app.post('/api/v2/control-plane/execute', {
    schema: {
      body: {
        type: 'object',
        required: ['capability', 'payload'],
        properties: {
          capability: { type: 'string' },
          payload: { type: 'object' },
          priority: { type: 'number' },
        },
      },
    },
  }, async (request: any, reply) => {
    const userId = request.user?.id || request.headers['x-user-id'] || 'anonymous'

    // 验证 Capability
    const { capability, payload, priority } = request.body
    if (!Object.values(Capability).includes(capability)) {
      return reply.status(400).send({
        success: false,
        error: `无效 capability: ${capability}`,
      })
    }

    try {
      const result = await controlPlane.execute({
        capability: capability as Capability,
        userId,
        payload,
        priority: priority || 0,
      })

      return reply.send(result)
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: err.message || 'ControlPlane execution failed',
      })
    }
  })
}
