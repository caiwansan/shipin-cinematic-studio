/**
 * OpenAI Provider — 也用于 Kimi 等 OpenAI 兼容接口
 * 支持运行时动态注入 process.env key。
 * 使用 Node 18+ 原生 fetch（避免旧版 https.request 的连接 hang 问题）
 */

import type { LLMProvider, LLMRequest, LLMResponse } from './base.provider.js'

export interface OpenAIProviderOptions {
  name?: string
  apiKey?: string
  baseUrl?: string
  models?: string[]
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai'
  models: string[] = [] // 模型列表从 DB / 运行时注入，代码不做硬编码
  apiKey: string = ''

  private _customBaseUrl?: string
  private _customApiKey?: string

  constructor(opts?: OpenAIProviderOptions) {
    if (opts) {
      if (opts.name) this.name = opts.name
      if (opts.apiKey) this._customApiKey = opts.apiKey
      if (opts.baseUrl) this._customBaseUrl = opts.baseUrl
      if (opts.models) this.models = opts.models
    }
  }

  private get effectiveApiKey(): string {
    if (this._customApiKey) return this._customApiKey
    // 支持运行时通过 refreshProviderApiKeys() 动态注入（赋值给 this.apiKey）
    if (this.apiKey) return this.apiKey
    throw new Error('[RuntimeConstitution] API Key 必须通过构造函数或 apiKey 字段传入')
  }

  private get baseUrl(): string {
    if (this._customBaseUrl) return this._customBaseUrl
    const defaultUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      kimi: 'https://api.moonshot.cn/v1',
      siliconflow: 'https://api.siliconflow.cn/v1',
      bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    }
    if (defaultUrls[this.name]) return defaultUrls[this.name]
    return 'https://api.openai.com/v1'
  }

  async call(req: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    const start = Date.now()
    const key = this.effectiveApiKey
    if (!key) throw new Error('API Key 未配置')

    const url = `${this.baseUrl}/chat/completions`
    console.log(`[${this.name}] calling: ${url} model=${req.model}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.1,
        stream: false,
      }),
      signal,
      keepalive: false,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`${this.name} returned ${response.status}: ${text.slice(0, 200)}`)
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

