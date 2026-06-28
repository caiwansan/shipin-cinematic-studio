import type { ApiResponse } from '../contracts/api/base.js';
/**
 * P6 — Global API Routes
 *
 *  - GET  /api/v2/global/regions       — 列出所有区域
 *  - POST /api/v2/global/route         — 区域路由决策
 *  - POST /api/v2/global/schedule      — 全球调度任务
 *  - GET  /api/v2/global/federation    — 联邦链路
 *  - POST /api/v2/global/sync          — 触发全局状态同步
 */

import { FastifyInstance } from 'fastify'
import { regionRouter } from '../core/global/region-router.js'
import { globalScheduler } from '../core/global/global-scheduler.js'
import { clusterFederation } from '../core/global/cluster-federation.js'
import { globalStateMesh } from '../core/global/global-state-mesh.js'

export default async function globalRoutes(app: FastifyInstance) {
  // 区域列表
  app.get('/api/v2/global/regions', async () => {
    return { success: true, data: { regions: regionRouter.listRegions() } } satisfies ApiResponse<unknown>;

  })

  // 区域路由决策
  app.post('/api/v2/global/route', async (request: any, reply) => {
    const { capability, preferLowLatency, preferLowCost, preferredRegion } = request.body
    if (!capability) {
      return reply.status(400).send({ success: false, error: '需要 capability' })
    }

    const decision = regionRouter.selectRegion({ capability, preferLowLatency, preferLowCost, preferredRegion })
    return { success: true, data: decision } satisfies ApiResponse<unknown>;

  })

  // 全球调度
  app.post('/api/v2/global/schedule', async (request: any, reply) => {
    const { capability, payload, userId, preferLowLatency, preferLowCost, preferredRegion } = request.body
    if (!capability || !payload) {
      return reply.status(400).send({ success: false, error: '需要 capability 和 payload' })
    }

    const result = await globalScheduler.schedule({
      capability,
      payload,
      userId: userId || 'anonymous',
      preferLowLatency,
      preferLowCost,
      preferredRegion,
    })

    return { success: true, data: { result } } satisfies ApiResponse<unknown>;

  })

  // 联邦链路
  app.get('/api/v2/global/federation', async () => {
    return { success: true, data: { links: clusterFederation.listLinks() } } satisfies ApiResponse<unknown>;

  })

  // 全局状态同步
  app.post('/api/v2/global/sync', async () => {
    const snapshot = await globalStateMesh.sync()
    return { success: true, data: snapshot } satisfies ApiResponse<unknown>;

  })
}
