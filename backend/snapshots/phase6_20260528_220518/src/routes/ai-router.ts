import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { aiRouter } from '../services/ai-router.service.js'

export default async function aiRouterRoutes(fastify: FastifyInstance) {
  // ==========================================================
  // AI Model Registry — 模型注册中心
  // ==========================================================

  // GET /api/ai/models — 列出所有模型
  fastify.get('/api/ai/models', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await aiRouter.getModelRegistry()
  })

  // PUT /api/ai/models/:id/status — 更新模型状态
  fastify.put('/api/ai/models/:id/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const { status } = request.body as any
    if (!['active', 'degraded', 'deprecated', 'disabled'].includes(status)) {
      return reply.status(400).send({ error: `Invalid status: ${status}` })
    }
    return await aiRouter.updateModelStatus(id, status)
  })

  // ==========================================================
  // AI Routing — 路由选择
  // ==========================================================

  // POST /api/ai/select — 模拟路由选择（不执行，只看选哪个模型）
  fastify.post('/api/ai/select', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskType, policyName, maxCost, maxLatency } = request.body as any
    if (!taskType) return reply.status(400).send({ error: 'taskType required' })

    const result = await aiRouter.select({
      taskId: 'simulation',
      taskType,
      policyName,
      maxCost,
      maxLatency,
    })

    if (!result) return reply.status(404).send({ error: 'No model available' })
    return result
  })

  // POST /api/ai/fallback — 模拟 fallback 链
  fastify.post('/api/ai/fallback', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskType, modelId } = request.body as any
    if (!taskType || !modelId) return reply.status(400).send({ error: 'taskType and modelId required' })

    const chain = await aiRouter.getFallbackChain(taskType, modelId)
    return { taskType, failedModelId: modelId, fallbackChain: chain }
  })

  // ==========================================================
  // AI Execution — 执行日志 & 成本
  // ==========================================================

  // GET /api/ai/executions — 执行历史
  fastify.get('/api/ai/executions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { limit } = request.query as any
    return await aiRouter.getExecutionHistory(limit ? parseInt(limit) : 50)
  })

  // GET /api/ai/costs — 成本摘要
  fastify.get('/api/ai/costs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.query as any
    return await aiRouter.getCostSummary(projectId)
  })

  // GET /api/ai/task-types — 列出所有任务类型映射
  fastify.get('/api/ai/task-types', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await prisma.aiTaskTypeMapping.findMany({
      orderBy: { taskType: 'asc' },
    })
  })

  // GET /api/ai/policies — 列出所有路由策略
  fastify.get('/api/ai/policies', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await prisma.aiRoutingPolicy.findMany({
      orderBy: { isDefault: 'desc' },
    })
  })

  // ==========================================================
  // AI Execute — 模拟完整路由+执行+fallback（mock模式）
  // ==========================================================

  // POST /api/ai/execute — 模拟一次完整的AI路由执行
  fastify.post('/api/ai/execute', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const {
      taskId, projectId, taskType, policyName,
    } = request.body as any
    if (!taskId || !taskType) {
      return reply.status(400).send({ error: 'taskId and taskType required' })
    }

    const result = await aiRouter.execute(
      { taskId, projectId, taskType, policyName },
      async (modelId, modelName, provider) => {
        // mock 模拟延迟 + 随机成功/失败
        const delay = 500 + Math.random() * 2000
        await new Promise(resolve => setTimeout(resolve, delay))

        // 70% 第一次就成功
        const success = modelId === 'exhausted' ? false : Math.random() > 0.1

        return {
          success,
          latency: delay / 1000,
          cost: 0.001 + Math.random() * 0.01,
          tokensInput: Math.floor(Math.random() * 500),
          tokensOutput: Math.floor(Math.random() * 1000),
          error: success ? undefined : 'Simulated failure for testing',
        }
      }
    )

    return result
  })
}
