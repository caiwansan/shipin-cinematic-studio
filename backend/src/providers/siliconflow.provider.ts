/**
 * providers/siliconflow.provider.ts — 硅基流动 ProviderLifecycle
 * 修复: 使用官方模型ID (2026-09-07)
 */

import type { ProviderLifecycle, ProviderMetadata, ProviderHealth, ModelInfo, Capability } from '../runtime/provider-registry.js'
import { modelAdapterRegistry } from '../model-adapters/registry.js'

const METADATA: ProviderMetadata = {
  id: 'siliconflow',
  name: '硅基流动',
  type: 'cloud',
  baseURL: 'https://api.siliconflow.cn/v1',
  icon: 'siliconflow',
  docsUrl: 'https://docs.siliconflow.cn/docs',
  description: '硅基流动大模型平台，支持 DeepSeek、Qwen、GLM 等开源模型',
  models: [
    { id: 'deepseek-ai/DeepSeek-V3', capabilities: ['llm'], defaultForCapability: 'llm', contextWindow: 65536, description: 'DeepSeek V3 (硅基)' },
    { id: 'deepseek-ai/DeepSeek-R1', capabilities: ['llm'], contextWindow: 65536, description: 'DeepSeek R1 (硅基)' },
    { id: 'deepseek-ai/DeepSeek-V2.5', capabilities: ['llm'], contextWindow: 32768, description: 'DeepSeek V2.5 (硅基)' },
    { id: 'Qwen/Qwen2.5-72B-Instruct', capabilities: ['llm'], contextWindow: 32768, description: 'Qwen 2.5 72B (硅基)' },
    { id: 'Qwen/Qwen2.5-32B-Instruct', capabilities: ['llm'], contextWindow: 32768, description: 'Qwen 2.5 32B (硅基)' },
    { id: 'Qwen/Qwen2.5-14B-Instruct', capabilities: ['llm'], contextWindow: 32768, description: 'Qwen 2.5 14B (硅基)' },
    { id: 'Qwen/Qwen2.5-7B-Instruct', capabilities: ['llm'], contextWindow: 32768, description: 'Qwen 2.5 7B (硅基)' },
    { id: 'THUDM/glm-4-9b-chat', capabilities: ['llm'], contextWindow: 8192, description: 'GLM-4 9B (硅基)' },
    { id: 'Pro/Qwen/Qwen2.5-7B-Instruct', capabilities: ['llm'], contextWindow: 32768, description: 'Qwen 2.5 7B Pro (硅基)' },
    { id: 'stabilityai/stable-diffusion-xl-base-1.0', capabilities: ['image'], defaultForCapability: 'image', contextWindow: 0, description: 'SDXL 图片生成' },
    { id: 'FunAudioLLM/CosyVoice2-0.5B', capabilities: ['tts'], defaultForCapability: 'tts', contextWindow: 0, description: 'CosyVoice TTS' },
  ],
}

export const siliconflowProvider: ProviderLifecycle = {
  id: 'siliconflow',
  name: '硅基流动',
  metadata: METADATA,

  async verify(apiKey: string, baseURL?: string) {
    const adapter = modelAdapterRegistry.findAdapter('deepseek-ai/DeepSeek-V3')
    if (!adapter) {
      return { success: false, latency: 0, availableModels: [], capabilities: [] }
    }

    const runtime = {
      requestId: `verify-sf-${Date.now()}`,
      userId: '__verify__',
      provider: 'siliconflow',
      model: 'deepseek-ai/DeepSeek-V3',
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
        capabilities: ['llm', 'image', 'tts'],
      }
    } catch {
      return {
        success: false,
        latency: Date.now() - start,
        availableModels: [],
        capabilities: ['llm', 'image', 'tts'],
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
    return ['llm', 'image', 'tts']
  },

  defaultModel(capability: Capability): string {
    const m = METADATA.models.find(m => m.defaultForCapability === capability)
    return m?.id || ''
  },
}

