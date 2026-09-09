/**
 * providers/gemini.provider.ts — Gemini ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'gemini',
  name: 'Gemini',
  type: 'cloud',
  baseURL: 'https://generativelanguage.googleapis.com',
  icon: 'gemini',
  docsUrl: '',
  description: 'Google Gemini 多模态大模型，原生多模态理解与长上下文',
  models: [
    { id: 'gemini-2.5-pro-0325', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 1048576, description: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', capabilities: ['llm'], contextWindow: 1048576, description: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', capabilities: ['llm'], contextWindow: 1048576, description: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', capabilities: ['llm'], contextWindow: 1048576, description: 'Gemini 1.5 Flash' },
  ],
}

export const geminiProvider: ProviderLifecycle = {
  id: 'gemini',
  name: 'Gemini',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('gemini-2.5-pro-0325')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-gemini-${Date.now()}`,
      userId: '__verify__',
      provider: 'gemini',
      model: 'gemini-2.5-pro-0325',
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
