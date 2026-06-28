/**
 * Execution Intelligence API Handler
 * Phase 7 — Execution Intelligence Layer
 */

import { RenderJob } from '../production-loop/job-types'
import { IntelligenceLoop } from './intelligence-loop'
import { OptimizationMode } from './dag-optimizer'

export interface OptimizeRequest {
  traceId: string
  mode?: OptimizationMode
}

export class IntelligenceAPIHandler {
  private loop = new IntelligenceLoop()

  /**
   * 对指定 trace 的 blueprint 执行智能优化
   */
  async handleOptimize(req: OptimizeRequest, jobStore: Map<string, RenderJob>) {
    const job = jobStore.get(req.traceId)
    if (!job) {
      return { success: false, error: 'Job not found' }
    }

    const result = this.loop.run({
      blueprint: job.blueprint,
      optimizationMode: req.mode,
    })

    // 将优化后的 blueprint 写回 jobStore
    jobStore.set(req.traceId, {
      ...job,
      blueprint: result.optimizedBlueprint,
      updatedAt: Date.now(),
    })

    return {
      success: true,
      traceId: req.traceId,
      result: {
        schedule: result.schedule.map(s => ({ id: s.id, priority: s.priority, status: s.status })),
        cost: result.cost,
        evolution: result.evolution,
        adaptation: result.adaptation,
        trace: result.trace,
      },
    }
  }

  /**
   * 查询执行成本预估
   */
  async handleCostEstimate(req: OptimizeRequest, jobStore: Map<string, RenderJob>) {
    const job = jobStore.get(req.traceId)
    if (!job) {
      return { success: false, error: 'Job not found' }
    }

    const { CostModel } = require('./cost-model')
    const model = new CostModel()
    const cost = model.estimateBlueprint(job.blueprint)

    return { success: true, traceId: req.traceId, cost }
  }
}

export const intelligenceAPI = new IntelligenceAPIHandler()
