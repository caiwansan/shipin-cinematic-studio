import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { encryptKey, decryptKey } from '../services/crypto.service.js'

export default async function userModelConfigRoutes(fastify: FastifyInstance) {
  // ── 创建/更新用户大模型配置（upsert by userId+provider） ──
  fastify.post('/api/user/model-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.status(401).send({ success: false, error: '未授权' })
    }

    try {
      const body = request.body as {
        provider?: string
        apiKey?: string
        baseUrl?: string
        llmModel?: string
        llmEnabled?: boolean
        imageModel?: string
        imageEnabled?: boolean
        videoModel?: string
        videoEnabled?: boolean
        ttsModel?: string
        ttsEnabled?: boolean
        llmProvider?: string
        imageProvider?: string
        videoProvider?: string
        ttsProvider?: string
      }

      const provider = body.provider || 'aliyun'

      // 准备更新数据
      const updateData: Record<string, any> = {}
      if (body.baseUrl !== undefined) updateData.baseUrl = body.baseUrl
      if (body.llmModel !== undefined) updateData.llmModel = body.llmModel
      if (body.llmEnabled !== undefined) updateData.llmEnabled = body.llmEnabled
      if (body.imageModel !== undefined) updateData.imageModel = body.imageModel
      if (body.imageEnabled !== undefined) updateData.imageEnabled = body.imageEnabled
      if (body.videoModel !== undefined) updateData.videoModel = body.videoModel
      if (body.videoEnabled !== undefined) updateData.videoEnabled = body.videoEnabled
      if (body.ttsModel !== undefined) updateData.ttsModel = body.ttsModel
      if (body.ttsEnabled !== undefined) updateData.ttsEnabled = body.ttsEnabled
      if (body.llmProvider !== undefined) updateData.llmProvider = body.llmProvider
      if (body.imageProvider !== undefined) updateData.imageProvider = body.imageProvider
      if (body.videoProvider !== undefined) updateData.videoProvider = body.videoProvider
      if (body.ttsProvider !== undefined) updateData.ttsProvider = body.ttsProvider

      // API Key 加密存储（通用 Key）
      if (body.apiKey !== undefined && body.apiKey !== '') {
        updateData.apiKey = encryptKey(body.apiKey)
      }
      // 图片专用 Key
      if (body.imageApiKey !== undefined && body.imageApiKey !== '') {
        updateData.imageApiKey = encryptKey(body.imageApiKey)
      }
      // 视频专用 Key
      if (body.videoApiKey !== undefined && body.videoApiKey !== '') {
        updateData.videoApiKey = encryptKey(body.videoApiKey)
      }

      // 根据不同 provider 设置默认模型名
      const defaults: Record<string, { llm: string; image: string; video: string; tts: string }> = {
        aliyun:     { llm: 'qwen3.6-max-preview', image: 'wan2.7-image-pro', video: 'wan2.7-t2v', tts: 'cosyvoice-v3.5-plus' },
        volcengine: { llm: 'doubao-seed-2-0-mini-260428', image: 'doubao-seedream-5-0-260501', video: 'doubao-seedance-2-0-pro-260510', tts: 'doubao-tts-1' },
        deepseek:   { llm: 'deepseek-chat', image: '', video: '', tts: '' },
        openai:     { llm: 'gpt-4o', image: 'dall-e-3', video: '', tts: '' },
        custom:     { llm: '', image: '', video: '', tts: '' },  // 本地大模型无默认模型
      }
      const defs = defaults[provider as keyof typeof defaults] || defaults.aliyun

      const config = await prisma.userModelConfig.upsert({
        where: {
          userId_provider: { userId, provider },
        },
        update: updateData,
        create: {
          userId,
          provider,
          apiKey: updateData.apiKey || null,
          baseUrl: body.baseUrl || null,
          llmModel: body.llmModel || defs.llm || 'qwen3.6-max-preview',
          llmEnabled: body.llmEnabled ?? true,
          imageModel: body.imageModel || defs.image || 'wan2.7-image-pro',
          imageEnabled: body.imageEnabled ?? true,
          videoModel: body.videoModel || defs.video || 'wan2.7-t2v',
          videoEnabled: body.videoEnabled ?? true,
          ttsModel: body.ttsModel || defs.tts || 'cosyvoice-v3.5-plus',
          ttsEnabled: body.ttsEnabled ?? true,
        },
      })

      // ⭐ 如果启用 LLM，自动设为当前用户的活跃 LLM 配置
      // 仅当没有 activeLlmConfigId 或新配置是显式更新时切换
      // 避免覆盖用户已通过前端切换的 provider
      const shouldSetActive = config.llmEnabled && (config.apiKey || config.imageApiKey || config.videoApiKey)
      if (shouldSetActive) {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { activeLlmConfigId: true },
        })
        // 如果用户没有 active 配置，或者本次 POST 的 provider 就是用户当前的 active provider，才切换
        const currentActiveConfig = currentUser?.activeLlmConfigId
          ? await prisma.userModelConfig.findUnique({ where: { id: currentUser.activeLlmConfigId } })
          : null
        // 没有 active 或者当前 active 的 provider 和本次一致时才切
        if (!currentActiveConfig || currentActiveConfig.provider === provider) {
          await prisma.user.update({
            where: { id: userId },
            data: { activeLlmConfigId: config.id },
          })
          console.log(`[UserModelConfig] ✅ 用户 ${userId.substring(0,8)} 活跃 LLM 配置已设为 ${provider}/${config.llmModel}`)
        }
      }

      return {
        success: true,
        data: {
          id: config.id,
          provider: config.provider,
          // 不返回加密后的 apiKey，只返回是否已配置
          hasApiKey: !!(config.apiKey || config.imageApiKey || config.videoApiKey),
          baseUrl: config.baseUrl,
          llmModel: config.llmModel,
          llmEnabled: config.llmEnabled,
          imageModel: config.imageModel,
          imageEnabled: config.imageEnabled,
          videoModel: config.videoModel,
          videoEnabled: config.videoEnabled,
          ttsModel: config.ttsModel,
          ttsEnabled: config.ttsEnabled,
        },
      }
    } catch (err: any) {
      console.error('[UserModelConfig] Upsert error:', err)
      return reply.status(500).send({ success: false, error: err.message || '保存配置失败' })
    }
  })

  // ── 获取当前用户的配置 ──
  fastify.get('/api/user/model-config', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.status(401).send({ success: false, error: '未授权' })
    }

    try {
      // 优先根据 activeLlmConfigId 获取用户实际使用的配置
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeLlmConfigId: true },
      })

      let provider = (request.query as any)?.provider

      if (user?.activeLlmConfigId && !provider) {
        // 根据 active config 查 provider
        const activeConfig = await prisma.userModelConfig.findUnique({
          where: { id: user.activeLlmConfigId },
          select: { provider: true },
        })
        if (activeConfig) {
          provider = activeConfig.provider
        }
      }

      provider = provider || 'aliyun'

      // 根据不同 provider 设置默认值
      const providerDefaults: Record<string, { llm: string; image: string; video: string; tts: string }> = {
        aliyun:     { llm: 'qwen3.6-max-preview', image: 'wan2.7-image-pro', video: 'wan2.7-t2v', tts: 'cosyvoice-v3.5-plus' },
        volcengine: { llm: 'doubao-seed-2-0-mini-260428', image: 'doubao-seedream-5-0-260501', video: 'doubao-seedance-2-0-pro-260510', tts: 'doubao-tts-1' },
        deepseek:   { llm: 'deepseek-chat', image: '', video: '', tts: '' },
        openai:     { llm: 'gpt-4o', image: 'dall-e-3', video: '', tts: '' },
        custom:     { llm: '', image: '', video: '', tts: '' },
      }
      const def = providerDefaults[provider as keyof typeof providerDefaults] || providerDefaults.aliyun

      const config = await prisma.userModelConfig.findUnique({
        where: {
          userId_provider: { userId, provider },
        },
      })

            console.log('[ModelConfig] GET result:', config ? 'found hasKey=' + !!config.apiKey : 'not found')

      if (!config) {
        // 返回默认配置
        return {
          success: true,
          data: {
            provider,
            hasApiKey: false,
            baseUrl: null,
            llmModel: 'qwen3.6-max-preview',
            llmEnabled: true,
            imageModel: 'wan2.7-image-pro',
            imageEnabled: true,
            videoModel: 'wan2.7-t2v',
            videoEnabled: true,
            ttsModel: 'cosyvoice-v3.5-plus',
            ttsEnabled: true,
          },
        }
      }

      return {
        success: true,
        data: {
          id: config.id,
          provider: config.provider,
          hasApiKey: !!(config.apiKey || config.imageApiKey || config.videoApiKey),
          baseUrl: config.baseUrl,
          llmModel: config.llmModel,
          llmEnabled: config.llmEnabled,
          imageModel: config.imageModel,
          imageEnabled: config.imageEnabled,
          videoModel: config.videoModel,
          videoEnabled: config.videoEnabled,
          ttsModel: config.ttsModel,
          ttsEnabled: config.ttsEnabled,
          llmProvider: config.llmProvider,
          imageProvider: config.imageProvider,
          videoProvider: config.videoProvider,
          ttsProvider: config.ttsProvider,
        },
      }
    } catch (err: any) {
      console.error('[UserModelConfig] Get error:', err)
      return reply.status(500).send({ success: false, error: err.message || '获取配置失败' })
    }
  })

  // ── 批量保存 per-type provider 映射 ──
  fastify.post('/api/user/model-config/provider-map', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })

    const body = request.body as {
      llmProvider?: string
      imageProvider?: string
      videoProvider?: string
      ttsProvider?: string
    }

    try {
      // ⭐ 写入时保证"单职责行"：设置某类的 provider 时，清理其他行中同类型的旧值。
      // llmProvider 由 activeLlmConfigId 决定，禁止在此覆盖
      const typeFieldMap: Record<string, string> = {}
      if (body.imageProvider) typeFieldMap.imageProvider = body.imageProvider
      if (body.videoProvider) typeFieldMap.videoProvider = body.videoProvider
      if (body.ttsProvider)   typeFieldMap.ttsProvider   = body.ttsProvider

      await prisma.$transaction(async (tx) => {
        for (const [field, provider] of Object.entries(typeFieldMap)) {
          // 1. 设置目标 provider 行
          await tx.userModelConfig.upsert({
            where: { userId_provider: { userId, provider } },
            update: { [field]: provider },
            create: { userId, provider, [field]: provider, apiKey: null },
          })

          // 2. 清理其他行中同类型的旧值（避免 cross-row 污染）
          await tx.userModelConfig.updateMany({
            where: { userId, provider: { not: provider }, [field]: { not: null } },
            data: { [field]: null },
          })
        }
      }, { timeout: 10000 })

      return { success: true, timestamp: new Date().toISOString() } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      console.error('[ProviderMap] Batch save error:', err)
      return reply.status(500).send({ success: false, error: err.message || '保存失败' })
    }
  })

  // ── 获取 per-type provider 映射 ──
  fastify.get('/api/user/model-config/provider-map', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return reply.status(401).send({ success: false, error: '未授权' })

    try {
      // ⭐ 字段级聚合逻辑（独立决策，互不污染）
      // 遍历所有行，image/video/tts 各自追踪自己的 updatedAt
      // 不存在"一行同时抢占多个 capability"的问题
      const userResult = await prisma.user.findUnique({
        where: { id: userId },
        select: { activeLlmConfigId: true },
      })
      let activeProvider = ''
      if (userResult?.activeLlmConfigId) {
        const activeConfig = await prisma.userModelConfig.findUnique({
          where: { id: userResult.activeLlmConfigId },
          select: { provider: true, llmProvider: true },
        })
        if (activeConfig) {
          activeProvider = activeConfig.llmProvider || activeConfig.provider
        }
      }

      const rows = await prisma.userModelConfig.findMany({
        where: { userId },
        select: { imageProvider: true, videoProvider: true, ttsProvider: true, updatedAt: true },
      })

      type T = { value: string; at: Date }
      const img: T = { value: '', at: new Date(0) }
      const vid: T = { value: '', at: new Date(0) }
      const tts: T = { value: '', at: new Date(0) }

      for (const row of rows) {
        if (row.imageProvider && row.updatedAt > img.at) {
          img.value = row.imageProvider
          img.at = row.updatedAt
        }
        if (row.videoProvider && row.updatedAt > vid.at) {
          vid.value = row.videoProvider
          vid.at = row.updatedAt
        }
        if (row.ttsProvider && row.updatedAt > tts.at) {
          tts.value = row.ttsProvider
          tts.at = row.updatedAt
        }
      }

      const result: Record<string, string> = {
        llm: activeProvider || '',
        image: img.value,
        video: vid.value,
        tts: tts.value,
      }

      return { success: true, data: result } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      console.error('[ProviderMap] Get error:', err)
      return reply.status(500).send({ success: false, error: err.message || '获取失败' })
    }
  })

  // ── 从阿里百炼同步可用模型列表 ──
  fastify.get('/api/user/model-config/sync-aliyun-models', { 
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) {
      return reply.status(401).send({ success: false, error: '未授权' })
    }

    try {
      const config = await prisma.userModelConfig.findUnique({
        where: { userId_provider: { userId, provider: 'aliyun' } },
      })

      if (!config || !config.apiKey) {
        return reply.status(400).send({ success: false, error: '请先配置阿里百炼 API Key' })
      }

      const key = decryptKey(config.apiKey)
      const baseUrl = config.baseUrl || 'https://dashscope.aliyuncs.com'

      const resp = await fetch(baseUrl + '/api/v1/models?page_size=200', {
        headers: { Authorization: 'Bearer ' + key },
        signal: AbortSignal.timeout(15000),
      })
      if (!resp.ok) {
        const text = await resp.text()
        return reply.status(502).send({ success: false, error: '阿里百炼 API 返回 ' + resp.status + ': ' + text.slice(0, 200) })
      }

      const data = await resp.json()
      if (!data?.output?.models || !Array.isArray(data.output.models)) {
        return reply.status(502).send({ success: false, error: '阿里百炼返回格式异常' })
      }

      const allModels = data.output.models

      // 分类
      const llmModels = allModels.filter((m: any) =>
        (!['image','video','tts','embedding','rerank','wan','cosyvoice','sambert','paraformer','speech','retrieval','bge-','classification','segmentation','detection'].some((k: string) => m.model.includes(k))) &&
        m.features?.includes('function-calling')
      )
      // 图片分类：匹配image关键字 + wan中图片相关模型
      const imageModels = allModels.filter((m: any) => 
        m.model.includes('image') || m.model.includes('t2i') || (m.model.includes('wan') && (m.model.includes('image') || m.model.includes('anima')))
      ).map((m: any) => {
        // 🆕 区分图生图能力：wan2.7-image-pro 同时支持 T2I+I2I，纯 t2i 模型只支持文生图
        const modelName = m.model
        const isPureT2I = modelName.includes('t2i') || modelName === 'wanx2.1-t2i-turbo'
        return { ...m, supportsI2I: !isPureT2I }
      })
      // 视频分类：匹配video关键字 + wan中明确是视频生成的模型（排除image/t2i/image/s2v）
      const videoModels = allModels.filter((m: any) => 
        m.model.includes('video') || 
        (m.model.includes('wan') && !m.model.includes('image') && !m.model.includes('t2i') && !m.model.includes('s2v') && !m.model.includes('detect'))
      )
      const ttsModels = allModels.filter((m: any) => m.model.includes('cosyvoice') || m.model.includes('sambert'))

      // 同步到 ModelProvider 表的 defaultParams 中，供各卡片下拉框使用
      const prov = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun' } })
      if (prov) {
        const dp = (prov.defaultParams as any) || {}
        if (!dp.models) dp.models = {}
        // 合并模型（去重，更新 label）
        const mergeModels = (existing: any[], newList: any[]) => {
          const map = new Map(existing.map(m => [m.name, m]))
          newList.forEach(m => map.set(m.model, { name: m.model, label: m.name, isActive: true }))
          return Array.from(map.values())
        }
        dp.models.llm = mergeModels(dp.models.llm || [], llmModels)
        dp.models.image = mergeModels(dp.models.image || [], imageModels)
        dp.models.video = mergeModels(dp.models.video || [], videoModels)
        dp.models.tts = mergeModels(dp.models.tts || [], ttsModels)
        await prisma.modelProvider.update({
          where: { provider: 'aliyun' },
          data: { defaultParams: dp },
        })
      }

      return {
        success: true,
        data: {
          total: allModels.length,
          llm: llmModels.map((m: any) => ({ id: m.model, name: m.name, model: m.model })),
          image: imageModels.map((m: any) => ({ id: m.model, name: m.name, model: m.model })),
          video: videoModels.map((m: any) => ({ id: m.model, name: m.name, model: m.model })),
          tts: ttsModels.map((m: any) => ({ id: m.model, name: m.name, model: m.model })),
        },
      }
    } catch (err: any) {
      console.error('[SyncModels] Error:', err)
      return reply.status(500).send({ success: false, error: err.message || '同步模型列表失败' })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

