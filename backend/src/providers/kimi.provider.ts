/**
 * providers/kimi.provider.ts — Kimi ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'kimi',
  name: 'Kimi',
  type: 'cloud',
  baseURL: 'https://api.moonshot.cn/v1',
  icon: 'kimi',
  docsUrl: '',
  description: '月之暗面 Kimi 大模型，超长上下文与深度推理能力',
  models: [
    { id: 'moonshot-v1-128k', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 128000, description: 'Kimi v1 128K' },
    { id: 'moonshot-v1-32k', capabilities: ['llm'], contextWindow: 32000, description: 'Kimi v1 32K' },
    { id: 'moonshot-v1-8k', capabilities: ['llm'], contextWindow: 8000, description: 'Kimi v1 8K' },
  ],
}

export const kimiProvider: ProviderLifecycle = {
  id: 'kimi',
  name: 'Kimi',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('moonshot-v1-128k')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-kimi-${Date.now()}`,
      userId: '__verify__',
      provider: 'kimi',
      model: 'moonshot-v1-128k',
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
