/**
 * routes/p1.8-evaluate.ts — P1.8 生产切换决策 API
 *
 * GET  /api/p1.8/evaluate — 使用当前 V3 metrics 数据运行决策模型
 * POST /api/p1.8/evaluate — 使用自定义输入运行决策模型
 */

import { FastifyInstance } from 'fastify'
import { generateV3HealthReport } from '../services/v3-metrics.service.js'
import { evaluateProductionSwitch, type P18Input } from '../services/p1.8-switch-decision.js'

export default async function p18Routes(app: FastifyInstance) {

  /**
   * GET /api/p1.8/evaluate
   * 使用当前 V3 metrics 数据自动构建输入并运行决策模型。
   */
  app.get('/api/p1.8/evaluate', async (request, reply) => {
    // 获取最近的数据
    const health = await generateV3HealthReport(168) // 7 天

    if (health.scriptCount < 10) {
      return {
        success: true,
        data: {
          decision: 'HOLD',
          reason: `数据不足（当前 ${health.scriptCount} 条记录，建议 ≥ 100），无法做出有意义的评估。`,
          scriptCount: health.scriptCount,
          insufficientData: true,
        },
      }
    }

    // 从健康报告构造输入
    // 注意：perceptualScores 和 stabilityMetrics 需要人工评审输入
    // 这里使用 approximate 值
    const input: P18Input = {
      fillRate: health.avgFillRate,
      qualityRate: health.avgQualityRate,
      semanticYield: health.avgSemanticYield,
      // 默认 placeholder——实际需要人工评分或自动感知分析
      perceptualScores: {
        emotionStrength: 0,
        shotDiversity: 0,
        characterConsistency: 0,
        sceneCoherence: 0,
        cinematicQuality: 0,
      },
      stabilityMetrics: {
        fallbackRate: 0,
        missingFieldRate: 0,
        promptFailureRate: 0,
        schemaDriftCount: 0,
      },
      systemCompatibilityRate: 0.5, // 中性值——双轨系统
    }

    const report = await evaluateProductionSwitch(input)
    return {
      success: true,
      data: {
        ...report,
        _note: 'PerceptualGain 和 StabilityRisk 需要人工评审输入。POST /api/p1.8/evaluate 可提供完整数据。',
        metricsPeriod: health.period,
      },
    }
  })

  /**
   * POST /api/p1.8/evaluate
   * 使用完整自定义输入运行决策模型。
   */
  app.post('/api/p1.8/evaluate', async (request, reply) => {
    const body = request.body as any
    if (!body) {
      return reply.status(400).send({ success: false, error: '需要请求体' })
    }

    const input: P18Input = {
      fillRate: body.fillRate || {},
      qualityRate: body.qualityRate || {},
      semanticYield: body.semanticYield || 0,
      perceptualScores: body.perceptualScores || {
        emotionStrength: 0, shotDiversity: 0,
        characterConsistency: 0, sceneCoherence: 0, cinematicQuality: 0,
      },
      stabilityMetrics: body.stabilityMetrics || {
        fallbackRate: 0, missingFieldRate: 0,
        promptFailureRate: 0, schemaDriftCount: 0,
      },
      systemCompatibilityRate: body.systemCompatibilityRate ?? 0.5,
    }

    const report = await evaluateProductionSwitch(input)
    return { success: true, data: report }
  })
}
