/**
 * P0 — User Model Resolver (Capability-Based)
 *
 * LEGACY: 旧版 resolve('llm', userId) 已被标记为 @deprecated
 *   新版使用 resolveCapabilityProvider(capability, userId)
 *
 * 设计原则：
 *   业务层只能声明 capability，不能指定 provider。
 *   Resolver 负责将 capability 映射到用户配置的 provider。
 *
 * ═══ 调用链 ═══
 *   Agent → runtimeDispatcher.execute(capability, payload)
 *       ↓
 *   userModelResolver.resolveCapabilityProvider(capability, userId)
 *       ↓
 *   provider adapter
 *       ↓
 *   native execute
 */

import { prisma } from '../utils/index.js'
import { createDecipheriv } from 'crypto'
import { Capability } from '../core/runtime/capabilities.js'

// AES-GCM 解密密钥
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'aigc-scs-default-key-change-me-in-prod-12'

/**
 * Capability 到 UserModelConfig 字段的映射
 */
const CAPABILITY_TO_MODEL_FIELD: Record<string, {
  modelField: 'llmModel' | 'imageModel' | 'videoModel' | 'ttsModel'
  enabledField: 'llmEnabled' | 'imageEnabled' | 'videoEnabled' | 'ttsEnabled'
  apiKeyField: 'apiKey' | 'imageApiKey' | 'videoApiKey'
}> = {
  [Capability.SCRIPT_ANALYSIS]:      { modelField: 'llmModel',   enabledField: 'llmEnabled',   apiKeyField: 'apiKey' },
  [Capability.PROMPT_OPTIMIZATION]:  { modelField: 'llmModel',   enabledField: 'llmEnabled',   apiKeyField: 'apiKey' },
  [Capability.STORY_EXPANSION]:      { modelField: 'llmModel',   enabledField: 'llmEnabled',   apiKeyField: 'apiKey' },
  [Capability.DIRECTOR_REASONING]:   { modelField: 'llmModel',   enabledField: 'llmEnabled',   apiKeyField: 'apiKey' },
  [Capability.CINEMATIC_PROMPT]:     { modelField: 'llmModel',   enabledField: 'llmEnabled',   apiKeyField: 'apiKey' },
  [Capability.IMAGE_GENERATION]:     { modelField: 'imageModel', enabledField: 'imageEnabled', apiKeyField: 'imageApiKey' },
  [Capability.VIDEO_GENERATION]:     { modelField: 'videoModel', enabledField: 'videoEnabled', apiKeyField: 'videoApiKey' },
  [Capability.VOICE_GENERATION]:     { modelField: 'ttsModel',   enabledField: 'ttsEnabled',   apiKeyField: 'apiKey' },
}

export interface ResolvedProvider {
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string
}

export class UserModelResolverV2 {
  /**
   * 根据 capability 解析用户配置的 Provider
   *
   * 流程：
   *   1. 查 UserModelConfig 表
   *   2. 检查对应能力的开关是否启用
   *   3. 解密 API Key
   *   4. 返回 provider 配置
   *
   * @deprecated 不要直接调用，通过 runtimeDispatcher.execute() 间接调用
   */
  async resolveCapabilityProvider(
    capability: Capability,
    userId: string,
  ): Promise<ResolvedProvider> {
    const mapping = CAPABILITY_TO_MODEL_FIELD[capability]
    if (!mapping) {
      throw new Error(`Unknown capability: ${capability}`)
    }

    // 1. 查用户的所有配置（按优先级排序）
    console.warn("[LEGACY-V1-READ] services/user-model-resolver-v2.ts:75 — resolveCapabilityProvider() 读 V1 findMany, 应迁移到 V2");
    const configs = await prisma.userModelConfig.findMany({
      where: { userId, apiKey: { not: null } },
      orderBy: { updatedAt: 'desc' },
    })

    // 2. 按预设优先级排列
    const providerPriority = ['aliyun', 'volcengine', 'deepseek', 'siliconflow', 'custom']
    const sorted = providerPriority
      .map(p => configs.find(c => c.provider === p))
      .filter(Boolean) as NonNullable<typeof configs[0]>[]

    for (const config of sorted) {
      // 检查对应能力的开关
      const enabled = config[mapping.enabledField]
      if (!enabled) continue

      // 取专用 API Key，没有则用通用 Key
      const rawKey = config[mapping.apiKeyField] || config.apiKey
      if (!rawKey) continue

      let decrypted: string
      try {
        decrypted = decrypt(rawKey)
      } catch {
        continue
      }

      const modelName = config[mapping.modelField]

      return {
        provider: config.llmProvider || config.provider,
        modelName,
        apiKey: decrypted,
        baseUrl: config.baseUrl || undefined,
      }
    }

    // 3. 没有用户配置，降级到系统默认（LEGACY 行为）
    throw new Error(
      `用户 ${userId.substring(0, 8)} 未配置 capability "${capability}" 对应的 provider，` +
      `请先在大模型设置中配置 API Key`
    )
  }

  /**
   * @deprecated 旧版 resolve 方法，仅用于过渡期
   * 使用 resolveCapabilityProvider 替代
   */
  async resolve(capability: string, userId: string): Promise<ResolvedProvider> {
    const providers = ['aliyun', 'volcengine', 'deepseek']
    console.warn("[LEGACY-V1-READ] services/user-model-resolver-v2.ts:126 — resolve() 读 V1 findFirst, 应迁移到 V2");
    for (const prov of providers) {
      console.warn("[LEGACY-V1-READ] user-model-resolver-v2.ts — resolve() 读 V1 findFirst");
      const config = await prisma.userModelConfig.findFirst({
        where: { userId, provider: prov, llmEnabled: true },
      })
      if (!config?.apiKey) continue

      try {
        const decrypted = decrypt(config.apiKey)
        if (capability === 'llm') {
          return {
            provider: prov,
            modelName: config.llmModel || (prov === 'aliyun' ? 'qwen-max' : prov === 'volcengine' ? 'doubao' : 'deepseek-chat'),
            apiKey: decrypted,
            baseUrl: config.baseUrl || undefined,
          }
        }
      } catch {
        continue
      }
    }

    throw new Error(`未找到有效的 Provider 配置`)
  }
}

function decrypt(encrypted: string): string {
  try {
    const parts = encrypted.split(':')
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const data = Buffer.from(parts[2], 'hex')
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '_').slice(0, 32))
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data) + decipher.final('utf8')
  } catch {
    return encrypted
  }
}

export const userModelResolverV2 = new UserModelResolverV2()
