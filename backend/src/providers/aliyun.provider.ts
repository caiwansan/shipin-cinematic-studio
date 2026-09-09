/**
 * providers/aliyun.provider.ts — 阿里百炼 ProviderLifecycle
 * 修复: 使用官方模型ID (2026-09-07)
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
    { id: 'qwen3-max', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 131072, description: '通义千问 3 Max' },
    { id: 'qwen3-plus', capabilities: ['llm'], contextWindow: 131072, description: '通义千问 3 Plus' },
    { id: 'qwen3-flash', capabilities: ['llm'], contextWindow: 131072, description: '通义千问 3 Flash' },
    { id: 'qwen3.6-plus', capabilities: ['llm'], contextWindow: 131072, description: '通义千问 3.6 Plus' },
    { id: 'qwen3.6-flash', capabilities: ['llm'], contextWindow: 131072, description: '通义千问 3.6 Flash' },
    { id: 'qwq-32b', capabilities: ['llm'], contextWindow: 32768, description: 'QwQ 32B 推理模型' },
    { id: 'qvq-72b', capabilities: ['llm'], contextWindow: 131072, description: 'QVQ 72B 视觉推理' },
    { id: 'deepseek-v4-pro', capabilities: ['llm'], contextWindow: 131072, description: 'DeepSeek V4 Pro (百炼)' },
    { id: 'deepseek-v4-flash', capabilities: ['llm'], contextWindow: 131072, description: 'DeepSeek V4 Flash (百炼)' },
    { id: 'wanx2.7-t2v', capabilities: ['video'], defaultForCapability: 'video', contextWindow: 0, description: 'Wan 2.7 文生视频' },
    { id: 'wanx2.7-i2v', capabilities: ['video'], contextWindow: 0, description: 'Wan 2.7 图生视频' },
    { id: 'wanx-v1', capabilities: ['image'], defaultForCapability: 'image', contextWindow: 0, description: '通义万相图片生成' },
    { id: 'qwen3-tts', capabilities: ['tts'], defaultForCapability: 'tts', contextWindow: 0, description: '通义千问 TTS' },
  ],
}

export const aliyunProvider: ProviderLifecycle = {
  id: 'aliyun',
  name: '阿里百炼',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('qwen3-max')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-ali-${Date.now()}`,
      userId: '__verify__',
      provider: 'aliyun',
      model: 'qwen3-max',
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

