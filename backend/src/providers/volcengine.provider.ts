/**
 * providers/volcengine.provider.ts — 火山引擎 ProviderLifecycle
 * 修复: 使用官方模型ID (2026-09-07)
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'volcengine',
  name: '火山引擎',
  type: 'cloud',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  icon: 'volcengine',
  docsUrl: 'https://www.volcengine.com/docs/82379',
  description: '火山引擎大模型平台，支持豆包系列模型、SeedDream 图片和视频生成',
  models: [
    { id: 'doubao-1-5-pro-256k-250115', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 262144, description: '豆包 1.5 Pro 256K' },
    { id: 'doubao-1-5-lite-32k-250115', capabilities: ['llm'], contextWindow: 32768, description: '豆包 1.5 Lite 32K' },
    { id: 'doubao-pro-32k', capabilities: ['llm'], contextWindow: 32768, description: '豆包 Pro 32K' },
    { id: 'doubao-pro-128k', capabilities: ['llm'], contextWindow: 131072, description: '豆包 Pro 128K' },
    { id: 'doubao-lite-32k', capabilities: ['llm'], contextWindow: 32768, description: '豆包 Lite 32K' },
    { id: 'doubao-lite-128k', capabilities: ['llm'], contextWindow: 131072, description: '豆包 Lite 128K' },
    { id: 'deepseek-r1-250120', capabilities: ['llm'], contextWindow: 131072, description: 'DeepSeek R1 (火山部署)' },
    { id: 'doubao-seedream-3-0-t2i-250715', capabilities: ['image'], defaultForCapability: 'image', contextWindow: 0, description: 'SeedDream 图片生成' },
    { id: 'doubao-seedance-1-0-pro-250528', capabilities: ['video'], defaultForCapability: 'video', contextWindow: 0, description: 'Seedance 1.0 视频生成' },
  ],
}

export const volcengineProvider: ProviderLifecycle = {
  id: 'volcengine',
  name: '火山引擎',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('doubao-1-5-pro-256k-250115')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-volc-${Date.now()}`,
      userId: '__verify__',
      provider: 'volcengine',
      model: 'doubao-1-5-pro-256k-250115',
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
        capabilities: ['llm', 'image', 'video'],
      }
    } catch {
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm', 'image', 'video'],
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
    return ['llm', 'image', 'video']
  },

  defaultModel(capability: Capability): string {
    const m = METADATA.models.find(m => m.defaultForCapability === capability)
    return m?.id || ''
  },
}

