/**
 * providers/deepseek.provider.ts — DeepSeek ProviderLifecycle
 *
 * 复用 ModelAdapter 做轻量验证。
 * 不动 Frozen Core。
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'
import { classifyAdapterError } from './error-classifier.js'

const METADATA: ProviderMetadata = {
  id: 'deepseek',
  name: 'DeepSeek',
  type: 'cloud',
  baseURL: 'https://api.deepseek.com/v1',
  icon: 'deepseek',
  docsUrl: 'https://platform.deepseek.com/docs',
  description: 'DeepSeek 大语言模型，支持 V3 和 R1',
  models: [
    { id: 'deepseek-chat', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 65536, description: 'DeepSeek V4 Flash' },
    { id: 'deepseek-reasoner', capabilities: ['llm'], contextWindow: 65536, description: 'DeepSeek R1 推理模型' },
  ],
}

export const deepseekProvider: ProviderLifecycle = {
  id: 'deepseek',
  name: 'DeepSeek',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('deepseek-chat')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-ds-${Date.now()}`,
      userId: '__verify__',
      provider: 'deepseek',
      model: 'deepseek-chat',
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
        availableModels: ['deepseek-chat', 'deepseek-reasoner'],
        capabilities: ['llm'],
      }
    } catch (err) {
      const classified = classifyAdapterError(err)
      console.log(`[DeepSeek Verify] Error classified: ${classified.code} (from: ${(err as any)?.message?.slice(0, 80)})`)
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm'],
        _error: classified,
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
    return ['llm']
  },

  defaultModel(capability: Capability): string {
    return capability === 'llm' ? 'deepseek-chat' : ''
  },
}
