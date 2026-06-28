/**
 * config/saveUnified.ts — 配置系统唯一写入入口 v2（BYO 升级）
 *
 * ⭐ Phase 1.5: 新增 per-capability baseUrl 支持
 * ⭐ Phase 2.0: 新增 music（音乐生成）独立配置
 */

import { prisma } from '../utils/index.js'
import { encryptKey } from '../services/crypto.service.js'

export interface UnifiedPayload {
  providerMap: Record<string, string>
  modelMap: Record<string, string>
  apiKeys: Record<string, string>
  enabledMap?: Record<string, boolean>
  baseUrl?: string   // 向后兼容：全局 baseUrl
  /** ⭐ BYO: 每类模型独立端点 */
  baseUrlMap?: Record<string, string>
}

const ALL_CAPS = ['llm', 'image', 'video', 'tts', 'music'] as const

export async function saveUnifiedModelConfig(
  userId: string,
  payload: UnifiedPayload
): Promise<void> {
  const existing = await prisma.userModelConfigV2.findUnique({
    where: { userId },
    select: {
      llmApiKey: true, imageApiKey: true, videoApiKey: true, ttsApiKey: true, musicApiKey: true,
    }
  })
  const encKeys: Record<string, string | null> = {}
  for (const cap of ALL_CAPS) {
    const raw = payload.apiKeys[cap]
    if (raw) {
      encKeys[`${cap}ApiKey`] = encryptKey(raw)
    } else if (existing && (existing as any)[`${cap}ApiKey`]) {
      encKeys[`${cap}ApiKey`] = (existing as any)[`${cap}ApiKey`]
    } else {
      encKeys[`${cap}ApiKey`] = null
    }
  }

  const baseUrlMap = payload.baseUrlMap || {}

  await prisma.userModelConfigV2.upsert({
    where: { userId },
    update: {
      llmProvider: payload.providerMap.llm || '',
      imageProvider: payload.providerMap.image || '',
      videoProvider: payload.providerMap.video || '',
      ttsProvider: payload.providerMap.tts || '',
      musicProvider: payload.providerMap.music || '',
      llmModel: payload.modelMap.llm ?? '',
      imageModel: payload.modelMap.image ?? '',
      videoModel: payload.modelMap.video ?? '',
      ttsModel: payload.modelMap.tts ?? '',
      musicModel: payload.modelMap.music ?? '',
      llmApiKey: encKeys.llmApiKey,
      imageApiKey: encKeys.imageApiKey,
      videoApiKey: encKeys.videoApiKey,
      ttsApiKey: encKeys.ttsApiKey,
      musicApiKey: encKeys.musicApiKey,
      llmEnabled: payload.enabledMap?.llm ?? true,
      imageEnabled: payload.enabledMap?.image ?? true,
      videoEnabled: payload.enabledMap?.video ?? true,
      ttsEnabled: payload.enabledMap?.tts ?? true,
      musicEnabled: payload.enabledMap?.music ?? false,  // 默认关闭
      baseUrl: payload.baseUrl || baseUrlMap.llm || baseUrlMap.image || baseUrlMap.video || baseUrlMap.tts,
      llmBaseUrl: baseUrlMap.llm,
      imageBaseUrl: baseUrlMap.image,
      videoBaseUrl: baseUrlMap.video,
      ttsBaseUrl: baseUrlMap.tts,
      musicBaseUrl: baseUrlMap.music,
    },
    create: {
      userId,
      llmProvider: payload.providerMap.llm || '',
      imageProvider: payload.providerMap.image || '',
      videoProvider: payload.providerMap.video || '',
      ttsProvider: payload.providerMap.tts || '',
      musicProvider: payload.providerMap.music || '',
      llmModel: payload.modelMap.llm ?? 'doubao-seed-2-0-plus-260428',
      imageModel: payload.modelMap.image ?? 'wan2.7-image-pro',
      videoModel: payload.modelMap.video ?? 'wan2.7-t2v',
      ttsModel: payload.modelMap.tts ?? 'qwen3-tts-flash',
      musicModel: payload.modelMap.music ?? '',
      llmApiKey: encKeys.llmApiKey,
      imageApiKey: encKeys.imageApiKey,
      videoApiKey: encKeys.videoApiKey,
      ttsApiKey: encKeys.ttsApiKey,
      musicApiKey: encKeys.musicApiKey,
      llmEnabled: payload.enabledMap?.llm ?? true,
      imageEnabled: payload.enabledMap?.image ?? true,
      videoEnabled: payload.enabledMap?.video ?? true,
      ttsEnabled: payload.enabledMap?.tts ?? true,
      musicEnabled: payload.enabledMap?.music ?? false,
      baseUrl: payload.baseUrl || baseUrlMap.llm || '',
      llmBaseUrl: baseUrlMap.llm,
      imageBaseUrl: baseUrlMap.image,
      videoBaseUrl: baseUrlMap.video,
      ttsBaseUrl: baseUrlMap.tts,
      musicBaseUrl: baseUrlMap.music,
    },
  })
}
