/**
 * Phase B — Single Entry API for Video Generation
 *
 * POST /api/video-optimize
 *
 * ═══════════════════════════════════════════════════════════════
 * SINGLE ENTRY CONTRACT
 *
 * This endpoint is the ONLY supported entry point
 * for video generation in Phase B+ system.
 *
 * Phase E1.5 Flow:
 *   1. buildAndInjectShotIR() — sync deterministic ShotIR + optional LLM polish
 *   2. compileVideo() — pure deterministic PromptIR → VideoPromptSpec
 *
 * No narrative / flat field inputs allowed.
 * ═══════════════════════════════════════════════════════════════
 */

import { FastifyInstance } from 'fastify'
import { buildAndInjectShotIR } from '../services/shotir-compiler.js'
import { compileVideo } from '../services/video-compiler.js'

/**
 * POST /api/video-optimize
 *
 * Phase E1.5: ShotIR is built BEFORE compile.
 * compileVideo() is called ONLY with fully populated PromptIR.
 */
export default async function apiVideoOptimizeRoutes(app: FastifyInstance) {
  app.post('/api/video-optimize', async (request, reply) => {
    const body = request.body as any
    const { promptIR, userId, enablePolish } = body || {}

    // ── 输入验证 ────────────────────────────────────────────────
    if (!promptIR) {
      return reply.status(400).send({
        success: false,
        error: '缺少 promptIR——此端点只接受 PromptIR 格式输入',
        code: 'MISSING_PROMPTIR',
      })
    }

    // ── Phase E1.5: Build ShotIR first (sync deterministic + optional polish) ──
    const { promptIR: enriched, shotResult } = await buildAndInjectShotIR(promptIR, {
      enablePolish: enablePolish !== false,   // default: on (but only leaf-level)
      userId,
    })

    if (!shotResult.ok && shotResult.shots.length === 0) {
      // ShotIR generation failed — return degraded but controlled
      return reply.status(200).send({
        success: true,
        spec: null,
        prompt: '',
        scores: { duration: 0, shotCount: 0, coverage: 0 },
        traceId: null,
        warnings: shotResult.violations.map(v => v.detail),
        metadata: {
          compiled: false,
          llmUsed: false,
          phase: 'E1.5',
          shotIRFailed: true,
          shotCount: 0,
          factGrid: shotResult.factGrid,
        },
      })
    }

    // ── Phase E1.5: Now compile with fully populated PromptIR ──
    const result = compileVideo(enriched)

    // ── typed error check ──────────────────────────────────────
    if (result.error) {
      return reply.status(422).send({
        success: false,
        error: result.error.message,
        stage: result.error.stage,
        code: result.error.code,
        recoverable: result.error.recoverable,
      })
    }

    return {
      success: true,
      spec: result.spec,
      prompt: result.prompt,
      scores: result.scores,
      traceId: result.trace?.traceId,
      metadata: {
        compiled: true,
        legacy: false,
        llmUsed: false,
        phase: 'E1.5',
        version: 'v2',
        shotCount: shotResult.shots.length,
        shotIRFailed: false,
        inferenceLevels: shotResult.shots.map(s => s.preservation.inferenceLevel),
        factGrid: {
          entities: shotResult.factGrid.explicit.entities,
          locations: shotResult.factGrid.explicit.locations,
          events: shotResult.factGrid.explicit.events,
          env: shotResult.factGrid.environmentCompletion,
        },
        cacheHit: result.trace?.stages?.[0]?.name === 'CACHE_HIT',
      },
    }
  })
}
