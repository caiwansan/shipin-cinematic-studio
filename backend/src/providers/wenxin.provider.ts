/**
 * providers/wenxin.provider.ts — 文心一言 ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'wenxin',
  name: '文心一言',
  type: 'cloud',
  baseURL: 'https://aip.baidubce.com/rpc/2.0/ai_custom',
  icon: 'wenxin',
  docsUrl: '',
  description: '百度文心大模型，中文理解与创作能力强',
  models: [
    { id: 'ernie-4.0', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 8192, description: '文心一言 4.0' },
    { id: 'ernie-3.5', capabilities: ['llm'], contextWindow: 8192, description: '文心一言 3.5' },
    { id: 'ernie-lite', capabilities: ['llm'], contextWindow: 8192, description: '文心一言 Lite' },
  ],
}

export const wenxinProvider: ProviderLifecycle = {
  id: 'wenxin',
  name: '文心一言',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('ernie-4.0')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-wenxin-${Date.now()}`,
      userId: '__verify__',
      provider: 'wenxin',
      model: 'ernie-4.0',
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
