/**
 * benchmark/provider/deepseek-adapter.ts — DeepSeek Provider Adapter
 *
 * 遵循 BenchmarkProvider 统一接口。
 * 兼容 OpenAI Chat Completions API 格式。
 * 只需实现 invoke() 方法，其他模块零改动。
 */
import { BenchmarkProvider, BenchmarkRequest, BenchmarkResponse } from '../types'

export class DeepSeekAdapter implements BenchmarkProvider {
  readonly name = 'deepseek'
  readonly model: string
  readonly version: string

  private baseUrl: string
  private apiKey: string

  constructor() {
    this.model = process.env.DEEPSEEK_LLM_MODEL || 'deepseek-chat'
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
    this.apiKey = process.env.DEEPSEEK_API_KEY || ''
    this.version = this.model
  }

  async invoke(request: BenchmarkRequest): Promise<BenchmarkResponse> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured')
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(request.timeout),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`DeepSeek API error ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
      model: string
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
      } : undefined,
    }
  }
}
