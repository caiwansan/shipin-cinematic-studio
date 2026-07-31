// DEPRECATED（SPRINT-ADMIN-CLEANUP-02-FIX）: 本路由从未被 index.ts 挂载（0 注册点）。credential-lifecycle 路由群（capability/providers/recovery/runtime-summary）全部未接线；admin-platform-runtime 依赖的 platform_provider_config 表不存在。保留代码不删除，禁止挂载，重建需先建表。
// ============================================================
// Runtime Summary API — GET /api/runtime/summary
// ============================================================

import { FastifyInstance } from 'fastify'
import { getCredentialLifecycleService } from './credential-lifecycle.service.js'

const registerRuntimeSummaryRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/runtime/summary', async (_req, reply) => {
    const service = getCredentialLifecycleService()
    const summary = await service.getSummary()
    return reply.send(summary)
  })
}

export { registerRuntimeSummaryRoutes }
