import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/api-keys.ts — 用户 API Key 管理路由（已迁移到 V2）
 *
 * ⚠️ 前端已迁移到 /api/v2/user/model-config/unified
 * 此路由保留纯为向后兼容，所有操作重定向到 V2 配置。
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { maskKey } from '../services/crypto.service.js'

export default async function apiKeyRoutes(fastify: FastifyInstance) {

  // GET /api/user/api-keys — 从 V2 表读取，兼容旧前端
  fastify.get('/api/user/api-keys', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })

    const keys: any[] = []
    if (v2) {
      const providerMap: Record<string, { cap: string; key: string | null; mdl: string | null }> = {
        llm: { cap: 'llm', key: v2.llmApiKey, mdl: v2.llmModel },
        image: { cap: 'image', key: v2.imageApiKey, mdl: v2.imageModel },
        video: { cap: 'video', key: v2.videoApiKey, mdl: v2.videoModel },
        tts: { cap: 'tts', key: v2.ttsApiKey, mdl: v2.ttsModel },
      }
      for (const [cap, info] of Object.entries(providerMap)) {
        if (info.key) {
          keys.push({
            id: `v2-${cap}`,
            provider: v2[`${cap}Provider` as keyof typeof v2] || '',
            keyName: `${v2[`${cap}Provider` as keyof typeof v2] || 'unknown'}_${cap}`,
            keyValue: maskKey(info.key),
            baseUrl: v2.baseUrl,
            modelType: cap,
            modelName: info.mdl,
            isActive: true,
            configured: true,
            createdAt: v2.createdAt,
            updatedAt: v2.updatedAt,
          })
        }
      }
    }

    return { success: true, keys } satisfies ApiResponse<unknown>
  })

  // POST /api/user/api-keys — 重定向到 V2 写入提示
  fastify.post('/api/user/api-keys', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    return reply.status(400).send({
      success: false,
      error: '此接口已废弃，请使用 /api/v2/user/model-config/unified 保存大模型配置',
    })
  })

  // DELETE /api/user/api-keys — 提示已废弃
  fastify.delete('/api/user/api-keys/:id', { preHandler: [fastify.authenticate] }, async (_request, reply) => {
    return reply.status(400).send({
      success: false,
      error: '此接口已废弃，请使用 /api/v2/user/model-config/unified 管理大模型配置',
    })
  })
}
