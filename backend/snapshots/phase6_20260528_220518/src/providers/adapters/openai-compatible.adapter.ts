/**
 * P1 — OpenAI 兼容 Provider Adapter
 *
 * 适用于：
 *   - DeepSeek (api.deepseek.com)
 *   - SiliconFlow (api.siliconflow.cn)
 *   - 任何 OpenAI 兼容格式的 provider
 *
 * ═══ 宪法 ═══
 * ProviderConfig 显式传参，不读 process.env。
 */

import { ProviderAdapter, ProviderConfig } from '../core/provider-adapter.js'

interface OpenAICompatibleRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

interface OpenAICompatibleResponse {
  choices: Array<{
    message: {
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  model: string
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  async execute(params: {
    providerConfig: ProviderConfig
    payload: {
      systemPrompt: string
      userMessage: string
      maxTokens?: number
      temperature?: number
    }
  }): Promise<{
    content: string
    totalTokens: number
    model: string
  }> {
    const { providerConfig, payload } = params
    const { modelName, apiKey, baseUrl } = providerConfig
    const { systemPrompt, userMessage, maxTokens, temperature } = payload

    const endpoint = baseUrl || 'https://api.deepseek.com'

    const body: OpenAICompatibleRequest = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }
    if (maxTokens) body.max_tokens = maxTokens
    if (temperature !== undefined) body.temperature = temperature

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown')
      throw new Error(`OpenAICompatibleAdapter: ${response.status} ${errorText}`)
    }

    const data: OpenAICompatibleResponse = await response.json()

    return {
      content: data.choices?.[0]?.message?.content || '',
      totalTokens: data.usage?.total_tokens || 0,
      model: data.model || modelName,
    }
  }

  async *stream(params: {
    providerConfig: ProviderConfig
    payload: {
      systemPrompt: string
      userMessage: string
      maxTokens?: number
      temperature?: number
    }
  }): AsyncIterable<{
    content: string
    done?: boolean
    totalTokens?: number
  }> {
    const { providerConfig, payload } = params
    const { modelName, apiKey, baseUrl } = providerConfig
    const { systemPrompt, userMessage, maxTokens, temperature } = payload

    const endpoint = baseUrl || 'https://api.deepseek.com'

    const body: OpenAICompatibleRequest = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
    }
    if (maxTokens) body.max_tokens = maxTokens
    if (temperature !== undefined) body.temperature = temperature

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown')
      throw new Error(`OpenAICompatibleAdapter stream: ${response.status} ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json.choices?.[0]?.delta?.content
            if (delta) {
              yield { content: delta, done: false }
            }
            if (json.choices?.[0]?.finish_reason === 'stop') {
              yield { content: '', done: true, totalTokens: 0 }
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

export const openAICompatibleAdapter = new OpenAICompatibleAdapter()
