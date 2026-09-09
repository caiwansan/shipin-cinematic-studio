/**
 * providers/longcat.provider.ts — LongCat (龙猫) ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'longcat',
  name: 'LongCat',
  type: 'cloud',
  baseURL: 'https://api.longcat.chat/openai/v1',
  icon: 'longcat',
  docsUrl: 'https://api.longcat.chat',
  description: 'LongCat 大模型，OpenAI 兼容格式，支持长文本对话',
  models: [
    { id: 'LongCat-2.0', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 131072, description: 'LongCat 2.0' },
  ],
}

export const longcatProvider: ProviderLifecycle = {
  id: 'longcat',
  name: 'LongCat',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('LongCat-2.0')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-longcat-${Date.now()}`,
      userId: '__verify__',
      provider: 'longcat',
      model: 'LongCat-2.0',
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
