/**
 * providers/yuanbao.provider.ts — 腾讯元宝 ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'yuanbao',
  name: '腾讯元宝',
  type: 'cloud',
  baseURL: 'https://tokenhub.tencentmaas.com/v1',
  icon: 'yuanbao',
  docsUrl: '',
  description: '腾讯混元大模型，覆盖对话、创作、多模态理解',
  models: [
    { id: 'hy3-preview', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 32000, description: '混元 3 Preview' },
    { id: 'hy3-turbo', capabilities: ['llm'], contextWindow: 32000, description: '混元 3 Turbo' },
  ],
}

export const yuanbaoProvider: ProviderLifecycle = {
  id: 'yuanbao',
  name: '腾讯元宝',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('hy3-preview')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-yuanbao-${Date.now()}`,
      userId: '__verify__',
      provider: 'yuanbao',
      model: 'hy3-preview',
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
