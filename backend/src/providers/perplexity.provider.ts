/**
 * providers/perplexity.provider.ts — Perplexity ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'perplexity',
  name: 'Perplexity',
  type: 'cloud',
  baseURL: 'https://api.perplexity.ai',
  icon: 'perplexity',
  docsUrl: '',
  description: 'Perplexity AI 搜索增强大模型，实时联网搜索能力',
  models: [
    { id: 'sonar-pro', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 127000, description: 'Sonar Pro' },
    { id: 'sonar', capabilities: ['llm'], contextWindow: 127000, description: 'Sonar' },
  ],
}

export const perplexityProvider: ProviderLifecycle = {
  id: 'perplexity',
  name: 'Perplexity',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('sonar-pro')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-perplexity-${Date.now()}`,
      userId: '__verify__',
      provider: 'perplexity',
      model: 'sonar-pro',
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
