/**
 * api/director-v2/export.ts — Export Projection Layer API
 *
 * 端点：
 *   POST /api/director/export — 投影运行时状态为 studio 语义提示
 *
 * 宪法：
 *   - 不生成最终媒体资产
 *   - 不修改 IR/Timeline/ExecutionPlan
 *   - 不调用 studio-v2 pipeline
 */

import type { FastifyInstance } from 'fastify'
import { liveBridge } from '../../director-v2/live/live-bridge.js'
import { projectRuntimeToStudioHints } from '../../director-v2/export/director-projection.js'

export default async function (fastify: FastifyInstance) {

  // POST /api/director/export — 投影运行时状态
  fastify.post('/api/director/export', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      const sessionKey = body?.sessionKey as string | undefined

      if (!sessionKey) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'input', message: 'sessionKey 缺失' },
        })
      }

      const controller = liveBridge.getController(sessionKey)
      if (!controller) {
        return reply.status(404).send({
          success: false,
          error: { stage: 'runtime', message: 'sessionKey 无效或已过期' },
        })
      }

      const state = controller.getControllerState()
      const projection = projectRuntimeToStudioHints(state, sessionKey)

      return reply.send({
        success: true,
        data: { projection },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : 'Export 投影异常',
        },
      })
    }
  })
}
