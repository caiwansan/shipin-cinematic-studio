/**
 * providers/volcengine.provider.ts — 火山引擎 ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'volcengine',
  name: '火山引擎',
  type: 'cloud',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  icon: 'volcengine',
  docsUrl: 'https://www.volcengine.com/docs/82379',
  description: '火山引擎大模型平台，支持豆包系列模型、SeedDream 图片和视频生成',
  models: [
    { id: 'volcengine-llm', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 131072, description: '豆包 Pro' },
    { id: 'deepseek-r1-250120', capabilities: ['llm'], description: 'DeepSeek R1 (火山部署)' },
    { id: 'seedream-image', capabilities: ['image'], defaultForCapability: 'image', description: 'SeedDream 图片生成' },
    { id: 'volcengine-video', capabilities: ['video'], defaultForCapability: 'video', description: '火山视频生成' },
    { id: 'volcengine-tts', capabilities: ['tts'], defaultForCapability: 'tts', description: '火山语音合成' },
  ],
}

export const volcengineProvider: ProviderLifecycle = {
  id: 'volcengine',
  name: '火山引擎',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    // 用 LLM 轻量验证（最快最便宜）
    const adapter = modelAdapterRegistry.findAdapter('volcengine-llm')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-volc-${Date.now()}`,
      userId: '__verify__',
      provider: 'volcengine',
      model: 'volcengine-llm',
      taskType: 'llm',
      apiKey,
      baseURL,
      metadata: { purpose: 'key-verification' },
    }

    const start = Date.now()
    try {
      await adapter.execute(runtime, {
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 1,
        temperature: 0,
      } as any)
      return {
        success: true,
        latency: Date.now() - start,
        availableModels: METADATA.models.map(m => m.id),
        capabilities: ['llm', 'image', 'video', 'tts'],
      }
    } catch {
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm', 'image', 'video', 'tts'],
      }
    }
  },

  async health() {
    return {
      status: 'healthy',
      latency: 0,
      lastChecked: new Date().toISOString(),
      successRate: 1.0,
    }
  },

  async models() {
    return METADATA.models
  },

  capabilities(): Capability[] {
    return ['llm', 'image', 'video', 'tts']
  },

  defaultModel(capability: Capability): string {
    const m = METADATA.models.find(m => m.defaultForCapability === capability)
    return m?.id || ''
  },
}
