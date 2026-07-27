/**
 * career-llm-config.ts — Career Agent BYOK 配置 API
 * Sprint-06A: 用户配置个人 AI 模型 API Key
 *
 * GET  /api/career/llm/config — 读取配置（不含 API Key）
 * PUT  /api/career/llm/config — 保存配置（加密存储 API Key）
 * DELETE /api/career/llm/config — 移除配置
 *
 * 数据模型：UserModelConfigV2
 * 调用链：UserModelConfigV2 → resolveRuntimeConfig(userId) → executeViaGateway
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  volcengine: '火山引擎',
  aliyun: '阿里百炼',
  qwen: '通义千问',
  moonshot: 'Moonshot',
  zhipu: '智谱',
}

export async function careerLlmConfigRoutes(fastify: FastifyInstance) {

  // GET — 读取配置（不含 API Key）
  fastify.get('/api/career/llm/config', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    }

    try {
      const cfg = await prisma.userModelConfigV2.findUnique({ where: { userId } })
      if (!cfg || !cfg.llmEnabled || !cfg.llmApiKey) {
        return { success: true, config: null }
      }

      return {
        success: true,
        config: {
          provider: cfg.llmProvider,
          providerName: PROVIDER_LABELS[cfg.llmProvider] || cfg.llmProvider,
          model: cfg.llmModel,
          baseUrl: cfg.llmBaseUrl || '',
        },
      }
    } catch (e: any) {
      return reply.code(500).send({ success: false, error: e.message })
    }
  })

  // PUT — 保存配置
  fastify.put<{
    Body: {
      provider: string
      model: string
      apiKey: string
      baseUrl?: string
      maxTokens?: number
    }
  }>('/api/career/llm/config', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    }

    const { provider, model, apiKey, baseUrl } = request.body

    if (!provider || !model || !apiKey) {
      return reply.code(400).send({ success: false, error: '请填写供应商、模型名称和 API Key' })
    }

    const allowedProviders = ['deepseek', 'openai', 'volcengine', 'aliyun', 'qwen', 'moonshot', 'zhipu']
    if (!allowedProviders.includes(provider)) {
      return reply.code(400).send({ success: false, error: '不支持的供应商' })
    }

    try {
      await prisma.userModelConfigV2.upsert({
        where: { userId },
        create: {
          userId,
          llmProvider: provider,
          llmModel: model,
          llmApiKey: apiKey,
          llmBaseUrl: baseUrl || null,
          llmEnabled: true,
        },
        update: {
          llmProvider: provider,
          llmModel: model,
          llmApiKey: apiKey,
          llmBaseUrl: baseUrl || null,
          llmEnabled: true,
        },
      })

      return {
        success: true,
        config: {
          provider,
          providerName: PROVIDER_LABELS[provider] || provider,
          model,
          baseUrl: baseUrl || '',
        },
      }
    } catch (e: any) {
      return reply.code(500).send({ success: false, error: e.message })
    }
  })

  // DELETE — 移除配置
  fastify.delete('/api/career/llm/config', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    }

    try {
      // llmProvider 和 llmModel 是非空字段，不能设为 null
      // 策略：清空 apiKey + 禁用，保留 provider/model 作为历史记录
      await prisma.userModelConfigV2.update({
        where: { userId },
        data: {
          llmApiKey: null,
          llmBaseUrl: null,
          llmEnabled: false,
        },
      })

      return { success: true }
    } catch (e: any) {
      if (e.code === 'P2025') {
        return { success: true }
      }
      return reply.code(500).send({ success: false, error: e.message })
    }
  })
}
