// ============================================================
// api/director-v2/compile-ir.ts — NarrativeIR 编译 API
// Phase 1: 唯一 Canonical IR 输出入口
//
// POST /api/director/compile-ir
// 输入: { script, projectId, title? }
// 输出: { success, data: { narrativeIR, trace } }
// ============================================================

import type { FastifyInstance } from 'fastify'
import { compileIR } from '../../director-v2/narrative-ir/compileIR.js'

export default async function compileIRRoutes(app: FastifyInstance) {
  app.post('/api/director/compile-ir', async (request, reply) => {
    try {
      const input = request.body as any

      if (!input.script || !input.projectId) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'validation', message: 'script and projectId are required' },
        })
      }

      const result = await compileIR({
        script: input.script,
        projectId: input.projectId,
        title: input.title,
      })

      return reply.send({
        success: true,
        data: result,
      })
    } catch (err: any) {
      console.error('[compile-ir] error:', err)
      return reply.status(500).send({
        success: false,
        error: { stage: 'compile', message: err.message || 'unknown error' },
      })
    }
  })
}
