/**
 * providers/openai.provider.ts — OpenAI ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'openai',
  name: 'OpenAI',
  type: 'cloud',
  baseURL: 'https://api.openai.com/v1',
  icon: 'openai',
  docsUrl: 'https://platform.openai.com/docs',
  description: 'OpenAI 官方 API，支持 GPT-4 系列和 DALL·E',
  models: [
    { id: 'openai-compat', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 128000, description: 'GPT-4o Mini' },
    { id: 'gpt-4o-mini', capabilities: ['llm'], description: 'GPT-4o Mini' },
    { id: 'gpt-4o', capabilities: ['llm'], description: 'GPT-4o' },
    { id: 'dalle-image', capabilities: ['image'], defaultForCapability: 'image', description: 'DALL·E 3' },
  ],
}

export const openaiProvider: ProviderLifecycle = {
  id: 'openai',
  name: 'OpenAI',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('openai-compat')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-oa-${Date.now()}`,
      userId: '__verify__',
      provider: 'openai',
      model: 'openai-compat',
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
        capabilities: ['llm', 'image'],
      }
    } catch {
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm', 'image'],
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
    return ['llm', 'image']
  },

  defaultModel(capability: Capability): string {
    const m = METADATA.models.find(m => m.defaultForCapability === capability)
    return m?.id || ''
  },
}
