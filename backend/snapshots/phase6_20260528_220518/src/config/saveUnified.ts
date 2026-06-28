/**
 * config/saveUnified.ts — 配置系统唯一写入入口
 *
 * 🔥 核心原则：
 *   单行全局写入，不依赖 V1/V2 的字段分离
 *   一次调用完成整个 UserModelConfigV2 行的原子更新
 *
 * 不再有：
 *   - saveProviderMap / handleSaveAll 双写
 *   - resolveApiKey 通配扫描
 *   - fallbackModel 错误吞噬
 */

import { prisma } from '../utils/index.js'
import { encryptKey } from '../services/crypto.service.js'

export interface UnifiedPayload {
  /** provider 选择: { llm, image, video, tts } → provider id */
  providerMap: Record<string, string>
  /** 模型名: { llm, image, video, tts } → model name */
  modelMap: Record<string, string>
  /** API Key: { llm, image, video, tts } → raw key */
  apiKeys: Record<string, string>
  /** 开关: { llm, image, video } → boolean */
  enabledMap?: Record<string, boolean>
  /** 自定义 baseUrl */
  baseUrl?: string
}

/**
 * 唯一写入口 — 原子更新整行 UserModelConfigV2
 *
 * 调用方（前端）必须一次传入完整状态，不分多次调 API。
 * 不存在"只写 provider 不写 model"或"只写 key 不写 provider"。
 */
export async function saveUnifiedModelConfig(
  userId: string,
  payload: UnifiedPayload
): Promise<void> {
  // 加密 Key — 只写入前端明确提供的值，空字符串 = 保留 DB 原有值
  // 先读取 DB 当前配置以保留未传入的 Key
  const existing = await prisma.userModelConfigV2.findUnique({
    where: { userId },
    select: { llmApiKey: true, imageApiKey: true, videoApiKey: true, ttsApiKey: true }
  })
  const encKeys: Record<string, string | null> = {}
  for (const cap of ['llm', 'image', 'video', 'tts'] as const) {
    const raw = payload.apiKeys[cap]
    if (raw) {
      encKeys[`${cap}ApiKey`] = encryptKey(raw)
    } else if (existing && (existing as any)[`${cap}ApiKey`]) {
      // 前端没传（空字符串），保留 DB 原有 Key
      encKeys[`${cap}ApiKey`] = (existing as any)[`${cap}ApiKey`]
    } else {
      encKeys[`${cap}ApiKey`] = null
    }
  }

  await prisma.userModelConfigV2.upsert({
    where: { userId },
    update: {
      // provider
      llmProvider: payload.providerMap.llm || 'volcengine',
      imageProvider: payload.providerMap.image || 'volcengine',
      videoProvider: payload.providerMap.video || 'volcengine',
      ttsProvider: payload.providerMap.tts || 'volcengine',
      // model
      llmModel: payload.modelMap.llm ?? 'doubao-seed-2-0-plus-260428',
      imageModel: payload.modelMap.image ?? 'wan2.7-image-pro',
      videoModel: payload.modelMap.video ?? 'wan2.7-t2v',
      ttsModel: payload.modelMap.tts ?? 'qwen3-tts-flash',
      // keys
      llmApiKey: encKeys.llmApiKey,
      imageApiKey: encKeys.imageApiKey,
      videoApiKey: encKeys.videoApiKey,
      ttsApiKey: encKeys.ttsApiKey,
      // enabled
      llmEnabled: payload.enabledMap?.llm ?? true,
      imageEnabled: payload.enabledMap?.image ?? true,
      videoEnabled: payload.enabledMap?.video ?? true,
      ttsEnabled: payload.enabledMap?.tts ?? true,
      // baseUrl
      baseUrl: payload.baseUrl,
    },
    create: {
      userId,
      llmProvider: payload.providerMap.llm || 'volcengine',
      imageProvider: payload.providerMap.image || 'volcengine',
      videoProvider: payload.providerMap.video || 'volcengine',
      ttsProvider: payload.providerMap.tts || 'volcengine',
      llmModel: payload.modelMap.llm ?? 'doubao-seed-2-0-plus-260428',
      imageModel: payload.modelMap.image ?? 'wan2.7-image-pro',
      videoModel: payload.modelMap.video ?? 'wan2.7-t2v',
      ttsModel: payload.modelMap.tts ?? 'qwen3-tts-flash',
      llmApiKey: encKeys.llmApiKey,
      imageApiKey: encKeys.imageApiKey,
      videoApiKey: encKeys.videoApiKey,
      ttsApiKey: encKeys.ttsApiKey,
      llmEnabled: payload.enabledMap?.llm ?? true,
      imageEnabled: payload.enabledMap?.image ?? true,
      videoEnabled: payload.enabledMap?.video ?? true,
      ttsEnabled: payload.enabledMap?.tts ?? true,
      baseUrl: payload.baseUrl,
    },
  })
}
