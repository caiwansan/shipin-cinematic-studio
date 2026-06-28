/**
 * providers/siliconflow.provider.ts — 硅基流动 ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'siliconflow',
  name: '硅基流动',
  type: 'cloud',
  baseURL: 'https://api.siliconflow.cn/v1',
  icon: 'siliconflow',
  docsUrl: 'https://docs.siliconflow.cn/docs',
  description: '硅基流动大模型平台，支持 DeepSeek 等开源模型',
  models: [
    { id: 'siliconflow-llm', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 32768, description: 'DeepSeek V3 (硅基部署)' },
    { id: 'siliconflow-image', capabilities: ['image'], defaultForCapability: 'image', description: '硅基图片生成' },
    { id: 'siliconflow-tts', capabilities: ['tts'], defaultForCapability: 'tts', description: '硅基语音合成' },
  ],
}

export const siliconflowProvider: ProviderLifecycle = {
  id: 'siliconflow',
  name: '硅基流动',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('siliconflow-llm')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-sf-${Date.now()}`,
      userId: '__verify__',
      provider: 'siliconflow',
      model: 'siliconflow-llm',
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
        capabilities: ['llm', 'image', 'tts'],
      }
    } catch {
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm', 'image', 'tts'],
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
    return ['llm', 'image', 'tts']
  },

  defaultModel(capability: Capability): string {
    const m = METADATA.models.find(m => m.defaultForCapability === capability)
    return m?.id || ''
  },
}
