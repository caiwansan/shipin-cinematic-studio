/**
 * providers/claude.provider.ts — Anthropic Claude ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'claude',
  name: 'Claude',
  type: 'cloud',
  baseURL: 'https://api.anthropic.com',
  icon: 'claude',
  docsUrl: 'https://docs.anthropic.com',
  description: 'Anthropic Claude 系列模型，深度推理、长文本与代码能力出色',
  models: [
    { id: 'claude-sonnet-4-20250514', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 200000, description: 'Claude Sonnet 4' },
    { id: 'claude-3-opus-20240229', capabilities: ['llm'], contextWindow: 200000, description: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', capabilities: ['llm'], contextWindow: 200000, description: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', capabilities: ['llm'], contextWindow: 200000, description: 'Claude 3 Haiku' },
  ],
}

export const claudeProvider: ProviderLifecycle = {
  id: 'claude',
  name: 'Claude',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('claude-sonnet-4-20250514')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }
    const runtime = {
      requestId: `verify-claude-${Date.now()}`,
      userId: '__verify__',
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
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
