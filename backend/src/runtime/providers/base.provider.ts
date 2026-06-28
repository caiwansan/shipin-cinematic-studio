/**
 * Unified LLM Provider Layer
 *
 * All LLM executors speak to providers through this interface.
 * Providers are pluggable — swap DeepSeek for Claude with one config line.
 */

// ============================================================
// Core Types
// ============================================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  model: string
  messages: LLMMessage[]
  maxTokens?: number
  temperature?: number
  stream?: boolean
  responseFormat?: { type: 'json_object' | 'text' }
}

export interface LLMResponse {
  content: string
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  latencyMs: number
}

export interface LLMProvider {
  name: string
  models: string[]
  apiKey: string
  call(req: LLMRequest, signal?: AbortSignal): Promise<LLMResponse>
}

// ============================================================
// Provider Base — common logic
// ============================================================

export abstract class BaseProvider implements LLMProvider {
  abstract name: string
  abstract models: string[]
  protected abstract baseUrl: string
  apiKey: string = ''

  /**
   * 返回当前生效的 API Key。
   * 子类可以覆盖此方法以支持动态读取 process.env。
   */
  protected getEffectiveApiKey(): string {
    return this.apiKey
  }

  async call(req: LLMRequest, signal?: AbortSignal): Promise<LLMResponse> {
    const start = Date.now()
    const effectiveKey = this.getEffectiveApiKey()

    try {
      if (!effectiveKey) throw new Error('API Key 未配置')

      const urlObj = new URL(`${this.baseUrl}/chat/completions`)
      const postData = JSON.stringify({
        model: req.model,
        messages: req.messages,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.7,
        stream: false,
        ...(req.responseFormat ? { response_format: req.responseFormat } : {}),
      })

      console.log(`[${this.name}] calling: ${urlObj.host}${urlObj.pathname} model=${req.model}`)

      const response = await this.httpsRequest(urlObj, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`,
        },
        body: postData,
      }, signal)

      const latencyMs = Date.now() - start

      if (!response.ok) {
        throw new Error(`LLM provider ${this.name} returned ${response.status}: ${response.body}`)
      }

      const data = JSON.parse(response.body)
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
    } catch (err: any) {
      if (err.name === 'AbortError') throw err
      throw new Error(`LLM call to ${this.name} failed: ${err.message}`)
    }
  }

  private httpsRequest(urlObj: URL, opts: { method: string; headers: Record<string, string>; body: string }, signal?: AbortSignal): Promise<{ ok: boolean; status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const mod = urlObj.protocol === 'https:' ? require('https') : require('http')

      const req = mod.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: opts.method,
        headers: opts.headers,
        agent: false, // 禁用 keep-alive 避免连接复用问题
      }, (res: any) => {
        let body = ''
        res.on('data', (chunk: string) => body += chunk)
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body,
          })
        })
      })

      // 不在这里设定时器超时，由 caller 的 AbortSignal 控制
      req.on('error', (err: Error) => {
        reject(err)
      })

      if (signal) {
        if (signal.aborted) {
          req.destroy()
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          return reject(err)
        }
        signal.addEventListener('abort', () => {
          req.destroy()
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }

      req.write(opts.body)
      req.end()
    })
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

