/**
 * model-adapters/llm/volcengine-llm.adapter.ts
 *
 * 火山引擎 LLM 适配器（Doubao 系列）
 *
 * 支持的模型:
 *   doubao-1-5-pro-256k-250115
 *   doubao-1-5-lite-32k-250115
 *   doubao-pro-32k, doubao-pro-128k
 *   doubao-lite-32k, doubao-lite-128k
 *   deepseek-r1-250120
 *
 * 端点: POST /api/v3/chat/completions
 * 格式: 与 OpenAI 兼容
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const DEFAULT_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

const DOUBAO_MODEL_PREFIXES = ['doubao', 'deepseek-r1', 'deepseek-v1', 'deepseek-v3']

export const volcengineLlmAdapter: ModelAdapter = {
  name: 'volcengine-llm',
  supportedModels: ['doubao*', 'deepseek-r1*'],
  taskTypes: ['llm'],
  provider: 'volcengine',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('火山引擎 API Key 未配置')

    const model = input.model || ''
    const baseUrl = input.baseUrl || DEFAULT_ENDPOINT
    const messages: any[] = []

    if (input.systemPrompt) messages.push({ role: 'system', content: input.systemPrompt })
    if (input.userMessage) {
      messages.push({ role: 'user', content: [{ type: 'text', text: input.userMessage }] })
    } else if (input.prompt) {
      messages.push({ role: 'user', content: [{ type: 'text', text: input.prompt }] })
    }

    console.log(`[VolcLLM] model=${model}, messages=${messages.length}`)

    const body: any = { model, messages, stream: false }
    if (input.temperature !== undefined) body.temperature = input.temperature
    if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) throw new Error(`火山引擎 LLM 失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    return {
      content: data?.choices?.[0]?.message?.content || '',
      totalTokens: data?.usage?.total_tokens,
      provider: 'volcengine',
    }
  },
}
