import type { LLMProvider, LLMRequest, LLMResponse } from './base.provider.js'

export class DeepSeekProvider implements LLMProvider {
  name = 'deepseek'
  private _models: string[] = []
  get models(): string[] {
    return this._models.length > 0 ? this._models : []
  }
  set models(v: string[]) {
    this._models = v
  }
  apiKey: string = ''

  private get baseUrl(): string {
    return 'https://api.deepseek.com' // baseUrl 是连接配置（基础设施），非大模型名，允许保留
  }

  async call(req: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    const start = Date.now()
    const effectiveKey = this.apiKey
    if (!effectiveKey) throw new Error('DeepSeek API Key 未配置（必须通过 apiKey 字段传入）')

    const url = `${this.baseUrl}/chat/completions`
    console.log(`[DeepSeekProvider] calling: ${url} model=${req.model}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
        stream: false,
      }),
      signal,
      keepalive: false,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`DeepSeek returned ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = await response.json() as any
    const latencyMs = Date.now() - start

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model ?? req.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      latencyMs,
    }
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

