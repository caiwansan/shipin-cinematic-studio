import { FastifyInstance } from 'fastify'
import { optimizationLoop } from '../services/prompt-intelligence/optimization-loop.js'
import { promptEvaluator } from '../services/prompt-intelligence/prompt-evaluator.js'
import { promptMemory } from '../services/prompt-intelligence/prompt-memory.js'
import { prisma } from '../utils/index.js'
import { env } from '../config/env.js'

export default async function optimizeRoutes(fastify: FastifyInstance) {
  // POST /api/images/optimize-prompt — 提示词自优化（含闭环）
  fastify.post('/api/images/optimize-prompt', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { prompt, style, mode, negativePrompt, taskType } = request.body as any

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt is required' })
    }

    // 没配 API key → 降级到基础优化（不用 LLM）
    const hasLLM = !!env.DEEPSEEK_API_KEY || !!env.OPENAI_API_KEY

    // 走闭环系统
    const result = await optimizationLoop.run({
      rawPrompt: prompt,
      style,
      mode,
      taskType: taskType || 'image',
      userId,
      negativePrompt,
    })

    return {
      optimizedPrompt: result.finalPrompt,
      optimizedNegative: negativePrompt,
      optimized: result.optimized,
      improvements: result.improvements,
      evaluation: result.evaluation
        ? {
            totalScore: result.evaluation.totalScore,
            qualityScore: result.evaluation.qualityScore,
            consistencyScore: result.evaluation.consistencyScore,
            realismScore: result.evaluation.realismScore,
            summaries: result.evaluation.summaries,
          }
        : null,
      llmAvailable: hasLLM,
      retries: result.retries,
    }
  })

  // POST /api/images/evaluate — 评估结果（生成后调用）
  fastify.post('/api/images/evaluate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { prompt, optimizedPrompt, provider, modelName, taskType,
      style, mode, renderTimeMs, cost, success, failureReason } = request.body as any

    // 评估 prompt
    const evaluation = await promptEvaluator.evaluate({
      prompt: optimizedPrompt || prompt,
      taskType: taskType || 'image',
      mode,
    })

    // 记录到 Prompt Memory
    if (prompt) {
      await promptMemory.record({
        userId,
        prompt: prompt || '',
        optimizedPrompt: optimizedPrompt || prompt || '',
        provider: provider || 'unknown',
        modelName: modelName || 'unknown',
        taskType: taskType || 'image',
        style,
        mode,
        qualityScore: evaluation.qualityScore,
        consistencyScore: evaluation.consistencyScore,
        realismScore: evaluation.realismScore,
        renderTimeMs: renderTimeMs || 0,
        cost: cost || 0,
        success: success !== false,
        failureReason,
      })
    }

    return {
      evaluation: {
        totalScore: evaluation.totalScore,
        qualityScore: evaluation.qualityScore,
        consistencyScore: evaluation.consistencyScore,
        realismScore: evaluation.realismScore,
        detailScore: evaluation.detailScore,
        compositionScore: evaluation.compositionScore,
        summaries: evaluation.summaries,
      },
      recorded: !!prompt,
    }
  })

  // GET /api/images/prompt-history — 查看 prompt 历史
  fastify.get('/api/images/prompt-history', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = '20', taskType } = request.query as any

    const where: any = { userId }
    if (taskType) where.taskType = taskType

    const records = await prisma.$queryRawUnsafe(`
      SELECT id, prompt, optimized_prompt, provider, "modelName", "taskType",
             "qualityScore", "consistencyScore", "realismScore", success,
             feedback, "renderTimeMs", cost, "createdAt"
      FROM prompt_memory
      WHERE "userId" = $1${taskType ? ' AND "taskType" = $2' : ''}
      ORDER BY "createdAt" DESC
      LIMIT $${taskType ? 3 : 2}
    `, userId, ...(taskType ? [taskType, Number(limit)] : [Number(limit)]))

    return { records: records || [] }
  })
}
