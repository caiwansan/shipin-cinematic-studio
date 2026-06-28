/**
 * Provider Registry — LLM + Image providers
 * 只保留：DeepSeek、火山引擎（豆包）、阿里百炼
 */

import type { LLMProvider } from './base.provider.js'
import type { ImageGenProvider } from './image.base.provider.js'
import { DeepSeekProvider } from './deepseek.provider.js'
import { OpenAIProvider } from './openai.provider.js'

// ============================================================
// LLM Registry
// ============================================================

const providers = new Map<string, LLMProvider>()

function init() {
  registerProvider(new DeepSeekProvider())
  // 火山引擎（豆包）— OpenAI 兼容接口
  registerProvider(new OpenAIProvider({
    name: 'volcengine',
    apiKey: '',  // 运行时从 env 动态读取，见 getProvider/refreshApiKeys
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-2-0-mini-260428'],
  }))
  // 阿里百炼（DashScope）— OpenAI 兼容接口（通义千问）
  registerProvider(new OpenAIProvider({
    name: 'bailian',
    apiKey: '',  // 运行时从 env 动态读取
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
  }))
}

/**
 * 刷新所有 OpenAI 兼容 provider 的 API Key（每次调用前）
 * injectUserApiKey 修改 env 后，需要同步到 provider 对象
 */
export function refreshProviderApiKeys(): void {
  const envMap: Record<string, { keyEnv: string; modelEnv: string }> = {
    volcengine: { keyEnv: 'VOLCENGINE_API_KEY', modelEnv: 'VOLCENGINE_LLM_MODEL' },
    bailian: { keyEnv: 'BAILIAN_API_KEY', modelEnv: 'BAILIAN_LLM_MODEL' },
    siliconflow: { keyEnv: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_LLM_MODEL' },
    deepseek: { keyEnv: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_LLM_MODEL' },
  }
  for (const [name, env] of Object.entries(envMap)) {
    const p = providers.get(name)
    if (!p) continue
    const envKey = process.env[env.keyEnv] || ''
    if (p.name === 'deepseek') {
      ;(p as any)._customApiKey = envKey
    } else {
      ;(p as any)._customApiKey = envKey
    }
    const model = process.env[env.modelEnv]
    if (model && model !== p.models[0]) {
      p.models = [model]
    }
  }
}

// ============================================================
// Image Provider Registry
// ============================================================

const imageProviders = new Map<string, ImageGenProvider>()

export function registerImageProvider(provider: ImageGenProvider): void {
  imageProviders.set(provider.name, provider)
  console.log(`[providers] registered Image: ${provider.name}`)
}

export function getImageProvider(name: string): ImageGenProvider | undefined {
  return imageProviders.get(name)
}

export function listImageProviders(): string[] {
  return [...imageProviders.keys()]
}

export function registerProvider(provider: LLMProvider): void {
  providers.set(provider.name, provider)
  console.log(`[providers] registered LLM: ${provider.name} (${provider.models.join(', ')})`)
}

export function getProvider(name: string): LLMProvider | undefined {
  return providers.get(name)
}

export function getProviderForModel(model: string): LLMProvider | undefined {
  for (const p of providers.values()) {
    if (p.models.includes(model)) return p
  }
  return undefined
}

export function listProviders(): string[] {
  return [...providers.keys()]
}

// Init on load
init()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

