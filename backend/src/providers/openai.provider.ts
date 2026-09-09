/**
 * providers/openai.provider.ts — OpenAI ProviderLifecycle
 * 修复: 使用官方模型ID (2026-09-07)
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
  description: 'OpenAI 官方 API，支持 GPT-4 系列、o1/o3 推理和 DALL·E',
  models: [
    { id: 'gpt-4o-mini', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 128000, description: 'GPT-4o Mini' },
    { id: 'gpt-4o', capabilities: ['llm'], contextWindow: 128000, description: 'GPT-4o' },
    { id: 'gpt-4-turbo', capabilities: ['llm'], contextWindow: 128000, description: 'GPT-4 Turbo' },
    { id: 'gpt-4', capabilities: ['llm'], contextWindow: 8192, description: 'GPT-4' },
    { id: 'gpt-3.5-turbo', capabilities: ['llm'], contextWindow: 16384, description: 'GPT-3.5 Turbo' },
    { id: 'o1-preview', capabilities: ['llm'], contextWindow: 128000, description: 'o1 Preview (推理)' },
    { id: 'o1-mini', capabilities: ['llm'], contextWindow: 128000, description: 'o1 Mini (推理)' },
    { id: 'o3-mini', capabilities: ['llm'], contextWindow: 200000, description: 'o3 Mini (推理)' },
    { id: 'dall-e-3', capabilities: ['image'], defaultForCapability: 'image', contextWindow: 0, description: 'DALL·E 3' },
  ],
}

export const openaiProvider: ProviderLifecycle = {
  id: 'openai',
  name: 'OpenAI',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('gpt-4o-mini')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-oai-${Date.now()}`,
      userId: '__verify__',
      provider: 'openai',
      model: 'gpt-4o-mini',
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

