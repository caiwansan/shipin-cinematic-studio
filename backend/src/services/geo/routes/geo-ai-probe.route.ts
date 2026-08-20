// ============================================================
// AI Probe Route — 真实 AI 可见度探测 API
// POST /api/geo/projects/:id/ai-probe — 执行 AI 探测
// GET  /api/geo/projects/:id/ai-probe/status — 检查是否可用
// ============================================================

import { FastifyInstance } from 'fastify'
import { runAIProbe, isAIProbeAvailable } from '../services/ai-probe.service.js'
import { analyzeKnowledgeQuality } from '../services/knowledge-quality.service.js'
import { executeClosedLoopOptimization } from '../services/optimization-executor.js'
import { diagnoseVisibility } from '../services/diagnosis-engine.js'
import { rewriteFromDiagnosis } from '../services/content-rewrite-engine.js'
import { executeFullClosedLoop } from '../services/closed-loop-orchestrator.js'

export default async function geoAIPRoutes(fastify: FastifyInstance) {
  // POST /api/geo/projects/:id/ai-probe — 执行 AI 可见度探测
  fastify.post('/api/geo/projects/:id/ai-probe', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      customQuestions?: string[]
      engineFilter?: string[]
      maxQuestionsPerEngine?: number
    } | undefined

    try {
      if (!isAIProbeAvailable()) {
        return reply.status(503).send({
          success: false,
          error: '未配置 AI 引擎 API Key，请在系统设置中配置 DeepSeek/LongCat/SiliconFlow',
        })
      }

      const result = await runAIProbe(id, {
        customQuestions: body?.customQuestions,
        engineFilter: body?.engineFilter,
        maxQuestionsPerEngine: body?.maxQuestionsPerEngine,
      })

      return { success: true, data: result }
    } catch (err: any) {
      fastify.log.error(err, 'AI Probe failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/ai-probe/status — 检查 AI 探测是否可用
  fastify.get('/api/geo/projects/:id/ai-probe/status', { preHandler: [] }, async (request, reply) => {
    try {
      return {
        success: true,
        data: {
          available: isAIProbeAvailable(),
          engines: [
            { id: 'deepseek', label: 'DeepSeek', available: !!process.env.DEEPSEEK_API_KEY },
            { id: 'longcat', label: 'LongCat', available: !!process.env.LONGCAT_API_KEY },
            { id: 'siliconflow', label: 'SiliconFlow', available: !!process.env.SILICONFLOW_API_KEY },
          ],
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:id/closed-loop-optimization — 闭环优化（Probe→优化→再Probe）
  fastify.post('/api/geo/projects/:id/closed-loop-optimization', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      optimizationType: 'knowledge_generation' | 'entity_expansion'
    } | undefined

    try {
      if (!isAIProbeAvailable()) {
        return reply.status(503).send({
          success: false,
          error: '未配置 AI 引擎 API Key，无法执行闭环优化',
        })
      }

      const optimizationType = body?.optimizationType || 'knowledge_generation'
      const result = await executeClosedLoopOptimization(id, optimizationType)

      return { success: true, data: result }
    } catch (err: any) {
      fastify.log.error(err, 'Closed-loop optimization failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // GET /api/geo/projects/:id/knowledge-quality — 知识内容质量检测
  fastify.get('/api/geo/projects/:id/knowledge-quality', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const report = await analyzeKnowledgeQuality(id)
      return { success: true, data: report }
    } catch (err: any) {
      fastify.log.error(err, 'Knowledge quality analysis failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:id/full-closed-loop — 一键闭环优化（探测→诊断→改写→再探测）
  fastify.post('/api/geo/projects/:id/full-closed-loop', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      if (!isAIProbeAvailable()) {
        return reply.status(503).send({
          success: false,
          error: '未配置 AI 引擎 API Key，无法执行闭环优化',
        })
      }

      const result = await executeFullClosedLoop(id)
      return { success: true, data: result }
    } catch (err: any) {
      fastify.log.error(err, 'Full closed-loop optimization failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:id/diagnose — 诊断 AI 可见度失败原因
  fastify.post('/api/geo/projects/:id/diagnose', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      if (!isAIProbeAvailable()) {
        return reply.status(503).send({
          success: false,
          error: '未配置 AI 引擎 API Key，无法执行诊断',
        })
      }

      // 先执行探测
      const probeResult = await runAIProbe(id, { maxQuestionsPerEngine: 5 })
      // 然后诊断
      const diagnosis = await diagnoseVisibility(id, probeResult)

      return { success: true, data: { probe: probeResult, diagnosis } }
    } catch (err: any) {
      fastify.log.error(err, 'Diagnosis failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // POST /api/geo/projects/:id/rewrite — AI 根据诊断自动改写内容
  fastify.post('/api/geo/projects/:id/rewrite', { preHandler: [] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { probeResult?: any } | undefined

    try {
      if (!isAIProbeAvailable()) {
        return reply.status(503).send({
          success: false,
          error: '未配置 AI 引擎 API Key，无法执行改写',
        })
      }

      // 如果没有传入 probeResult，先执行探测
      let probe = body?.probeResult
      if (!probe) {
        probe = await runAIProbe(id, { maxQuestionsPerEngine: 5 })
      }

      // 诊断
      const diagnosis = await diagnoseVisibility(id, probe)
      // 改写
      const rewriteResult = await rewriteFromDiagnosis(id, diagnosis)

      return { success: true, data: { diagnosis, rewrite: rewriteResult } }
    } catch (err: any) {
      fastify.log.error(err, 'Rewrite failed')
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
