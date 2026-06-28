import type { ApiResponse } from '../contracts/api/base.js';
/**
 * P7 — Autonomous Runtime API Routes
 *
 *  - POST /api/v2/autonomous/execute    — 自优化调度执行
 *  - GET  /api/v2/autonomous/insights   — 学习洞察
 *  - GET  /api/v2/autonomous/stats      — 调度统计
 *  - POST /api/v2/autonomous/evolve     — 手动触发进化
 *  - GET  /api/v2/autonomous/scaling    — 扩缩决策
 */

import { FastifyInstance } from 'fastify'
import { selfOptimizingScheduler } from '../core/autonomous/self-optimizing-scheduler.js'
import { patternLearner } from '../core/autonomous/pattern-learner.js'
import { runtimeEvolutionEngine } from '../core/autonomous/runtime-evolution-engine.js'
import { adaptiveClusterScaler } from '../core/autonomous/adaptive-cluster-scaler.js'
import { Capability } from '../core/runtime/capabilities.js'

export default async function autonomousRoutes(app: FastifyInstance) {
  // 自优化执行
  app.post('/api/v2/autonomous/execute', async (request: any, reply) => {
    const { capability, payload, userId } = request.body
    if (!capability || !payload) {
      return reply.status(400).send({ success: false, error: '需要 capability 和 payload' })
    }

    const result = await selfOptimizingScheduler.schedule(capability, payload, userId || 'anonymous')
    return { success: true, data: { result } } satisfies ApiResponse<unknown>;

  })

  // 学习洞察
  app.get('/api/v2/autonomous/insights', async () => {
    return {
      success: true,
      data: {
        insights: patternLearner.getInsights(),
        patterns: patternLearner.getPatterns().length,
      },
    }
  })

  // 调度统计
  app.get('/api/v2/autonomous/stats', async () => {
    return {
      success: true,
      data: selfOptimizingScheduler.getStats(),
    }
  })

  // 手动触发进化
  app.post('/api/v2/autonomous/evolve', async () => {
    const report = await runtimeEvolutionEngine.evolve()
    return { success: true, data: report } satisfies ApiResponse<unknown>;

  })

  // 扩缩决策
  app.get('/api/v2/autonomous/scaling', async () => {
    const decision = adaptiveClusterScaler.decide()
    return {
      success: true,
      data: {
        decision,
        loadHistory: adaptiveClusterScaler.getLoadHistory(),
      },
    }
  })
}
