// ============================================================
// Provider Resolver — KMKI-RUNTIME-001 (v2)
// 统一读取用户配置的大模型 API Key / Provider / Model
// 集成 CapabilityRegistry — 按 Agent 能力需求推荐 Provider
// Agent 不再直接读 DB，统一通过此模块获取 LLM Runtime 配置
// ============================================================

import { prisma } from '../../../../utils/index'
import { capabilityRegistry, type Capability } from './capability-registry'

export interface LLMRuntimeConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1/chat/completions',
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
}

/**
 * 解析 userId 的 LLM 运行时配置
 * 优先读取 UserModelConfigV2，其次 ApiKey 全局表
 * 如果指定了 capability 需求，自动验证 provider 是否支持
 */
export async function resolveLLMConfig(
  userId: string,
  requiredCapabilities?: Capability[],
): Promise<LLMRuntimeConfig> {
  // 1. 读用户自己的配置
  const userConfig = await prisma.userModelConfigV2.findUnique({ where: { userId } })

  if (userConfig?.llmEnabled && userConfig.llmApiKey) {
    const provider = userConfig.llmProvider || 'volcengine'
    const model = userConfig.llmModel || 'doubao-seed-2-0-plus-260428'

    // 验证能力支持
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      const allSupported = requiredCapabilities.every((cap) =>
        capabilityRegistry.supports(provider, model, cap),
      )
      if (!allSupported) {
        // 能力不足时尝试推荐
        const candidates = capabilityRegistry.recommend(requiredCapabilities, provider)
        if (candidates.length > 0) {
          const best = candidates[0]
          console.log(
            `[ProviderResolver] ${provider}/${model} lacks some capabilities, falling back to ${best.provider}/${best.model}`,
          )
          const keyRecord = await prisma.apiKey.findUnique({ where: { provider: best.provider } })
          if (keyRecord?.keyValue) {
            return {
              provider: best.provider,
              model: best.model,
              apiKey: keyRecord.keyValue,
              baseUrl: PROVIDER_BASE_URLS[best.provider] || PROVIDER_BASE_URLS.deepseek,
            }
          }
        }
        console.warn(
          `[ProviderResolver] ${provider}/${model} may not support: ${requiredCapabilities.join(', ')}`,
        )
      }
    }

    return {
      provider,
      model,
      apiKey: userConfig.llmApiKey,
      baseUrl: userConfig.llmBaseUrl || PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.volcengine,
    }
  }

  // 2. 没有用户配置，尝试全局 ApiKey
  const globalProviders = ['deepseek', 'openai', 'volcengine', 'siliconflow']
  for (const provider of globalProviders) {
    const keyRecord = await prisma.apiKey.findUnique({ where: { provider } })
    if (keyRecord?.keyValue) {
      const model = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o'
      // 验证能力
      if (requiredCapabilities && requiredCapabilities.length > 0) {
        const allSupported = requiredCapabilities.every((cap) =>
          capabilityRegistry.supports(provider, model, cap),
        )
        if (!allSupported) continue
      }
      return {
        provider,
        model,
        apiKey: keyRecord.keyValue,
        baseUrl: PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.deepseek,
      }
    }
  }

  // 3. 没有任何可用配置
  throw new Error(`No LLM API key configured for user ${userId}. Please configure LLM provider in user settings.`)
}

/**
 * 获取 provider 对应的 base URL（含自定义覆盖）
 */
export function getBaseUrl(provider: string, customBaseUrl?: string | null): string {
  if (customBaseUrl) return customBaseUrl
  return PROVIDER_BASE_URLS[provider] || PROVIDER_BASE_URLS.deepseek
}
