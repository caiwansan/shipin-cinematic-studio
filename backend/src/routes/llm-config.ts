/**
 * LLM Config Routes — Sprint-03C Frontend Reality Integration
 * 
 * Endpoints:
 *   POST /api/enterprise/llm-config/test  — 测试 LLM 配置是否可用
 *   GET  /api/enterprise/llm-config/status — 获取 LLM 配置状态
 *   GET  /api/enterprise/agent-status      — 获取企业 Agent 真实状态
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { callLLM } from '../services/hdz/llm.client'

export async function llmConfigRoutes(app: FastifyInstance) {
  const prisma = new PrismaClient()

  // 所有接口都需要 JWT 认证
  app.addHook('preHandler', app.authenticate)

  /**
   * POST /api/enterprise/llm-config/test
   * 测试 LLM 配置是否可用
   */
  app.post<{
    Body: {
      provider?: string
      modelName?: string
      apiKey?: string
      baseUrl?: string
    }
  }>('/api/enterprise/llm-config/test', async (request, reply) => {
    const { provider, modelName, apiKey, baseUrl } = request.body as any

    if (!provider || !modelName || !apiKey) {
      return reply.code(400).send({
        success: false,
        error: 'MISSING_PARAMS',
        message: 'provider, modelName, apiKey 必填',
      })
    }

    try {
      // 发送测试请求
      const result = await callLLM({
        provider,
        modelName,
        apiKey,
        baseUrl: baseUrl || getDefaultBaseUrl(provider),
        systemPrompt: 'You are a test assistant.',
        prompt: 'Reply with: OK',
        maxTokens: 10,
      })

      if (result && result.content) {
        return reply.send({
          success: true,
          provider,
          modelName,
          message: 'LLM 配置正常',
          sample: result.content.slice(0, 50),
        })
      } else {
        return reply.send({
          success: false,
          provider,
          modelName,
          error: 'EMPTY_RESPONSE',
          message: 'LLM 返回空响应',
        })
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error'
      const isAuthError = errorMsg.includes('401') || errorMsg.includes('Authentication') || errorMsg.includes('invalid')
      
      return reply.send({
        success: false,
        provider,
        modelName,
        error: isAuthError ? 'AUTH_FAILED' : 'CONNECTION_ERROR',
        message: isAuthError ? 'API Key 无效或已过期' : `连接失败: ${errorMsg.slice(0, 100)}`,
      })
    }
  })

  /**
   * GET /api/enterprise/llm-config/status
   * 获取当前租户的 LLM 配置状态（不暴露 Key）
   */
  app.get('/api/enterprise/llm-config/status', async (request, reply) => {
    const user = request.user as any
    const userId = user?.id

    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' })
    }

    try {
      // 查找用户的企业
      const member = await (prisma as any).enterpriseMember.findFirst({
        where: { userId },
        select: { organizationId: true },
      })

      const tenantId = member?.organizationId || userId

      const configs = await (prisma as any).enterpriseLlmConfig.findMany({
        where: { tenantId },
        select: {
          id: true,
          provider: true,
          modelName: true,
          status: true,
          enabled: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      return reply.send({
        hasConfig: configs.length > 0,
        configs: configs.map((c: any) => ({
          ...c,
          // 不暴露 apiKey，只显示前缀
          hasKey: true,
        })),
      })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  /**
   * GET /api/enterprise/agent-status
   * 获取企业 Agent 真实状态（用于前端展示）
   */
  app.get('/api/enterprise/agent-status', async (request, reply) => {
    const user = request.user as any
    const userId = user?.id

    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' })
    }

    try {
      // 查找用户的企业
      const member = await (prisma as any).enterpriseMember.findFirst({
        where: { userId },
        select: { organizationId: true },
      })

      const tenantId = member?.organizationId || userId

      // 获取 Agent Instances
      const instances = await (prisma as any).enterpriseAgentInstance.findMany({
        where: { tenantId },
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              agentType: true,
              status: true,
              capabilities: true,
            },
          },
          tasks: {
            select: {
              id: true,
              taskType: true,
              status: true,
              startedAt: true,
              completedAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      // 统计
      const totalTasks = await (prisma as any).enterpriseAgentTask.count({
        where: { tenantId },
      })
      const completedTasks = await (prisma as any).enterpriseAgentTask.count({
        where: { tenantId, status: 'completed' },
      })
      const failedTasks = await (prisma as any).enterpriseAgentTask.count({
        where: { tenantId, status: 'failed' },
      })

      return reply.send({
        hasAgents: instances.length > 0,
        stats: {
          total: instances.length,
          active: instances.filter((i: any) => i.runtimeStatus === 'active').length,
          paused: instances.filter((i: any) => i.runtimeStatus === 'paused').length,
          totalTasks,
          completedTasks,
          failedTasks,
        },
        agents: instances.map((i: any) => ({
          id: i.id,
          name: i.profile?.name || i.agentId,
          type: i.profile?.agentType || 'unknown',
          status: i.runtimeStatus || i.lifecycleState?.toLowerCase() || 'unknown',
          capabilities: i.profile?.capabilities ? JSON.parse(i.profile.capabilities) : [],
          recentTasks: i.tasks,
        })),
      })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })
}

function getDefaultBaseUrl(provider: string): string {
  const map: Record<string, string> = {
    deepseek: 'https://api.deepseek.com',
    openai: 'https://api.openai.com',
    volcengine: 'https://open.volcengineapi.com',
    aliyun: 'https://dashscope.aliyuncs.com',
  }
  return map[provider] || 'https://api.deepseek.com'
}
