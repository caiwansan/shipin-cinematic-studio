/**
 * capability-llm-config.ts — 统一能力级 LLM 配置 API
 * Sprint-07A.2-AI-03: 统一个人模型设置中心
 *
 * GET  /api/capability/llm/config/:capability — 读取指定能力的 LLM 配置
 * PUT  /api/capability/llm/config/:capability — 保存指定能力的 LLM 配置
 * GET  /api/capability/llm/config — 读取所有能力的 LLM 配置
 *
 * 数据模型：UserModelConfigV2.capabilityLlmConfigs (JSONB)
 * 能力：music
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

const ALLOWED_CAPABILITIES = ['music']
const ALLOWED_PROVIDERS = ['deepseek', 'openai', 'volcengine', 'aliyun', 'qwen', 'moonshot', 'zhipu']

interface CapabilityLlmConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  enabled?: boolean
}

function getCapabilityConfig(v2: any, capability: string): CapabilityLlmConfig | null {
  const configs = v2?.capabilityLlmConfigs as Record<string, CapabilityLlmConfig> | null
  return configs?.[capability] || null
}

function sanitizeConfig(config: CapabilityLlmConfig): any {
  // 不返回 API Key，仅返回 hasApiKey 状态
  return {
    provider: config.provider,
    providerName: PROVIDER_LABELS[config.provider] || config.provider,
    model: config.model,
    baseUrl: config.baseUrl || '',
    enabled: config.enabled !== false,
    hasApiKey: !!config.apiKey,
  }
}

export async function capabilityLlmConfigRoutes(fastify: FastifyInstance) {

  // GET — 读取所有能力的 LLM 配置
  fastify.get('/api/capability/llm/config', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    }

    try {
      const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
      const configs = (v2?.capabilityLlmConfigs as Record<string, CapabilityLlmConfig>) || {}

      const result: Record<string, any> = {}
      for (const cap of ALLOWED_CAPABILITIES) {
        const cfg = configs[cap]
        result[cap] = cfg ? sanitizeConfig(cfg) : null
      }

      return { success: true, configs: result }
    } catch (e: any) {
      return reply.code(500).send({ success: false, error: e.message })
    }
  })

  // GET — 读取指定能力的 LLM 配置
  fastify.get('/api/capability/llm/config/:capability', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    }

    const { capability } = request.params as { capability: string }
    if (!ALLOWED_CAPABILITIES.includes(capability)) {
      return reply.code(400).send({ success: false, error: '不支持的能力类型' })
    }

    try {
      const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
      const config = getCapabilityConfig(v2, capability)
      if (!config) {
        return { success: true, config: null }
      }

      return { success: true, config: sanitizeConfig(config) }
    } catch (e: any) {
      return reply.code(500).send({ success: false, error: e.message })
    }
  })

  // PUT — 保存指定能力的 LLM 配置
  fastify.put<{
    Params: { capability: string }
    Body: {
      provider: string
      model: string
      apiKey?: string
      baseUrl?: string
      enabled?: boolean
    }
  }>('/api/capability/llm/config/:capability', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    }

    const { capability } = request.params as { capability: string }
    if (!ALLOWED_CAPABILITIES.includes(capability)) {
      return reply.code(400).send({ success: false, error: '不支持的能力类型' })
    }

    const { provider, model, apiKey, baseUrl, enabled } = request.body

    if (!provider || !model) {
      return reply.code(400).send({ success: false, error: '请填写供应商和模型名称' })
    }

    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return reply.code(400).send({ success: false, error: '不支持的供应商' })
    }

    try {
      // 读取现有配置
      const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
      const existingConfigs = ((v2?.capabilityLlmConfigs as Record<string, CapabilityLlmConfig>) || {})
      const existingConfig = existingConfigs[capability] || {}

      // 合并配置（API Key 仅在提供时更新）
      const newConfig: CapabilityLlmConfig = {
        provider,
        model,
        apiKey: apiKey || existingConfig.apiKey || undefined,
        baseUrl: baseUrl || existingConfig.baseUrl || undefined,
        enabled: enabled !== undefined ? enabled : (existingConfig.enabled !== false),
      }

      const newConfigs = { ...existingConfigs, [capability]: newConfig }

      await prisma.userModelConfigV2.upsert({
        where: { userId },
        create: {
          userId,
          capabilityLlmConfigs: newConfigs as any,
        },
        update: {
          capabilityLlmConfigs: newConfigs as any,
        },
      })

      return { success: true, config: sanitizeConfig(newConfig) }
    } catch (e: any) {
      return reply.code(500).send({ success: false, error: e.message })
    }
  })

  // DELETE — 移除指定能力的 LLM 配置
  fastify.delete('/api/capability/llm/config/:capability', { preHandler: fastify.authenticate }, async (request, reply) => {
    const userId = (request as any).user?.id
    if (!userId) {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
    }

    const { capability } = request.params as { capability: string }
    if (!ALLOWED_CAPABILITIES.includes(capability)) {
      return reply.code(400).send({ success: false, error: '不支持的能力类型' })
    }

    try {
      const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
      const existingConfigs = { ...((v2?.capabilityLlmConfigs as Record<string, CapabilityLlmConfig>) || {}) }
      delete existingConfigs[capability]

      await prisma.userModelConfigV2.update({
        where: { userId },
        data: { capabilityLlmConfigs: existingConfigs as any },
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
