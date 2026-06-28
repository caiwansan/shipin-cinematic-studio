/**
 * routes/p18-data-activation.ts — P1.8 Data Activation Layer API
 *
 * ═══════════════════════════════════════════════════════════════
 * 宪法：
 *   这些端点只负责数据采集和观测。
 *   不触发任何 AI 调用，不修改生产管线。
 * ═══════════════════════════════════════════════════════════════
 *
 * POST /api/p18/dual-render       — 提交一次双轨渲染
 * GET  /api/p18/pairs             — 配对样本列表
 * GET  /api/p18/pairs/stats       — 配对统计
 * GET  /api/p18/pairs/:pairId     — 单对详情
 * POST /api/p18/label/:pairId     — 人工标注感知评分
 */

import { FastifyInstance } from 'fastify'
import { scheduleDualRender } from '../services/p18/dual-render-orchestrator.js'
import { getCompletedPairs, countPairs, collectEvalData } from '../services/p18/evaluation-collector.js'
import { prisma } from '../utils/index.js'
import { resolveProviderFromUserConfig } from '../runtime-provider-resolver.js'

export default async function p18DataActivationRoutes(app: FastifyInstance) {
  // ─── 认证中间件（所有 P1.8 端点） ────────────────────────────
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/p18/dual-render
   *
   * 提交一次双轨渲染。
   * 同时触发 V2（production-loop） 和 V3（video-compiler）。
   */
  app.post('/api/p18/dual-render', async (request, reply) => {
    const user = request.user as any
    const body = request.body as any
    const {
      projectId, scriptContent, v2Input, v3PromptIR,
      enableV3Polish = true, priority = 1,
    } = body || {}

    // ── 输入验证 ──────────────────────────────────────────────
    if (!projectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })
    if (!v2Input || !v2Input.prompt) return reply.status(400).send({ success: false, error: '缺少 v2Input.prompt' })
    if (!v3PromptIR) return reply.status(400).send({ success: false, error: '缺少 v3PromptIR' })

    // ── 获取用户 runtime ──────────────────────────────────────
    let runtime
    try {
      const resolved = await resolveProviderFromUserConfig(user.id, '', 'video')
      runtime = {
        provider: resolved.provider,
        apiKey: resolved.apiKey,
        model: resolved.model,
        baseURL: resolved.baseURL,
        userId: user.id,
        taskType: resolved.taskType,
      }
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: `用户未配置视频模型 API Key: ${err.message}`,
      })
    }

    // ── 调度双轨渲染 ──────────────────────────────────────────
    try {
      const result = await scheduleDualRender(
        {
          projectId, userId: user.id, scriptContent: scriptContent || '',
          v2Input, v3PromptIR,
          enableV3Polish, priority,
        },
        runtime,
      )

      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: `双轨渲染调度失败: ${err.message}`,
      })
    }
  })

  /**
   * GET /api/p18/pairs
   *
   * 配对样本列表。
   */
  app.get('/api/p18/pairs', async (request, reply) => {
    const query = request.query as any
    const limit = Math.min(parseInt(query.limit) || 50, 200)
    const offset = parseInt(query.offset) || 0

    const pairs = await getCompletedPairs({ limit, offset })
    const stats = await countPairs()

    return {
      success: true,
      data: { pairs, stats, limit, offset },
    }
  })

  /**
   * GET /api/p18/pairs/stats
   *
   * 配对统计。
   */
  app.get('/api/p18/pairs/stats', async (request, reply) => {
    const stats = await countPairs()

    return {
      success: true,
      data: stats,
    }
  })

  /**
   * GET /api/p18/pairs/:pairId
   *
   * 单对详情。
   */
  app.get('/api/p18/pairs/:pairId', async (request, reply) => {
    const { pairId } = request.params as any

    const pair = await prisma.p18Pair.findUnique({
      where: { pairId },
    })

    if (!pair) {
      return reply.status(404).send({ success: false, error: '配对记录未找到' })
    }

    // 关联的 V2 任务
    const v2Task = pair.v2TaskId
      ? await prisma.videoTask.findUnique({ where: { id: pair.v2TaskId } }).catch(() => null)
      : null

    // 关联的 V3 结果
    const v3Result = pair.v3TaskId
      ? await prisma.v3RenderResult.findUnique({ where: { taskId: pair.v3TaskId } }).catch(() => null)
      : null

    return {
      success: true,
      data: { pair, v2Task, v3Result },
    }
  })

  /**
   * POST /api/p18/label/:pairId
   *
   * 人工标注感知评分。
   * 用于 P1.8-A Perceptual Delta Audit。
   */
  app.post('/api/p18/label/:pairId', async (request, reply) => {
    const { pairId } = request.params as any
    const body = request.body as any
    const {
      emotionStrength, shotDiversity,
      characterConsistency, sceneCoherence, cinematicQuality,
    } = body || {}

    // 验证存在
    const pair = await prisma.p18Pair.findUnique({ where: { pairId } })
    if (!pair) {
      return reply.status(404).send({ success: false, error: '配对记录未找到' })
    }

    // 验证评分范围 [-2, +2]
    const scores = {
      emotionStrength: clampScore(emotionStrength),
      shotDiversity: clampScore(shotDiversity),
      characterConsistency: clampScore(characterConsistency),
      sceneCoherence: clampScore(sceneCoherence),
      cinematicQuality: clampScore(cinematicQuality),
    }

    // 检查是否有足够的有效评分
    const validScores = Object.values(scores).filter(v => v !== null)
    if (validScores.length === 0) {
      return reply.status(400).send({ success: false, error: '至少提供一个评分维度' })
    }

    // 更新配对记录的感知评分
    await collectEvalData({
      pairId,
      v3Metrics: {
        fillRate: (pair.v3FillRate || {}) as Record<string, number>,
        qualityRate: (pair.v3QualityRate || {}) as Record<string, number>,
        semanticYield: pair.v3SemanticYield || 0,
      },
      stabilityMetrics: {
        fallbackRate: pair.v3FallbackRate || 0,
        missingFieldRate: pair.v3MissingFieldRate || 0,
        promptFailureRate: pair.v3PromptFailureRate || 0,
      },
      perceptualScores: scores as any,
    })

    return { success: true, data: { pairId, scores } }
  })
}

function clampScore(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  if (isNaN(n)) return null
  return Math.max(-2, Math.min(2, n))
}
