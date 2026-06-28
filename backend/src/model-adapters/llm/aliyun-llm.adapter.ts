/**
 * model-adapters/llm/aliyun-llm.adapter.ts
 *
 * 阿里百炼 LLM 适配器（千问系列）
 *
 * 支持的模型:
 *   qwen3-max, qwen3-plus, qwen3-flash, qwen3.6-plus, qwen3.6-flash
 *   qwq-32b, qvq-72b
 *   deepseek-v4-pro, deepseek-v4-flash (百炼上的 DS)
 *   kimi-k2.6, glm-5.1
 *
 * 端点: POST /compatible-mode/v1/chat/completions
 *   或自定义 baseUrl
 * 格式: OpenAI 兼容
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

/** 阿里百炼支持的 LLM 模型 */
const ALIYUN_LLM_MODELS = [
  'qwen3', 'qwen3.6', 'qwen3.5', 'qwen-max', 'qwen-plus', 'qwen-turbo',
  'qwq', 'qvq',
  'deepseek-v4', 'deepseek-v3',
  'kimi', 'glm',
]

export const aliyunLlmAdapter: ModelAdapter = {
  name: 'aliyun-llm',
  supportedModels: [
    ...ALIYUN_LLM_MODELS.map(m => m),
    'qwen*', 'qwq*', 'qvq*', 'deepseek-v*', 'kimi*', 'glm*', 'mimo*', 'minimax*',
  ],
  taskTypes: ['llm'],
  provider: 'aliyun',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('阿里百炼 API Key 未配置')

    const model = input.model || ''
    const baseUrl = input.baseUrl || runtime.baseURL || DEFAULT_ENDPOINT
    const messages: any[] = []

    if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt })
    if (input.userMessage) {
      messages.push({ role: 'user', content: [{ type: 'text', text: input.userMessage }] })
    } else if (input.prompt) {
      messages.push({ role: 'user', content: [{ type: 'text', text: input.prompt }] })
    }

    console.log(`[AliyunLLM] model=${model}, messages=${messages.length}`)

    const body: any = { model, messages, stream: false }
    if (input.temperature !== undefined) body.temperature = input.temperature
    if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) throw new Error(`阿里百炼 LLM 失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    return {
      content: data?.choices?.[0]?.message?.content || '',
      totalTokens: data?.usage?.total_tokens,
      provider: 'aliyun',
    }
  },
}
