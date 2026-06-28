/**
 * B2-3 User Model Resolver — 用户模型配置解析
 *
 * 从 A1 UserModelConfig 表中读取用户的自选模型配置
 * 如果用户未配置，使用系统默认
 * 解密 API Key，映射 capability → 具体 model
 */

import { prisma } from '../utils/index.js'
import { createDecipheriv } from 'crypto'

// AES-GCM 解密密钥（与 user-model-config 路由一致）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'aigc-scs-default-key-change-me-in-prod-12'

export class UserModelResolver {
  /**
   * 解析用户对某个 capability 的模型配置
   */
  async resolve(capability: string, userId: string): Promise<{
    provider: string
    modelName: string
    apiKey: string
    baseUrl?: string
  }> {
    // 1. 查用户配置 — 按优先级 aliyun → volcengine → deepseek
    const providers = ['aliyun', 'volcengine', 'deepseek']
    for (const prov of providers) {
      console.warn("[LEGACY-V1-READ] services/user-model-resolver.ts — resolve() 读 V1 UserModelConfig, 应迁移到 V2");
      console.warn("[LEGACY-V1-READ] user-model-resolver.ts — resolve() 读 V1, 应迁移到 V2");
      const config = await prisma.userModelConfig.findFirst({
        where: { userId, provider: prov, llmEnabled: true },
      })
      if (!config?.apiKey) continue

      try {
        const decrypted = decrypt(config.apiKey)

        // llm 能力
        if (capability === 'llm') {
          return {
            provider: prov,
            modelName: config.llmModel || (prov === 'aliyun' ? 'qwen-max' : prov === 'volcengine' ? 'doubao-seed-2-0-plus-260428' : 'deepseek-chat'),
            apiKey: decrypted,
            baseUrl: config.baseUrl || undefined,
          }
        }
      } catch {
        continue // 解密失败则跳过
      }
    }

    // 2. 降级到系统默认
    return this.getDefault(capability)
  }

  /**
   * 返回系统默认配置
   */
  private getDefault(capability: string): Promise<{
    provider: string
    modelName: string
    apiKey: string
    baseUrl?: string
  }> {
    // SAMSP Rule: No default models. MSAL is the sole authority.
    return Promise.resolve({
      provider: '',
      modelName: '',
      apiKey: '',
    })
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

export const userModelResolver = new UserModelResolver()
