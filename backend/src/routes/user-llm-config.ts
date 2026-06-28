/**
 * user-llm-config.ts — 用户模型配置读取 API（精简版）
 *
 * GET /api/user/llm-config
 * 返回用户当前的 LLM 和 Video 模型配置（不含 API Key）
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

const PROVIDER_LABELS: Record<string, string> = {
  volcengine: '火山引擎',
  openai: 'OpenAI',
  moonshot: '月之暗面',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  baidu: '百度文心',
  custom: '自定义',
}

export default async function userLLMConfigRoutes(fastify: FastifyInstance) {
  fastify.get('/api/user/llm-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })

    const data: any = { llm: null, video: null, image: null }

    if (v2) {
      data.llm = {
        provider: v2.llmProvider || '',
        providerLabel: PROVIDER_LABELS[v2.llmProvider as string] || v2.llmProvider || '',
        modelName: v2.llmModel || '',
        enabled: v2.llmEnabled,
      }
      data.video = {
        provider: v2.videoProvider || '',
        providerLabel: PROVIDER_LABELS[v2.videoProvider as string] || v2.videoProvider || '',
        modelName: v2.videoModel || '',
        enabled: v2.videoEnabled,
      }
      data.image = {
        provider: v2.imageProvider || '',
        providerLabel: PROVIDER_LABELS[v2.imageProvider as string] || v2.imageProvider || '',
        modelName: v2.imageModel || '',
        enabled: v2.imageEnabled,
      }
    }

    return { success: true, data }
  })
}
