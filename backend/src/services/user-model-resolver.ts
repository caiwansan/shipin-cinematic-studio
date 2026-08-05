/**
 * services/user-model-resolver.ts — 用户模型配置解析（V2 真相源）
 *
 * 已从 V1 → V2 迁移。直接从 UserModelConfigV2 读取配置。
 * 移除所有 V1 UserModelConfig 表调用。
 *
 * S3.4.1.5: Development Provider 兜底（仅 dev/test）
 *   - 顺序: BYOK 用户配置优先 → dev provider 兜底（解析失败时）
 *   - 仅当 KUNLUN_DEV_PROVIDER=1 且 DEEPSEEK_DEV_API_KEY 存在
 *   - 不进入用户模型配置 / 不参与计费 / 不进入 Marketplace
 *   - 调用路径不变（仍经 Unified AI Gateway + provider adapter）
 */

import { prisma } from '../utils/index.js'
import { decryptKey } from './crypto.service.js'

export interface ResolvedProvider {
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string
}

export class UserModelResolver {
  /**
   * S3.4.1.5: Development Provider（dev/test 点火钥匙, 非商业能力）
   */
  async resolveDevProvider(capability: string): Promise<ResolvedProvider | null> {
    if (capability !== 'llm') return null
    const devEnabled = process.env.KUNLUN_DEV_PROVIDER === '1'
    const key = process.env.DEEPSEEK_DEV_API_KEY
    if (!devEnabled || !key) return null
    return {
      provider: 'deepseek',
      modelName: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash',
      apiKey: key,
      baseUrl: process.env.DEEPSEEK_BASE_URL || undefined,
    }
  }

  async resolve(capability: string, userId: string): Promise<ResolvedProvider | null> {
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
    if (!v2) return this.resolveDevProvider(capability)

    // capability 到 V2 配置字段映射
    const map: Record<string, { prov: string; key: string; mdl: string; en: boolean }> = {
      llm: { prov: v2.llmProvider || '', key: v2.llmApiKey || '', mdl: v2.llmModel || '', en: v2.llmEnabled },
      image: { prov: v2.imageProvider || '', key: v2.imageApiKey || '', mdl: v2.imageModel || '', en: v2.imageEnabled },
      video: { prov: v2.videoProvider || '', key: v2.videoApiKey || '', mdl: v2.videoModel || '', en: v2.videoEnabled },
      tts: { prov: v2.ttsProvider || '', key: v2.ttsApiKey || '', mdl: v2.ttsModel || '', en: v2.ttsEnabled },
    }

    const cfg = map[capability]
    if (!cfg || !cfg.key || !cfg.en) return this.resolveDevProvider(capability)

    let decrypted: string
    try {
      decrypted = decryptKey(cfg.key)
    } catch {
      return this.resolveDevProvider(capability)
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
