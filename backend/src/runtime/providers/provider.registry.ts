/**
 * Provider Registry — LLM + Image providers
 *
 * ◆ 仅保留 provider 名称、适配器和 baseUrl 等基础设施配置
 * ◆ 模型列表不做硬编码，全部从 RouteConfig 表 / 用户配置读取
 * ◆ call({model}) 时 model 参数始终来自 DB 用户配置
 * ◆ getProviderForModel() 返回 undefined（空模型列表）
 *   → 调用方直接用 getProvider(name) 按 provider 名称定位
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
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    // 模型列表从 RouteConfig 表读取，此处留空数组（无硬编码）
    models: [],
  }))
  // 阿里百炼（DashScope）— OpenAI 兼容接口（通义千问）
  registerProvider(new OpenAIProvider({
    name: 'bailian',
    apiKey: '',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [],
  }))
  // 龙猫（LongCat）— OpenAI 兼容接口
  registerProvider(new OpenAIProvider({
    name: 'longcat',
    apiKey: '',
    baseUrl: 'https://api.longcat.chat/openai/v1',
    models: [],
  }))
}

/**
 * 刷新所有 OpenAI 兼容 provider 的 API Key（每次调用前）
 * injectUserApiKey 修改 env 后，需要同步到 provider 对象
 */
export function refreshProviderApiKeys(): void {
  const envMap: Record<string, { keyEnv: string; modelEnv: string }> = {
    volcengine: { keyEnv: 'VOLCENGINE_API_KEY', modelEnv: 'VOLCENGINE_LLM_MODEL' },
    bailian: { keyEnv: 'ALIYUN_API_KEY', modelEnv: 'ALIYUN_LLM_MODEL' },
    longcat: { keyEnv: 'LONGCAT_API_KEY', modelEnv: 'LONGCAT_LLM_MODEL' },
    siliconflow: { keyEnv: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_LLM_MODEL' },
    deepseek: { keyEnv: 'DEEPSEEK_API_KEY', modelEnv: 'DEEPSEEK_LLM_MODEL' },
  }
  for (const [name, env] of Object.entries(envMap)) {
    const p = providers.get(name)
    if (!p) continue
    const envKey = process.env[env.keyEnv] || ''
    if (envKey) {
      ;(p as any).apiKey = envKey
    }
    // 模型名仅通过 process.env 刷新，不再依赖硬编码种子列表
    const model = process.env[env.modelEnv]
    if (model) {
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
  console.log(`[providers] registered LLM: ${provider.name}`)
}

export function getProvider(name: string): LLMProvider | undefined {
  return providers.get(name)
}

/**
 * 反向查找：根据模型名找 provider
 * ◆ 模型列表已从代码中移除，此函数不再可靠，仅保留导出以防上游引用报错
 * ◆ 调用方应按 provider 名称直接调用 getProvider()
 */
export function getProviderForModel(_model: string): LLMProvider | undefined {
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
