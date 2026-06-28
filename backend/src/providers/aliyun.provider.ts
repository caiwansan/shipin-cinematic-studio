/**
 * providers/aliyun.provider.ts — 阿里百炼 ProviderLifecycle
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'aliyun',
  name: '阿里百炼',
  type: 'cloud',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  icon: 'aliyun',
  docsUrl: 'https://help.aliyun.com/product/2400256.html',
  description: '阿里云百炼大模型平台，支持通义系列、Wan 视频和图片生成',
  models: [
    { id: 'aliyun-llm', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 131072, description: '通义千问 Turbo' },
    { id: 'qwen-turbo', capabilities: ['llm'], description: '通义千问 Turbo' },
    { id: 'qwen-plus', capabilities: ['llm'], description: '通义千问 Plus' },
    { id: 'wan-image', capabilities: ['image'], defaultForCapability: 'image', description: 'Wan 图片生成' },
    { id: 'qwen-image', capabilities: ['image'], description: '通义万相图片生成' },
    { id: 'aliyun-video', capabilities: ['video'], defaultForCapability: 'video', description: '阿里视频生成' },
    { id: 'aliyun-tts', capabilities: ['tts'], defaultForCapability: 'tts', description: '阿里语音合成' },
  ],
}

export const aliyunProvider: ProviderLifecycle = {
  id: 'aliyun',
  name: '阿里百炼',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('aliyun-llm')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-ali-${Date.now()}`,
      userId: '__verify__',
      provider: 'aliyun',
      model: 'aliyun-llm',
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
        capabilities: ['llm', 'image', 'video', 'tts'],
      }
    } catch {
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm', 'image', 'video', 'tts'],
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
    return ['llm', 'image', 'video', 'tts']
  },

  defaultModel(capability: Capability): string {
    const m = METADATA.models.find(m => m.defaultForCapability === capability)
    return m?.id || ''
  },
}
