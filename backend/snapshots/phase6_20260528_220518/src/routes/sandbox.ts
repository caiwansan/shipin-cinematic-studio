import { FastifyInstance } from 'fastify'
import { sandbox } from '../services/ai-sandbox.service.js'
import { prisma } from '../utils/index.js'

export default async function sandboxRoutes(fastify: FastifyInstance) {
  // ==========================================================
  // Circuit Breaker — 熔断器
  // ==========================================================

  // GET /api/sandbox/breakers — 熔断器状态
  fastify.get('/api/sandbox/breakers', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await sandbox.getBreakerStatus()
  })

  // POST /api/sandbox/breakers/:modelName/reset — 重置熔断器
  fastify.post('/api/sandbox/breakers/:modelName/reset', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { modelName } = request.params as any
    return await sandbox.resetBreaker(modelName)
  })

  // ==========================================================
  // Sandbox 执行
  // ==========================================================

  // POST /api/sandbox/execute — 沙箱化模拟调用（带熔断/超时/预算检查）
  fastify.post('/api/sandbox/execute', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskId, projectId, taskType, modelName, requestType, promptPreview, simulateFailure, forceTimeout, timeoutOverride } = request.body as any

    if (!taskId || !taskType || !modelName) {
      return reply.status(400).send({ error: 'taskId, taskType and modelName required' })
    }

    const result = await sandbox.execute(
      {
        taskId,
        projectId,
        taskType,
        modelName,
        requestType: requestType ?? 'chat_completion',
        promptPreview,
        timeoutOverride,
      },
      async (signal) => {
        // 模拟真实API抖动
        const baseLatency = taskType === 'video_gen' ? 3000 :
          taskType === 'character_gen' ? 1500 :
          taskType === 'voiceover' ? 500 : 800

        const jitter = Math.random() * 2000 // 随机抖动
        const delay = forceTimeout ? (forceTimeout + 5000) : (simulateFailure ? 100 : baseLatency + jitter)

        // 检查 AbortSignal（超时场景）
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay)
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            const abortErr = new Error('The operation was aborted')
            abortErr.name = 'AbortError'
            reject(abortErr)
          })
        })

        // 模拟随机失败（~15%）
        if (!simulateFailure && Math.random() < 0.15) {
          const errors = [
            'rate limit exceeded',
            'service temporarily unavailable',
            'model overloaded',
            'internal server error',
          ]
          throw new Error(errors[Math.floor(Math.random() * errors.length)])
        }

        return {
          data: { content: `Simulated ${taskType} response from ${modelName}` },
          latencyMs: delay,
          cost: 0.001 + Math.random() * 0.01,
          tokens: Math.floor(Math.random() * 500 + 100),
          responsePreview: `Simulated ${taskType} response from ${modelName}`,
        }
      }
    )

    return result
  })

  // ==========================================================
  // Timeout 配置
  // ==========================================================

  // GET /api/sandbox/timeouts — 超时配置列表
  fastify.get('/api/sandbox/timeouts', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await prisma.aiTimeoutConfig.findMany({
      orderBy: { taskType: 'asc' },
    })
  })

  // PUT /api/sandbox/timeouts/:taskType — 更新超时配置
  fastify.put('/api/sandbox/timeouts/:taskType', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskType } = request.params as any
    const { timeoutMs, retryCount, retryDelayMs } = request.body as any

    return await prisma.aiTimeoutConfig.upsert({
      where: { taskType },
      create: { taskType, timeoutMs, retryCount, retryDelayMs },
      update: { timeoutMs, retryCount, retryDelayMs },
    })
  })

  // ==========================================================
  // 日志 & 统计
  // ==========================================================

  // GET /api/sandbox/logs — 沙箱调用日志
  fastify.get('/api/sandbox/logs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { limit } = request.query as any
    return await sandbox.getSandboxLogs(limit ? parseInt(limit) : 50)
  })

  // GET /api/sandbox/costs — 成本统计
  fastify.get('/api/sandbox/costs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    return await sandbox.getCostStats()
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "sandbox",
  "mode": "SHADOW"
};

