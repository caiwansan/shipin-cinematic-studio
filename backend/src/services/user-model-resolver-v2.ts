/**
 * services/user-model-resolver-v2.ts — 用户模型配置解析 V2
 *
 * 已从 V1 UserModelConfig 迁移到 V2 UserModelConfigV2。
 * 直接从单行配置中读取。
 */

import { prisma } from '../utils/index.js'
import { decryptKey } from './crypto.service.js'

export interface ResolvedProvider {
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string
}

export class UserModelResolverV2 {
  /**
   * 按 capability 解析最佳的 provider+model+key
   */
  async resolveCapabilityProvider(capability: string, userId: string): Promise<ResolvedProvider | null> {
    const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
    if (!v2) return null

    const map: Record<string, { prov: string | null; key: string | null; mdl: string | null; en: boolean }> = {
      llm: { prov: v2.llmProvider, key: v2.llmApiKey, mdl: v2.llmModel, en: v2.llmEnabled },
      image: { prov: v2.imageProvider, key: v2.imageApiKey, mdl: v2.imageModel, en: v2.imageEnabled },
      video: { prov: v2.videoProvider, key: v2.videoApiKey, mdl: v2.videoModel, en: v2.videoEnabled },
      tts: { prov: v2.ttsProvider, key: v2.ttsApiKey, mdl: v2.ttsModel, en: v2.ttsEnabled },
    }

    const cfg = map[capability]
    if (!cfg || !cfg.key || !cfg.en) return null

    try {
      const decrypted = decryptKey(cfg.key)
      return {
        provider: cfg.prov || '',
        modelName: cfg.mdl || '',
        apiKey: decrypted,
        baseUrl: v2.baseUrl || undefined,
      }
    } catch {
      return null
    }
  }

  /**
   * 保留原 resolve(capability, userId) 接口兼容性
   */
  async resolve(capability: string, userId: string): Promise<ResolvedProvider | null> {
    // 按优先级尝试各 provider
    const providers = ['volcengine', 'deepseek', 'bailian', 'aliyun', 'custom']
    for (const prov of providers) {
      const r = await this.resolveCapabilityProvider(capability, userId)
      if (r && r.provider === prov) return r
      // fallback: 尝试其他 provider
    }
    return this.resolveCapabilityProvider(capability, userId)
  }
}

export const userModelResolverV2 = new UserModelResolverV2()
