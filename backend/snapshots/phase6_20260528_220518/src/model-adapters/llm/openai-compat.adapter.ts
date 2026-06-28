/**
 * model-adapters/llm/openai-compat.adapter.ts
 *
 * OpenAI 兼容格式 LLM 适配器（通用）
 *
 * 支持的 provider + 模型:
 *   deepseek    → deepseek-v4, deepseek-v3
 *   siliconflow → Qwen, deepseek-ai, THUDM, Yi
 *   openai      → gpt-4o, gpt-4, gpt-3.5-turbo, o1, o3
 *
 * 所有这些都走相同的 OpenAI 兼容格式:
 *   POST /v1/chat/completions
 *   body: { model, messages, stream, temperature, max_tokens }
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
}

export const openaiCompatLlmAdapter: ModelAdapter = {
  name: 'openai-compat-llm',
  supportedModels: [
    // DeepSeek
    'deepseek-v4*', 'deepseek-v3*', 'deepseek-chat*', 'deepseek-reasoner*',
    // 硅基流动
    'Qwen*', 'deepseek-ai*', 'THUDM*', 'Yi*', 'Pro/*',
    // OpenAI
    'gpt-4*', 'gpt-3.5*', 'o1*', 'o3*', 'dall-e*',
    // 自定义
    'custom*',
  ],
  taskTypes: ['llm'],
  provider: 'openai-compat',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const model = input.model || ''

    // Phase 2.5: 优先使用 runtime.apiKey（用户自有 Key），降级到 input.apiKey
    const apiKey = runtime.apiKey || input.apiKey || ''
    if (!apiKey) throw new Error(`LLM 模型 ${model} 无有效 API Key`)

    // 根据模型前缀确定 baseUrl
    let baseUrl: string = input.baseUrl || ''

    if (!baseUrl) {
      if (model.startsWith('deepseek-v4') || model.startsWith('deepseek-v3') || model.startsWith('deepseek-chat') || model.startsWith('deepseek-reasoner')) {
        baseUrl = BASE_URLS.deepseek
      } else if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) {
        baseUrl = BASE_URLS.openai
      } else if (model.startsWith('Qwen') || model.startsWith('deepseek-ai') || model.startsWith('THUDM') || model.startsWith('Yi') || model.startsWith('Pro/')) {
        baseUrl = BASE_URLS.siliconflow
      } else {
        baseUrl = BASE_URLS.siliconflow  // default to siliconflow
      }
    }

    // 用户自定义 baseUrl 覆盖
    if (input.baseUrl) baseUrl = input.baseUrl
    const messages: any[] = []
    if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt })
    if (input.userMessage) {
      messages.push({ role: 'user', content: [{ type: 'text', text: input.userMessage }] })
    } else if (input.prompt) {
      messages.push({ role: 'user', content: [{ type: 'text', text: input.prompt }] })
    }

    console.log(`[OpenAICompat-LLM] model=${model}, provider=${getProviderLabel(model)}, messages=${messages.length}`)

    const body: any = { model, messages, stream: false }
    if (input.temperature !== undefined) body.temperature = input.temperature
    if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) throw new Error(`${getProviderLabel(model)} LLM 失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    return {
      content: data?.choices?.[0]?.message?.content || '',
      totalTokens: data?.usage?.total_tokens,
      provider: getProviderLabel(model),
    }
  },
}

function getProviderLabel(model: string): string {
  if (model.startsWith('deepseek-v')) return 'DeepSeek'
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'OpenAI'
  if (model.startsWith('Qwen')) return '硅基流动'
  if (model.startsWith('deepseek-ai')) return '硅基流动'
  if (model.startsWith('THUDM')) return '硅基流动'
  if (model.startsWith('Yi')) return '硅基流动'
  if (model.startsWith('custom')) return '自定义'
  return 'OpenAI 兼容'
}
