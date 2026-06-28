// ============================================================
// api/director-v2/compile-temporal.ts — Temporal Director API
// Phase 4: ShotGraph → TimelineGraph（时间节奏生成器）
//
// POST /api/director/compile-temporal
// 输入: { shotGraph }
// 输出: { success, data: { timelineGraph, trace } }
// ============================================================

import type { FastifyInstance } from 'fastify'
import { compileTemporalDirector } from '../../director-v2/temporal/compileTemporalDirector.js'

export default async function compileTemporalRoutes(app: FastifyInstance) {
  app.post('/api/director/compile-temporal', async (request, reply) => {
    try {
      const input = request.body as any

      if (!input.shotGraph) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'validation', message: 'shotGraph is required' },
        })
      }

      const timelineGraph = await compileTemporalDirector(input.shotGraph)

      return reply.send({
        success: true,
        data: {
          timelineGraph,
          trace: {
            sequences: timelineGraph.meta.sequenceCount,
            totalBeats: timelineGraph.meta.totalBeats,
            totalDuration: timelineGraph.meta.totalDuration,
            rhythmRange: timelineGraph.meta.rhythmRange,
            cutTypes: timelineGraph.meta.cutTypeDistribution,
          },
        },
      })
    } catch (err: any) {
      console.error('[compile-temporal] error:', err)
      return reply.status(500).send({
        success: false,
        error: { stage: 'compile', message: err.message || 'unknown error' },
      })
    }
  })
}
