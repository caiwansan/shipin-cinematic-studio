import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/user-api-keys.ts — 用户个人接入的大模型 API Key 管理
 *
 * 免费用户：可接入标准大模型 API，每天免费生成 3 次
 * VIP 会员：无限制，且可接入本地大模型
 *
 * GET    /api/v1/user/api-keys           — 获取当前用户的所有 API Key
 * POST   /api/v1/user/api-keys           — 新增/更新 API Key
 * DELETE /api/v1/user/api-keys/:id       — 删除 API Key
 * PUT    /api/v1/user/api-keys/:id       — 切换启用/停用
 * GET    /api/v1/user/api-keys/available — 获取当前可用的 provider + model 选项
 * GET    /api/v1/user/api-keys/daily     — 获取今日配额使用情况
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getDailyUsage } from '../services/usage-quota.service.js'
import { encryptKey, decryptKey, maskKey } from '../services/crypto.service.js'

// 标准 provider（免费用户 & VIP 都可用）
const STANDARD_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', types: ['llm', 'image'], models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', '自定义'] },
  { value: 'deepseek', label: 'DeepSeek', types: ['llm'], models: ['deepseek-chat', 'deepseek-reasoner', '自定义'] },
  { value: 'siliconflow', label: '硅基流动', types: ['llm', 'image', 'tts'], models: ['自定义'] },
  { value: 'volcengine', label: '火山引擎', types: ['llm', 'image', 'video', 'tts'], models: ['doubao-seed-2-0-mini', 'doubao-seedream-4-5', '自定义'] },
  { value: 'anthropic', label: 'Anthropic Claude', types: ['llm'], models: ['claude-3-5-sonnet', 'claude-3-haiku', '自定义'] },
  { value: 'google', label: 'Google Gemini', types: ['llm'], models: ['gemini-2-5-pro', 'gemini-2-0-flash', '自定义'] },
  { value: 'moonshot', label: '月之暗面 Kimi', types: ['llm'], models: ['moonshot-v1', '自定义'] },
  { value: 'aliyun', label: '阿里通义千问', types: ['llm', 'image', 'video', 'tts'], models: ['qwen-max', 'qwen-plus', '自定义'] },
  { value: 'baidu', label: '百度文心一言', types: ['llm', 'image'], models: ['ernie-4-5', '自定义'] },
]

// 本地大模型（仅 VIP）
const LOCAL_PROVIDERS = [
  { value: 'local', label: '本地大模型（VIP 专属）', types: ['llm', 'image'], models: ['Ollama', 'vLLM', '自定义'], vipOnly: true },
]

const MODEL_TYPE_OPTIONS = [
  { value: 'llm', label: '语言大模型' },
  { value: 'image', label: '图片大模型' },
  { value: 'video', label: '视频大模型' },
  { value: 'tts', label: '语音大模型' },
  { value: 'audio', label: '音频大模型' },
]

export default async function userApiKeyRoutes(fastify: FastifyInstance) {
  // GET 可用 provider 选项（传入 VIP 状态过滤本地大模型）
  fastify.post('/api/v1/user/api-keys/available', async (request) => {
    const body = request.body as any
    const isVip = body?.isVip === true
    return {
      success: true,
      providers: isVip ? [...STANDARD_PROVIDERS, ...LOCAL_PROVIDERS] : STANDARD_PROVIDERS,
      modelTypes: MODEL_TYPE_OPTIONS,
    }
  })

  // GET（query 兼容）
  fastify.get('/api/v1/user/api-keys/available', async (request) => {
    const query = request.query as any
    const isVip = query?.vip === 'true' || query?.isVip === 'true'
    return {
      success: true,
      providers: isVip ? [...STANDARD_PROVIDERS, ...LOCAL_PROVIDERS] : STANDARD_PROVIDERS,
      modelTypes: MODEL_TYPE_OPTIONS,
    }
  })

  // GET 用户的 API Key 列表
  fastify.get('/api/v1/user/api-keys', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id
    const userRecord = await prisma.user.findUnique({ where: { id: userId } })
    const isVip = userRecord && userRecord.memberTier !== 'free' && userRecord.memberTier !== 'basic'

    const keys = await prisma.userApiKey.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })

    return {
      success: true,
      isVip,
      keys: keys.map(k => ({
        ...k,
        keyValue: maskKey(k.keyValue),
      })),
    }
  })

  // POST 新增/更新
  fastify.post('/api/v1/user/api-keys', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const userId = user.id

    const userRecord = await prisma.user.findUnique({ where: { id: userId } })
    const isVip = userRecord && userRecord.memberTier !== 'free' && userRecord.memberTier !== 'basic'

    const { provider, keyName, keyValue, baseUrl, modelType, modelName } = request.body as any

    if (!provider || !keyValue || !modelType) {
      return reply.status(400).send({ success: false, error: 'provider, keyValue, modelType 为必填' })
    }

    // 本地大模型需要 VIP
    if (provider === 'local' && !isVip) {
      return reply.status(403).send({ success: false, error: '接入本地大模型需要开通 VIP 会员' })
    }

    const encryptedKey = encryptKey(keyValue)

    const saved = await prisma.userApiKey.upsert({
      where: { userId_provider: { userId, provider } },
      update: {
        keyName: keyName || provider.toUpperCase() + '_API_KEY',
        keyValue: encryptedKey, baseUrl, modelType, modelName, isActive: true,
      },
      create: {
        userId, provider,
        keyName: keyName || provider.toUpperCase() + '_API_KEY',
        keyValue: encryptedKey, baseUrl, modelType, modelName, isActive: true,
      },
    })

    console.log(`[UserKeys] User ${userId?.substring(0, 8)}... saved key for ${provider} (${modelType})${provider === 'local' ? ' — VIP only' : ''}`)
    return {
      success: true,
      key: {
        ...saved,
        keyValue: maskKey(keyValue),
      },
    }
  })

  // DELETE 删除
  fastify.delete('/api/v1/user/api-keys/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const record = await prisma.userApiKey.findFirst({ where: { id, userId: user.id } })
    if (!record) return reply.status(404).send({ success: false, error: 'Key 不存在' })
    await prisma.userApiKey.delete({ where: { id } })
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // PUT 启用/停用
  fastify.put('/api/v1/user/api-keys/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const { isActive } = request.body as any
    const record = await prisma.userApiKey.findFirst({ where: { id, userId: user.id } })
    if (!record) return reply.status(404).send({ success: false, error: 'Key 不存在' })
    const updated = await prisma.userApiKey.update({
      where: { id },
      data: { isActive: isActive ?? !record.isActive },
    })
    return {
      success: true,
      key: {
        ...updated,
        keyValue: maskKey(updated.keyValue),
      },
    }
  })

  // GET 今日配额
  fastify.get('/api/v1/user/api-keys/daily', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const usage = await getDailyUsage(user.id)
    return { success: true, usage } satisfies ApiResponse<unknown>;

  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

