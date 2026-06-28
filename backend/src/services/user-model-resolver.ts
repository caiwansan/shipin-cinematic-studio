/**
 * services/user-model-resolver.ts — 用户模型配置解析（V2 真相源）
 *
 * 已从 V1 → V2 迁移。直接从 UserModelConfigV2 读取配置。
 * 移除所有 V1 UserModelConfig 表调用。
 */

import { prisma } from '../utils/index.js'
import { decryptKey } from './crypto.service.js'

export class UserModelResolver {
  async resolve(capability: string, userId: string): Promise<{
    provider: string
    modelName: string
    apiKey: string
    baseUrl?: string
  } | null> {
    // UUID 格式校验：如果不是合法 UUID，直接返回 null
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return null
    }

    let v2: any
    try {
      v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
    } catch {
      return null
    }
    if (!v2) return null

    // capability 到 V2 配置字段映射
    const map: Record<string, { prov: string; key: string; mdl: string; en: boolean }> = {
      llm: { prov: v2.llmProvider || '', key: v2.llmApiKey || '', mdl: v2.llmModel || '', en: v2.llmEnabled },
      image: { prov: v2.imageProvider || '', key: v2.imageApiKey || '', mdl: v2.imageModel || '', en: v2.imageEnabled },
      video: { prov: v2.videoProvider || '', key: v2.videoApiKey || '', mdl: v2.videoModel || '', en: v2.videoEnabled },
      tts: { prov: v2.ttsProvider || '', key: v2.ttsApiKey || '', mdl: v2.ttsModel || '', en: v2.ttsEnabled },
    }

    const cfg = map[capability]
    if (!cfg || !cfg.key || !cfg.en) return null

    let decrypted: string
    try {
      decrypted = decryptKey(cfg.key)
    } catch {
      return null
    }

    return {
      provider: cfg.prov,
      modelName: cfg.mdl,
      apiKey: decrypted,
      baseUrl: v2.baseUrl || undefined,
    }
  }
}

export const userModelResolver = new UserModelResolver()
