import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { saveUnifiedModelConfig } from '../config/saveUnified.js'
import { loadFullConfigV2, hasApiKeyForProvider } from '../config/v2.js'

/**
 * 配置系统唯一写 API — Fastify plugin
 *
 * POST /api/v2/user/model-config/unified — 单一事实源写入（替换 saveProviderMap + handleSaveAll）
 * GET  /api/v2/user/model-config/unified — 读取完整配置
 */
export default async function unifiedModelConfigRoutes(fastify: FastifyInstance) {

  // ── 统一写入 ──
  fastify.post('/api/v2/user/model-config/unified', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = (request as any).user?.userId || (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ success: false, error: '未登录' })
      }

      const { providerMap, modelMap, apiKeys, enabledMap, baseUrl, baseUrlMap } = request.body as any

      if (!providerMap || !modelMap) {
        return reply.status(400).send({
          success: false,
          error: '缺少必要参数: providerMap, modelMap',
        })
      }

      // 对 body 去重处理（apiKeys 可能为空对象）
      await saveUnifiedModelConfig(userId, {
        providerMap,
        modelMap,
        apiKeys: apiKeys || {},
        enabledMap: enabledMap || {},
        baseUrl,
        baseUrlMap,
      })

      const config = await loadFullConfigV2(userId)
      if (!config) {
        return reply.send({ success: true, data: null })
      }
      return reply.send({
        success: true,
        data: {
          llmProvider: config.llmProvider,
          imageProvider: config.imageProvider,
          videoProvider: config.videoProvider,
          ttsProvider: config.ttsProvider,
          musicProvider: config.musicProvider,
          llmModel: config.llmModel,
          imageModel: config.imageModel,
          videoModel: config.videoModel,
          ttsModel: config.ttsModel,
          musicModel: config.musicModel,
          llmEnabled: config.llmEnabled,
          imageEnabled: config.imageEnabled,
          videoEnabled: config.videoEnabled,
          ttsEnabled: config.ttsEnabled,
          musicEnabled: config.musicEnabled,
          visionUnderstandProvider: config.visionUnderstandProvider,
          visionUnderstandModel: config.visionUnderstandModel,
          visionUnderstandEnabled: config.visionUnderstandEnabled,
          hasVisionUnderstandApiKey: hasApiKeyForProvider(config, "visionUnderstand"),
          visionUnderstandBaseUrl: config.visionUnderstandBaseUrl,
          hasLlmApiKey: hasApiKeyForProvider(config, 'llm'),
          hasImageApiKey: hasApiKeyForProvider(config, 'image'),
          hasVideoApiKey: hasApiKeyForProvider(config, 'video'),
          hasTtsApiKey: hasApiKeyForProvider(config, 'tts'),
          hasMusicApiKey: hasApiKeyForProvider(config, 'music'),
          baseUrl: config.baseUrl,
          llmBaseUrl: config.llmBaseUrl,
          imageBaseUrl: config.imageBaseUrl,
          videoBaseUrl: config.videoBaseUrl,
          ttsBaseUrl: config.ttsBaseUrl,
          musicBaseUrl: config.musicBaseUrl,
          // JSONB 能力
          careerAgentProvider: config.capabilityLlmConfigs?.career_agent?.provider || '',
          careerAgentModel: config.capabilityLlmConfigs?.career_agent?.model || '',
          hasCareerAgentApiKey: hasApiKeyForProvider(config, 'career_agent'),
          hdzProvider: config.capabilityLlmConfigs?.hdz?.provider || '',
          hdzModel: config.capabilityLlmConfigs?.hdz?.model || '',
          hasHdzApiKey: hasApiKeyForProvider(config, 'hdz'),
          pptProvider: config.capabilityLlmConfigs?.ppt?.provider || '',
          pptModel: config.capabilityLlmConfigs?.ppt?.model || '',
          hasPptApiKey: hasApiKeyForProvider(config, 'ppt'),
          novelProvider: config.capabilityLlmConfigs?.novel?.provider || '',
          novelModel: config.capabilityLlmConfigs?.novel?.model || '',
          hasNovelApiKey: hasApiKeyForProvider(config, 'novel'),
        },
      })
    } catch (e: any) {
      console.error('[UnifiedConfig] 写入失败:', e)
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ── 统一读取 ──
  fastify.get('/api/v2/user/model-config/unified', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const userId = (request as any).user?.userId || (request as any).user?.id
      if (!userId) {
        return reply.status(401).send({ success: false, error: '未登录' })
      }

      const config = await loadFullConfigV2(userId)
      if (!config) {
        return reply.send({ success: true, data: null })
      }

      return reply.send({
        success: true,
        data: {
          llmProvider: config.llmProvider,
          imageProvider: config.imageProvider,
          videoProvider: config.videoProvider,
          ttsProvider: config.ttsProvider,
          musicProvider: config.musicProvider,
          llmModel: config.llmModel,
          imageModel: config.imageModel,
          videoModel: config.videoModel,
          ttsModel: config.ttsModel,
          musicModel: config.musicModel,
          llmEnabled: config.llmEnabled,
          imageEnabled: config.imageEnabled,
          videoEnabled: config.videoEnabled,
          ttsEnabled: config.ttsEnabled,
          musicEnabled: config.musicEnabled,
          visionUnderstandProvider: config.visionUnderstandProvider,
          visionUnderstandModel: config.visionUnderstandModel,
          visionUnderstandEnabled: config.visionUnderstandEnabled,
          hasVisionUnderstandApiKey: hasApiKeyForProvider(config, "visionUnderstand"),
          visionUnderstandBaseUrl: config.visionUnderstandBaseUrl,
          hasLlmApiKey: hasApiKeyForProvider(config, 'llm'),
          hasImageApiKey: hasApiKeyForProvider(config, 'image'),
          hasVideoApiKey: hasApiKeyForProvider(config, 'video'),
          hasTtsApiKey: hasApiKeyForProvider(config, 'tts'),
          hasMusicApiKey: hasApiKeyForProvider(config, 'music'),
          baseUrl: config.baseUrl,
          llmBaseUrl: config.llmBaseUrl,
          imageBaseUrl: config.imageBaseUrl,
          videoBaseUrl: config.videoBaseUrl,
          ttsBaseUrl: config.ttsBaseUrl,
          musicBaseUrl: config.musicBaseUrl,
          // JSONB 能力（career_agent, hdz, ppt, novel)
          careerAgentProvider: config.capabilityLlmConfigs?.career_agent?.provider || '',
          careerAgentModel: config.capabilityLlmConfigs?.career_agent?.model || '',
          careerAgentBaseUrl: config.capabilityLlmConfigs?.career_agent?.baseUrl || '',
          careerAgentEnabled: config.capabilityLlmConfigs?.career_agent?.enabled ?? true,
          hasCareerAgentApiKey: hasApiKeyForProvider(config, 'career_agent'),
          hdzProvider: config.capabilityLlmConfigs?.hdz?.provider || '',
          hdzModel: config.capabilityLlmConfigs?.hdz?.model || '',
          hdzBaseUrl: config.capabilityLlmConfigs?.hdz?.baseUrl || '',
          hdzEnabled: config.capabilityLlmConfigs?.hdz?.enabled ?? true,
          hasHdzApiKey: hasApiKeyForProvider(config, 'hdz'),
          pptProvider: config.capabilityLlmConfigs?.ppt?.provider || '',
          pptModel: config.capabilityLlmConfigs?.ppt?.model || '',
          pptBaseUrl: config.capabilityLlmConfigs?.ppt?.baseUrl || '',
          pptEnabled: config.capabilityLlmConfigs?.ppt?.enabled ?? true,
          hasPptApiKey: hasApiKeyForProvider(config, 'ppt'),
          novelProvider: config.capabilityLlmConfigs?.novel?.provider || '',
          novelModel: config.capabilityLlmConfigs?.novel?.model || '',
          novelBaseUrl: config.capabilityLlmConfigs?.novel?.baseUrl || '',
          novelEnabled: config.capabilityLlmConfigs?.novel?.enabled ?? true,
          hasNovelApiKey: hasApiKeyForProvider(config, 'novel'),
        },
      })
    } catch (e: any) {
      console.error('[UnifiedConfig] 读取失败:', e)
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
