import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/api-keys.ts — 用户 API Key 管理路由
 *
 * 功能：
 * - 列出用户已配置的 API Key（keyValue 遮盖显示）
 * - 创建/更新 API Key
 * - 删除 API Key
 * - 查询可用的 providers 和默认 key 状态
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { encryptKey, maskKey } from '../services/crypto.service.js'
import { apiRouter } from '../services/api-router.service.js'

const VALID_PROVIDERS = [
  'volcengine', 'siliconflow', 'deepseek',
  'openai', 'kling', 'replicate', 'aliyun',
]

const VALID_MODEL_TYPES = ['llm', 'image', 'video', 'tts', 'audio']

export default async function apiKeyRoutes(fastify: FastifyInstance) {

  // GET /api/user/api-keys — 列出用户的所有 API Key
  fastify.get('/api/user/api-keys', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const keys = await prisma.userApiKey.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        keyName: true,
        keyValue: true,    // 加密后的值，只用于判断是否已配置
        baseUrl: true,
        modelType: true,
        modelName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    // 遮盖 keyValue 后返回
    const safeKeys = keys.map(k => ({
      ...k,
      keyValue: k.keyValue ? maskKey(k.keyValue) : null,
      configured: !!k.keyValue,
    }))

    return { success: true, keys: safeKeys } satisfies ApiResponse<unknown>;

  })

  // POST /api/user/api-keys — 创建/更新 API Key
  fastify.post('/api/user/api-keys', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { provider, keyName, keyValue, baseUrl, modelType, modelName } = request.body as any

    if (!provider || !keyValue) {
      return reply.status(400).send({ success: false, error: '缺少 provider 或 keyValue' })
    }

    if (!VALID_PROVIDERS.includes(provider)) {
      return reply.status(400).send({
        success: false,
        error: `不支持的 provider: ${provider}，支持: ${VALID_PROVIDERS.join(', ')}`,
      })
    }

    const validTypes = modelType ? VALID_MODEL_TYPES : undefined
    if (modelType && !VALID_MODEL_TYPES.includes(modelType)) {
      return reply.status(400).send({
        success: false,
        error: `不支持的 modelType: ${modelType}，支持: ${VALID_MODEL_TYPES.join(', ')}`,
      })
    }

    // 加密存储
    const encryptedKey = encryptKey(keyValue)

    const key = await prisma.userApiKey.upsert({
      where: {
        userId_provider: { userId, provider },
      },
      update: {
        keyValue: encryptedKey,
        keyName: keyName || provider.toUpperCase() + '_API_KEY',
        baseUrl: baseUrl || null,
        modelType: modelType || detectModelType(provider),
        modelName: modelName || null,
        isActive: true,
      },
      create: {
        userId,
        provider,
        keyValue: encryptedKey,
        keyName: keyName || provider.toUpperCase() + '_API_KEY',
        baseUrl: baseUrl || null,
        modelType: modelType || detectModelType(provider),
        modelName: modelName || null,
        isActive: true,
      },
    })

    return {
      success: true,
      key: {
        id: key.id,
        provider: key.provider,
        keyName: key.keyName,
        configured: true,
        modelType: key.modelType,
        modelName: key.modelName,
      },
    }
  })

  // DELETE /api/user/api-keys/:provider — 删除 API Key
  fastify.delete('/api/user/api-keys/:provider', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { provider } = request.params as any

    await prisma.userApiKey.deleteMany({
      where: { userId, provider },
    })

    return { success: true } satisfies ApiResponse<unknown>;

  })

  // GET /api/user/api-keys/status — 查询用户可用 provider 状态
  fastify.get('/api/user/api-keys/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { memberTier: true },
    })

    const providers = await apiRouter.getAvailableProviders(userId)

    // 判断是否需要提示配置 key
    const needsKey = user?.memberTier !== 'free' && user?.memberTier !== 'basic'
    const hasAnyKey = providers.user.length > 0

    return {
      success: true,
      status: {
        tier: user?.memberTier || 'free',
        hasUserKey: hasAnyKey,
        needsConfig: needsKey && !hasAnyKey,
        userProviders: providers.user,
        platformProviders: providers.platform,
      },
    }
  })
}

function detectModelType(provider: string): string {
  const map: Record<string, string> = {
    siliconflow: 'llm',
    deepseek: 'llm',
    openai: 'llm',
    volcengine: 'image',
    kling: 'video',
    replicate: 'image',
    aliyun: 'tts',
  }
  return map[provider] || 'llm'
}
