/**
 * providers/xinghuo.provider.ts — 讯飞星火 ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'xinghuo',
  name: '讯飞星火',
  type: 'cloud',
  baseURL: 'https://spark-api.xf-yun.com/v3.5/chat',
  icon: 'xinghuo',
  docsUrl: '',
  description: '科大讯飞星火大模型，语音与文本多模态能力',
  models: [
    { id: 'spark-4.0', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 8192, description: '星火 4.0' },
    { id: 'spark-3.5', capabilities: ['llm'], contextWindow: 8192, description: '星火 3.5' },
    { id: 'spark-lite', capabilities: ['llm'], contextWindow: 8192, description: '星火 Lite' },
  ],
}

export const xinghuoProvider: ProviderLifecycle = {
  id: 'xinghuo',
  name: '讯飞星火',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('spark-4.0')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-xinghuo-${Date.now()}`,
      userId: '__verify__',
      provider: 'xinghuo',
      model: 'spark-4.0',
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
        capabilities: ['llm'],
      }
    } catch {
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm'],
      }
    }
  },

  async health() {
    return { status: 'healthy', latency: 0, lastChecked: new Date().toISOString(), successRate: 1.0 }
  },

  async models() { return METADATA.models },

  capabilities(): Capability[] { return ['llm'] },

  defaultModel(capability: Capability): string {
    const m = METADATA.models.find(m => m.defaultForCapability === capability)
    return m?.id || ''
  },
}
