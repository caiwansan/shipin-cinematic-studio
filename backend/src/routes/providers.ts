/**
 * routes/providers.ts — Provider Verify + Registry API 路由
 *
 * Workstream B: 统一 Provider Verify API
 * Workstream C: Provider Registry 查询
 *
 * ⚠️ 不动 Frozen Core：RuntimeCredential、ModelAdapterRegistry、Worker Runtime
 *
 * Endpoints:
 *   POST /api/providers/verify    — 验证 API Key 有效性
 *   GET  /api/providers            — 列出所有支持的 Provider
 *   GET  /api/providers/:id        — 获取 Provider 详情
 *   GET  /api/providers/:id/health — Provider 健康状态
 *   POST /api/providers/connect    — 保存用户 Provider 配置
 */

import type { FastifyInstance } from 'fastify'
import { providerRegistry } from '../providers/index.js'
import { prisma } from '../utils/index.js'
import { encryptKey } from '../services/crypto.service.js'

export default async function providerRoutes(fastify: FastifyInstance) {
  // ── POST /api/providers/verify ──
  // 统一验证 API Key，支持所有 Provider
  fastify.post('/api/providers/verify', async (request, reply) => {
    const { provider, apiKey, baseURL, model } = request.body as {
      provider: string
      apiKey: string
      baseURL?: string
      model?: string
    }

    if (!provider) {
      return reply.status(400).send({
        success: false,
        error: '请指定 Provider',
        errorCode: 'MISSING_PROVIDER',
      })
    }

    if (!apiKey) {
      return reply.status(400).send({
        success: false,
        error: '请填写 API Key',
        errorCode: 'MISSING_API_KEY',
      })
    }

    // 验证超时：10 秒
    const timeoutPromise = new Promise<any>((resolve) => {
      setTimeout(() => resolve({
        success: false,
        latency: 10000,
        provider,
        availableModels: [],
        capabilities: [],
        defaultModel: '',
        errorCode: 'TIMEOUT',
        errorMessage: `验证超时（10 秒），请检查 baseURL 是否可访问`,
      }), 10000)
    })

    const result = await Promise.race([
      providerRegistry.verify({ provider, apiKey, baseURL, model }),
      timeoutPromise,
    ])

    return reply.send(result)
  })

  // ── GET /api/providers ──
  // 列出所有支持的 Provider 及元数据
  fastify.get('/api/providers', async (_request, reply) => {
    const providers = providerRegistry.listProviders()
    return {
      success: true,
      count: providers.length,
      providers,
    }
  })

  // ── GET /api/providers/:id ──
  // 获取指定 Provider 详情
  fastify.get('/api/providers/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const metadata = providerRegistry.getMetadata(id)

    if (!metadata) {
      return reply.status(404).send({
        success: false,
        error: `不支持的 Provider: ${id}`,
        errorCode: 'UNKNOWN_PROVIDER',
      })
    }

    return { success: true, provider: metadata }
  })

  // ── GET /api/providers/:id/health ──
  // Provider 健康状态
  fastify.get('/api/providers/:id/health', async (request, reply) => {
    const { id } = request.params as { id: string }
    const p = providerRegistry.getProvider(id)

    if (!p) {
      return reply.status(404).send({
        success: false,
        error: `不支持的 Provider: ${id}`,
        errorCode: 'UNKNOWN_PROVIDER',
      })
    }

    const health = await p.health()
    return { success: true, provider: id, health }
  })

  // ── GET /api/providers/models ──
  // 按能力列出模型
  fastify.get('/api/providers/models', async (request, reply) => {
    const { capability } = request.query as { capability?: string }
    const models = providerRegistry.listModels(capability as any)
    return {
      success: true,
      count: models.length,
      models,
    }
  })

  // ── POST /api/providers/connect ──
  // 保存用户 Provider 配置（需要认证）
  fastify.post('/api/providers/connect', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user?.id

    if (!userId) {
      return reply.status(401).send({ success: false, error: '未授权' })
    }

    const { provider, apiKey, model, baseURL, taskType } = request.body as {
      provider: string
      apiKey: string
      model?: string
      baseURL?: string
      taskType?: 'llm' | 'image' | 'video' | 'tts' | 'music'
    }

    if (!provider || !apiKey) {
      return reply.status(400).send({
        success: false,
        error: '请提供 Provider 和 API Key',
        errorCode: 'MISSING_FIELDS',
      })
    }

    // 验证 Provider 是否支持
    const metadata = providerRegistry.getMetadata(provider)
    if (!metadata) {
      return reply.status(400).send({
        success: false,
        error: `不支持的 Provider: ${provider}`,
        errorCode: 'UNKNOWN_PROVIDER',
      })
    }

    // 加密保存
    const encryptedKey = encryptKey(apiKey)

    // 确定任务类型 → 配置字段映射
    const fieldMap: Record<string, { providerField: string; apiKeyField: string; modelField: string; baseUrlField: string }> = {
      llm:   { providerField: 'llmProvider',   apiKeyField: 'llmApiKey',   modelField: 'llmModel',   baseUrlField: 'llmBaseUrl' },
      image: { providerField: 'imageProvider', apiKeyField: 'imageApiKey', modelField: 'imageModel', baseUrlField: 'imageBaseUrl' },
      video: { providerField: 'videoProvider', apiKeyField: 'videoApiKey', modelField: 'videoModel', baseUrlField: 'videoBaseUrl' },
      tts:   { providerField: 'ttsProvider',   apiKeyField: 'ttsApiKey',   modelField: 'ttsModel',   baseUrlField: 'ttsBaseUrl' },
      music: { providerField: 'musicProvider', apiKeyField: 'musicApiKey', modelField: 'musicModel', baseUrlField: 'musicBaseUrl' },
    }

    // 如果没指定 taskType，自动从 Provider 的第一能力推断
    const capabilities = providerRegistry.getProvider(provider)?.capabilities() || []
    const type = taskType || capabilities[0] || 'llm'
    const fields = fieldMap[type]

    if (!fields) {
      return reply.status(400).send({
        success: false,
        error: `不支持的任务类型: ${type}`,
        errorCode: 'UNSUPPORTED_TASK_TYPE',
      })
    }

    // 更新 UserModelConfigV2（无则创建）
    try {
      await prisma.userModelConfigV2.upsert({
        where: { userId },
        create: {
          userId,
          [fields.providerField]: provider,
          [fields.apiKeyField]: encryptedKey,
          [fields.modelField]: model || '',
          [fields.baseUrlField]: baseURL || metadata.baseURL,
        },
        update: {
          [fields.providerField]: provider,
          [fields.apiKeyField]: encryptedKey,
          [fields.modelField]: model || '',
          [fields.baseUrlField]: baseURL || metadata.baseURL,
        },
      })

      return {
        success: true,
        message: `${metadata.name} 配置成功`,
        provider,
        taskType: type,
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: `保存失败: ${err.message}`,
        errorCode: 'SAVE_FAILED',
      })
    }
  })

  // ── GET /api/providers/status ──
  // 查询当前用户的 Provider 配置状态（需要认证）
  fastify.get('/api/providers/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user?.id

    if (!userId) {
      return reply.status(401).send({ success: false, error: '未授权' })
    }

    const config = await prisma.userModelConfigV2.findUnique({
      where: { userId },
    })

    if (!config) {
      return {
        success: true,
        configured: false,
        message: '尚未配置 AI Provider',
        providers: [],
      }
    }

    // 列出已配置的 Provider
    const configuredProviders: Array<{
      provider: string
      taskType: string
      model: string
      configured: boolean
    }> = []

    const checks = [
      { provider: config.llmProvider,   apiKey: config.llmApiKey,   model: config.llmModel,   taskType: 'llm' },
      { provider: config.imageProvider, apiKey: config.imageApiKey, model: config.imageModel, taskType: 'image' },
      { provider: config.videoProvider, apiKey: config.videoApiKey, model: config.videoModel, taskType: 'video' },
      { provider: config.ttsProvider,   apiKey: config.ttsApiKey,   model: config.ttsModel,   taskType: 'tts' },
      { provider: config.musicProvider, apiKey: config.musicApiKey, model: config.musicModel, taskType: 'music' },
    ]

    for (const c of checks) {
      if (c.provider && c.apiKey) {
        configuredProviders.push({
          provider: c.provider,
          taskType: c.taskType,
          model: c.model || '',
          configured: true,
        })
      }
    }

    return {
      success: true,
      configured: configuredProviders.length > 0,
      count: configuredProviders.length,
      providers: configuredProviders,
    }
  })
}
