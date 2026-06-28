import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { encryptKey, decryptKey } from '../services/crypto.service.js'

/**
 * Config System v2 — 单行配置 API
 * 一个用户一行，所有 provider 选择 + API Keys + 模型名集中管理
 */
export default async function userModelConfigV2Routes(fastify: FastifyInstance) {

  // ── 获取 V2 配置 ──
  fastify.get('/api/v2/user/model-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })

    try {
      const cfg = await prisma.userModelConfigV2.findUnique({
        where: { userId },
      })

      if (!cfg) {
        return {
          success: true,
          data: {
            imageProvider: 'volcengine',
            videoProvider: 'volcengine',
            ttsProvider: 'volcengine',
            hasImageApiKey: false,
            hasVideoApiKey: false,
            hasTtsApiKey: false,
            baseUrl: null,
            imageModel: 'wan2.7-image-pro',
            imageEnabled: true,
            videoModel: 'wan2.7-t2v',
            videoEnabled: true,
            ttsModel: 'cosyvoice-v3.5-plus',
            ttsEnabled: true,
            llmProvider: 'volcengine',
            hasLlmApiKey: false,
            llmModel: 'doubao-seed-2-0-plus-260428',
            llmEnabled: true,
          },
        }
      }

      return {
        success: true,
        data: {
          imageProvider: cfg.imageProvider,
          videoProvider: cfg.videoProvider,
          ttsProvider: cfg.ttsProvider,
          hasImageApiKey: !!cfg.imageApiKey,
          hasVideoApiKey: !!cfg.videoApiKey,
          hasTtsApiKey: !!cfg.ttsApiKey,
          baseUrl: cfg.baseUrl,
          imageModel: cfg.imageModel,
          imageEnabled: cfg.imageEnabled,
          videoModel: cfg.videoModel,
          videoEnabled: cfg.videoEnabled,
          ttsModel: cfg.ttsModel,
          ttsEnabled: cfg.ttsEnabled,
          llmProvider: cfg.llmProvider,
          hasLlmApiKey: !!cfg.llmApiKey,
          llmModel: cfg.llmModel,
          llmEnabled: cfg.llmEnabled,
        },
      }
    } catch (err: any) {
      console.error('[UserModelConfigV2] GET error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── 保存 V2 配置（全量覆盖） ──
  fastify.post('/api/v2/user/model-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })

    try {
      const body = request.body as {
        imageProvider?: string
        videoProvider?: string
        ttsProvider?: string
        imageApiKey?: string
        videoApiKey?: string
        ttsApiKey?: string
        llmProvider?: string
        llmApiKey?: string
        baseUrl?: string
        imageModel?: string
        imageEnabled?: boolean
        videoModel?: string
        videoEnabled?: boolean
        ttsModel?: string
        ttsEnabled?: boolean
        llmModel?: string
        llmEnabled?: boolean
      }

      const data: Record<string, any> = {}
      if (body.imageProvider !== undefined) data.imageProvider = body.imageProvider
      if (body.videoProvider !== undefined) data.videoProvider = body.videoProvider
      if (body.ttsProvider !== undefined) data.ttsProvider = body.ttsProvider
      if (body.imageApiKey !== undefined) data.imageApiKey = body.imageApiKey ? encryptKey(body.imageApiKey) : null
      if (body.videoApiKey !== undefined) data.videoApiKey = body.videoApiKey ? encryptKey(body.videoApiKey) : null
      if (body.ttsApiKey !== undefined) data.ttsApiKey = body.ttsApiKey ? encryptKey(body.ttsApiKey) : null
      if (body.llmProvider !== undefined) data.llmProvider = body.llmProvider
      if (body.llmApiKey !== undefined) data.llmApiKey = body.llmApiKey ? encryptKey(body.llmApiKey) : null
      if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl || null
      if (body.imageModel !== undefined) data.imageModel = body.imageModel
      if (body.imageEnabled !== undefined) data.imageEnabled = body.imageEnabled
      if (body.videoModel !== undefined) data.videoModel = body.videoModel
      if (body.videoEnabled !== undefined) data.videoEnabled = body.videoEnabled
      if (body.ttsModel !== undefined) data.ttsModel = body.ttsModel
      if (body.ttsEnabled !== undefined) data.ttsEnabled = body.ttsEnabled
      if (body.llmModel !== undefined) data.llmModel = body.llmModel
      if (body.llmEnabled !== undefined) data.llmEnabled = body.llmEnabled

      const cfg = await prisma.userModelConfigV2.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          imageProvider: body.imageProvider || 'volcengine',
          videoProvider: body.videoProvider || 'volcengine',
          ttsProvider: body.ttsProvider || 'volcengine',
          imageApiKey: body.imageApiKey ? encryptKey(body.imageApiKey) : null,
          videoApiKey: body.videoApiKey ? encryptKey(body.videoApiKey) : null,
          ttsApiKey: body.ttsApiKey ? encryptKey(body.ttsApiKey) : null,
          llmProvider: body.llmProvider || 'volcengine',
          llmApiKey: body.llmApiKey ? encryptKey(body.llmApiKey) : null,
          baseUrl: body.baseUrl || null,
          imageModel: body.imageModel || 'wan2.7-image-pro',
          imageEnabled: body.imageEnabled ?? true,
          videoModel: body.videoModel || 'wan2.7-t2v',
          videoEnabled: body.videoEnabled ?? true,
          ttsModel: body.ttsModel || 'cosyvoice-v3.5-plus',
          ttsEnabled: body.ttsEnabled ?? true,
          llmModel: body.llmModel || 'doubao-seed-2-0-plus-260428',
          llmEnabled: body.llmEnabled ?? true,
        },
      })

      // 同步写 V1 表（向下兼容，ai-tasks 降级路径/其他读 v1 的代码仍能获取最新数据）
      // V1 表按 provider 分行，需要写 3 行：siliconflow/aliyun/volcengine 中实际使用的
      // 只同步有 Key 的 provider
      const v1Providers: { provider: string; apiKey: string | null; model: string; modelField: string; providerField: string }[] = [
        { provider: body.imageProvider || cfg.imageProvider, apiKey: body.imageApiKey || null, model: cfg.imageModel || 'wan2.7-image-pro', modelField: 'imageModel', providerField: 'imageProvider' },
        { provider: body.videoProvider || cfg.videoProvider, apiKey: body.videoApiKey || null, model: cfg.videoModel || 'wan2.7-t2v', modelField: 'videoModel', providerField: 'videoProvider' },
        { provider: body.ttsProvider || cfg.ttsProvider,     apiKey: body.ttsApiKey || null,   model: cfg.ttsModel || 'cosyvoice-v3.5-plus', modelField: 'ttsModel', providerField: 'ttsProvider' },
        { provider: body.llmProvider || cfg.llmProvider,     apiKey: body.llmApiKey || null,   model: cfg.llmModel || 'doubao-seed-2-0-plus-260428', modelField: 'llmModel', providerField: 'llmProvider' },
      ]
      for (const v1p of v1Providers) {
        if (!v1p.provider || !v1p.apiKey) continue
        const v1Key = encryptKey(v1p.apiKey)
        await prisma.userModelConfig.upsert({
          where: { userId_provider: { userId, provider: v1p.provider } },
          update: {
            apiKey: v1Key,
            [v1p.modelField]: v1p.model,
            [v1p.providerField]: v1p.provider,
            [`${v1p.modelField}`.replace('Model', 'Enabled')]: true,
          },
          create: {
            userId,
            provider: v1p.provider,
            apiKey: v1Key,
            [v1p.modelField]: v1p.model,
            [v1p.providerField]: v1p.provider,
            [`${v1p.modelField}`.replace('Model', 'Enabled')]: true,
          },
        }).catch((e: any) => console.warn(`[V2→V1] 同步 ${v1p.provider} 失败:`, e.message))
      }

      return {
        success: true,
        data: {
          imageProvider: cfg.imageProvider,
          videoProvider: cfg.videoProvider,
          ttsProvider: cfg.ttsProvider,
          hasImageApiKey: !!cfg.imageApiKey,
          hasVideoApiKey: !!cfg.videoApiKey,
          hasTtsApiKey: !!cfg.ttsApiKey,
          baseUrl: cfg.baseUrl,
          imageModel: cfg.imageModel,
          imageEnabled: cfg.imageEnabled,
          videoModel: cfg.videoModel,
          videoEnabled: cfg.videoEnabled,
          ttsModel: cfg.ttsModel,
          ttsEnabled: cfg.ttsEnabled,
        },
      }
    } catch (err: any) {
      console.error('[UserModelConfigV2] POST error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── provider-map (v2) ── 确定性读取，无竞争无排序 ──
  fastify.get('/api/v2/user/model-config/provider-map', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })

    try {
      const cfg = await prisma.userModelConfigV2.findUnique({
        where: { userId },
        select: { imageProvider: true, videoProvider: true, ttsProvider: true, llmProvider: true },
      })

      return {
        success: true,
        data: {
          image: cfg?.imageProvider || '',
          video: cfg?.videoProvider || '',
          tts: cfg?.ttsProvider || '',
          llm: cfg?.llmProvider || '',
        },
      }
    } catch (err: any) {
      console.error('[UserModelConfigV2] provider-map GET error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ── provider-map POST (v2) ── 更新 V2 表的 provider 选择字段 ──
  // 前端 saveProviderMap 在下拉切换时触发，需真实写入 DB 以保持一致性
  fastify.post('/api/v2/user/model-config/provider-map', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })

    try {
      const body = request.body as Record<string, string>
      const updateData: Record<string, string> = {}

      // 前端发来的格式: { imageProvider: 'volcengine', videoProvider: 'volcengine', ttsProvider: 'volcengine' }
      for (const key of ['imageProvider', 'videoProvider', 'ttsProvider', 'llmProvider']) {
        if (body[key]) updateData[key] = body[key]
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.userModelConfigV2.upsert({
          where: { userId },
          update: updateData,
          create: {
            userId,
            ...updateData,
          },
        })
      }

      return { success: true } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      console.error('[UserModelConfigV2] provider-map POST error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
