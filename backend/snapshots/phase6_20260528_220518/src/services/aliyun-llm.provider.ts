/**
 * 阿里百炼 LLM Provider（兼容 OpenAI 格式）
 *
 * endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1
 * 支持模型：qwen3.6-max-preview / qwen3.6-plus / qwen3.6-flash
 *
 * 文档: https://help.aliyun.com/zh/model-studio/getting-started/models
 */

import { env } from '../config/env.js'
import { getRuntimeContext } from './runtime-context.js'

function getApiKey(): string {
  return getRuntimeContext()?.secrets?.aliyunApiKey || ''
}

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

interface AliyunLLMRequest {
  model: string
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

interface AliyunLLMResponse {
  content: string
  usage: {
    totalTokens: number
    promptTokens: number
    completionTokens: number
  }
  model: string
}

export const aliyunLLM = {
  /**
   * 支持的模型列表
   */
  supportedModels: [
    'qwen3.6-max-preview',
    'qwen3.6-plus',
    'qwen3.6-flash',
  ],

  /**
   * 调用阿里百炼 LLM（兼容 OpenAI Chat Completions 格式）
   */
  async chat(params: AliyunLLMRequest): Promise<AliyunLLMResponse> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('ALIYUN_API_KEY not configured')

    const model = params.model || 'qwen3.6-max-preview'
    const body: Record<string, any> = {
      model,
      messages: params.messages,
      max_tokens: params.maxTokens || 4096,
      temperature: params.temperature ?? 0.1,
      stream: false,
    }

    console.log(`[AliyunLLM] Calling ${model} with ${params.messages.length} messages`)

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
      throw new Error(`阿里百炼 LLM 调用失败 (${res.status}): ${errText}`)
    }

    const data = await res.json()

    if (!data.choices || !data.choices.length) {
      throw new Error(`阿里百炼 LLM 响应异常: ${JSON.stringify(data).substring(0, 200)}`)
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
  async chatStream(params: AliyunLLMRequest, onChunk: (chunk: string) => void): Promise<AliyunLLMResponse> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('ALIYUN_API_KEY not configured')

    const model = params.model || 'qwen3.6-max-preview'
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
      throw new Error(`阿里百炼 LLM 流式调用失败 (${res.status}): ${errText}`)
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

