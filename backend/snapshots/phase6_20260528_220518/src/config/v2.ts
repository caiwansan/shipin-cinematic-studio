import { prisma } from '../utils/index.js'

/**
 * Config System v2 — 单行配置读取
 * 源码中可以 import 的唯一入口
 */
export async function loadProviderConfigV2(userId: string) {
  const cfg = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  })

  if (!cfg) {
    return {
      imageProvider: 'volcengine',
      videoProvider: 'volcengine',
      ttsProvider: 'volcengine',
      imageApiKey: null,
      videoApiKey: null,
      ttsApiKey: null,
      baseUrl: null,
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
  }
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
  }
  const field = fieldMap[capability]
  if (!field) return false
  const val = config[field]
  return !!val && val.length > 0
}

export async function loadFullConfigV2(userId: string) {
  const cfg = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  })

  if (!cfg) return null

  return {
    imageProvider: cfg.imageProvider,
    videoProvider: cfg.videoProvider,
    ttsProvider: cfg.ttsProvider,
    imageApiKey: cfg.imageApiKey,
    videoApiKey: cfg.videoApiKey,
    ttsApiKey: cfg.ttsApiKey,
    baseUrl: cfg.baseUrl,
    imageModel: cfg.imageModel,
    imageEnabled: cfg.imageEnabled,
    videoModel: cfg.videoModel,
    videoEnabled: cfg.videoEnabled,
    ttsModel: cfg.ttsModel,
    ttsEnabled: cfg.ttsEnabled,
    llmProvider: cfg.llmProvider,
    llmApiKey: cfg.llmApiKey,
    llmModel: cfg.llmModel,
    llmEnabled: cfg.llmEnabled,
    // 前端需要 has*ApiKey 字段来判断是否标绿
    hasLlmApiKey: !!cfg.llmApiKey && cfg.llmApiKey.length > 0,
    hasImageApiKey: !!cfg.imageApiKey && cfg.imageApiKey.length > 0,
    hasVideoApiKey: !!cfg.videoApiKey && cfg.videoApiKey.length > 0,
    hasTtsApiKey: !!cfg.ttsApiKey && cfg.ttsApiKey.length > 0,
  }
}
