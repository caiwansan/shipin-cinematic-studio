// ============================================================
// api/director-v2/compile-shotgraph.ts — ShotGraph 编译 API
// Phase 3: IR → ShotGraph（导演级镜头语言）
//
// POST /api/director/compile-shotgraph
// 输入: { narrativeIR } 或 { projectId }（从 DB 加载 IR）
// 输出: { success, data: { shotGraph, trace } }
// ============================================================

import type { FastifyInstance } from 'fastify'
import { compileShotGraph } from '../../director-v2/shotgraph/compileShotGraph.js'
import { prisma } from '../../utils/index.js'

export default async function compileShotGraphRoutes(app: FastifyInstance) {
  app.post('/api/director/compile-shotgraph', async (request, reply) => {
    try {
      const input = request.body as any
      let narrativeIR: any

      if (input.narrativeIR) {
        // 直接传入 IR
        narrativeIR = input.narrativeIR
      } else if (input.projectId) {
        // 从 DB 加载 IR
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { executionResults: true },
        })
        const exec = (project?.executionResults as Record<string, any>) || {}
        narrativeIR = exec.narrativeIR
        if (!narrativeIR) {
          return reply.status(404).send({
            success: false,
            error: { stage: 'load', message: 'narrativeIR not found for project' },
          })
        }
      } else {
        return reply.status(400).send({
          success: false,
          error: { stage: 'validation', message: 'narrativeIR or projectId required' },
        })
      }

      const shotGraph = await compileShotGraph(narrativeIR)

      return reply.send({
        success: true,
        data: {
          shotGraph,
          trace: {
            shots: shotGraph.meta.shotCount,
            transitions: shotGraph.transitions.length,
            totalDuration: shotGraph.meta.totalDuration,
            avgShotDuration: shotGraph.meta.avgShotDuration,
          },
        },
      })
    } catch (err: any) {
      console.error('[compile-shotgraph] error:', err)
      return reply.status(500).send({
        success: false,
        error: { stage: 'compile', message: err.message || 'unknown error' },
      })
    }
  })
}
