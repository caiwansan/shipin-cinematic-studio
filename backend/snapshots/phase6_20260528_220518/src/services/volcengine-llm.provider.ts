/**
 * 火山引擎 LLM Provider（兼容 OpenAI 格式，通过 ARK 服务）
 *
 * endpoint: https://ark.cn-beijing.volces.com/api/v3
 * 支持模型：doubao-seed-2-0-mini-260428 / doubao-seed-2-0-plus-260428 / doubao-1.5-pro-256k
 *
 * 文档: https://www.volcengine.com/docs/82379/1182001
 */

import { env } from '../config/env.js'
import { getRuntimeContext } from './runtime-context.js'

function getApiKey(): string {
  return (getRuntimeContext() as any)?.secrets?.volcengineApiKey || ''
}

const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

interface VolcengineLLMRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

interface VolcengineLLMResponse {
  content: string
  usage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
  }
  model: string
}

export const volcengineLLM = {
  /**
   * 支持的模型列表
   */
  supportedModels: [
    'doubao-seed-2-0-mini-260428',
    'doubao-seed-2-0-plus-260428',
    'doubao-1.5-pro-256k',
    'doubao-1.5-pro-32k',
  ],

  /**
   * 调用火山引擎 LLM（兼容 OpenAI Chat Completions 格式）
   */
  async chat(params: VolcengineLLMRequest): Promise<VolcengineLLMResponse> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('VOLCENGINE_API_KEY not configured')

    const model = params.model || 'doubao-seed-2-0-plus-260428'
    const body: Record<string, any> = {
      model,
      messages: params.messages,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.1,
      stream: false,
    }

    console.log(`[VolcengineLLM] Calling ${model} with ${params.messages.length} messages`)

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      const errText = await res.text()
      // 火山引擎 401 时返回的格式特殊，提取关键信息
      const msg = errText.length > 200 ? errText.substring(0, 200) + '...' : errText
      throw new Error(`火山引擎 LLM 调用失败 (${res.status}): ${msg}`)
    }

    const data = await res.json()

    if (!data.choices || !data.choices.length) {
      throw new Error(`火山引擎 LLM 响应异常: ${JSON.stringify(data).substring(0, 200)}`)
    }

    return {
      content: data.choices[0].message?.content || '',
      usage: {
        totalTokens: data.usage?.total_tokens || 0,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
      model: data.model || model,
    }
  },

  /**
   * 流式调用（Server-Sent Events）
   */
  async chatStream(params: VolcengineLLMRequest, onChunk: (chunk: string) => void): Promise<VolcengineLLMResponse> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('VOLCENGINE_API_KEY not configured')

    const model = params.model || 'doubao-seed-2-0-plus-260428'
    const body: Record<string, any> = {
      model,
      messages: params.messages,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.1,
      stream: true,
    }

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      const msg = errText.length > 200 ? errText.substring(0, 200) + '...' : errText
      throw new Error(`火山引擎 LLM 流式调用失败 (${res.status}): ${msg}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('Response body is null')

    const decoder = new TextDecoder()
    let fullContent = ''
    let usage = { totalTokens: 0, promptTokens: 0, completionTokens: 0 }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const jsonStr = line.slice(6).trim()
          if (jsonStr === '[DONE]') continue

          try {
            const data = JSON.parse(jsonStr)
            const delta = data.choices?.[0]?.delta?.content
            if (delta) {
              fullContent += delta
              onChunk(delta)
            }
            if (data.usage) {
              usage = {
                totalTokens: data.usage.total_tokens || 0,
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      content: fullContent,
      usage,
      model,
    }
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};
