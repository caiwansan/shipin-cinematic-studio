// ============================================================
// api/director-v2/compile-emotion.ts — Emotion Field API
// Phase 5: 情绪 = 运行时系统变量
//
// POST /api/director/compile-emotion
// 输入: { narrativeIR, shotGraph, timelineGraph }
// 输出: { success, data: { emotionField, trace } }
// ============================================================

import type { FastifyInstance } from 'fastify'
import { compileEmotionField } from '../../director-v2/emotion/compileEmotionField.js'

export default async function compileEmotionRoutes(app: FastifyInstance) {
  app.post('/api/director/compile-emotion', async (request, reply) => {
    try {
      const input = request.body as any

      if (!input.narrativeIR || !input.shotGraph || !input.timelineGraph) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'validation', message: 'narrativeIR, shotGraph, and timelineGraph are required' },
        })
      }

      const emotionField = await compileEmotionField(
        input.narrativeIR,
        input.shotGraph,
        input.timelineGraph,
      )

      return reply.send({
        success: true,
        data: {
          emotionField,
          trace: {
            globalTone: emotionField.globalTone,
            globalTension: emotionField.globalTension,
            globalIntimacy: emotionField.globalIntimacy,
            globalInstability: emotionField.globalInstability,
            keyframes: emotionField.meta.keyframeCount,
            dynamicRange: emotionField.meta.dynamicRange,
            duration: emotionField.meta.totalDuration,
          },
        },
      })
    } catch (err: any) {
      console.error('[compile-emotion] error:', err)
      return reply.status(500).send({
        success: false,
        error: { stage: 'compile', message: err.message || 'unknown error' },
      })
    }
  })
}
