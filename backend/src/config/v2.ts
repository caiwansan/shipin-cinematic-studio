/**
 * Config System v2 — 单行配置读取
 *
 * ⭐ Phase 1.5 BYO 升级:
 *   - 新增 per-capability baseUrl 字段（llmBaseUrl/imageBaseUrl/videoBaseUrl/ttsBaseUrl）
 *   - loadFullConfigV2 现在返回所有 per-capability baseUrl
 */

import { prisma } from '../utils/index.js'

export async function loadProviderConfigV2(userId: string) {
  const cfg = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  })

  if (!cfg) {
    return {
      imageProvider: '',
      videoProvider: '',
      ttsProvider: '',
      imageApiKey: null,
      videoApiKey: null,
      ttsApiKey: null,
      baseUrl: null,
      llmBaseUrl: null,
      imageBaseUrl: null,
      videoBaseUrl: null,
      ttsBaseUrl: null,
    }
  }

  return {
    imageProvider: cfg.imageProvider,
    videoProvider: cfg.videoProvider,
    ttsProvider: cfg.ttsProvider,
    imageApiKey: cfg.imageApiKey,
    videoApiKey: cfg.videoApiKey,
    ttsApiKey: cfg.ttsApiKey,
    baseUrl: cfg.baseUrl,
    llmBaseUrl: cfg.llmBaseUrl,
    imageBaseUrl: cfg.imageBaseUrl,
    videoBaseUrl: cfg.videoBaseUrl,
    ttsBaseUrl: cfg.ttsBaseUrl,
  }
}

/**
 * 加载完整配置（含 LLM 字段）
 */
export async function loadFullConfigV2(userId: string) {
  const cfg = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  })
  return cfg
}

/**
 * 检查某个能力的 API Key 是否已配置
 */
export function hasApiKeyForProvider(config: any, capability: string): boolean {
  const fieldMap: Record<string, string> = {
    llm: "llmApiKey",
    image: "imageApiKey",
    video: "videoApiKey",
    tts: "ttsApiKey",
    music: "musicApiKey",
    visionUnderstand: "visionUnderstandApiKey",
  }
  const field = fieldMap[capability]
  if (field) {
    const val = config[field]
    return !!val && val.length > 0
  }
  // JSONB 能力（career_agent, music — deprecated hdz/ppt/novel）
  const jsonb = config.capabilityLlmConfigs as Record<string, any> | null
  if (jsonb?.[capability]) {
    return !!jsonb[capability].hasApiKey || !!jsonb[capability].apiKey
  }
  return false
}
