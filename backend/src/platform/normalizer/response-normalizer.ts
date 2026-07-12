/**
 * response-normalizer.ts — ProviderResponseNormalizer
 *
 * 核心职责：
 *   1. 标准化 Provider 原始 HTTP 响应 → StandardLLMResponse
 *   2. 标准化 Provider 原始 HTTP 错误 → StandardError
 *
 * 设计原则：
 *   - 无特判逻辑：所有 Provider 特定逻辑委托给 Profile 中的 responseMapper/errorMapper
 *   - 无 switch-case：Provider 查找通过 ProviderRegistry 完成
 *   - 可降级：未配置 mapper 的 Provider 按通用格式（OpenAI-compatible）尝试解析
 */

import { StandardLLMResponse, StandardError, ErrorCode } from './types.js'
import { ProviderRegistry } from '../providers/provider-registry.js'
import { fillMissingTokens } from './token-normalizer.js'

export class ProviderResponseNormalizer {
  /**
   * 将 Provider 原始响应转为标准格式
   * @param provider Provider 名称
   * @param rawResponse 原始 HTTP response body (已 JSON.parse)
   * @param inputText 原始输入文本（用于 token 估算 fallback）
   */
  normalize(
    provider: string,
    rawResponse: any,
    inputText?: string,
  ): StandardLLMResponse {
    const profile = ProviderRegistry.get(provider)

    // 1. 如果 profile 定义了 responseMapper，使用它
    if (profile?.responseMapper) {
      try {
        const mapped = profile.responseMapper(rawResponse)
        if (mapped && mapped.content !== undefined) {
          // 如果 mapper 返回了 tokens，不再估算
          if (mapped.tokens || !inputText) return mapped
          return fillMissingTokens(mapped, inputText)
        }
      } catch (err) {
        // mapper 失败后降级到通用解析
        console.warn(`[ResponseNormalizer] ${provider} responseMapper failed, falling back:`, err)
      }
    }

    // 2. 通用解析：依次尝试已知格式

    // 2a. OpenAI-compatible: { choices: [{ message: { content } }] }
    const openaiContent = this.tryOpenAI(rawResponse)
    if (openaiContent !== null) {
      return {
        content: openaiContent,
        finishReason: rawResponse.choices?.[0]?.finish_reason === 'stop'
          ? 'stop'
          : rawResponse.choices?.[0]?.finish_reason === 'length'
            ? 'length'
            : 'unknown',
        tokens: rawResponse.usage
          ? {
              input: rawResponse.usage.prompt_tokens ?? 0,
              output: rawResponse.usage.completion_tokens ?? 0,
              total: rawResponse.usage.total_tokens ?? 0,
              inputDetail: 'provider_reported',
              outputDetail: 'provider_reported',
            }
          : undefined,
      }
    }

    // 2b. Anthropic-compatible: { content: [{ text: '...' }] }
    const anthropicContent = this.tryAnthropic(rawResponse)
    if (anthropicContent !== null) {
      const inputTokens = rawResponse.usage?.input_tokens
      const outputTokens = rawResponse.usage?.output_tokens
      return {
        content: anthropicContent,
        finishReason: rawResponse.stop_reason === 'end_turn' ? 'stop' : 'unknown',
        tokens: inputTokens !== undefined || outputTokens !== undefined
          ? {
              input: inputTokens ?? 0,
              output: outputTokens ?? 0,
              total: (inputTokens ?? 0) + (outputTokens ?? 0),
              inputDetail: 'provider_reported',
              outputDetail: 'provider_reported',
            }
          : undefined,
      }
    }

    // 2c. Gemini-compatible: { candidates: [{ content: { parts: [{ text: '...' }] } }] }
    const geminiContent = this.tryGemini(rawResponse)
    if (geminiContent !== null) {
      return {
        content: geminiContent,
        finishReason: rawResponse.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : 'unknown',
      }
    }

    // 2d. 最后尝试：如果 raw 是 string，直接使用
    if (typeof rawResponse === 'string' && rawResponse.trim()) {
      return { content: rawResponse.trim(), finishReason: 'unknown' }
    }

    // 如果 response 有 content 字段（某些兼容层返回）
    if (rawResponse?.content && typeof rawResponse.content === 'string') {
      return { content: rawResponse.content, finishReason: 'unknown' }
    }

    // 无法解析
    return {
      content: '',
      finishReason: 'unknown',
    }
  }

  /**
   * 将 Provider HTTP 错误转为标准格式
   */
  normalizeError(
    provider: string,
    status: number,
    body: string,
    _headers?: Record<string, string>,
  ): StandardError {
    const profile = ProviderRegistry.get(provider)

    // 1. 如果 profile 定义了 errorMapper，使用它
    if (profile?.errorMapper) {
      try {
        const parsed = this.tryParseBody(body)
        return profile.errorMapper(status, parsed)
      } catch {
        // 降级
      }
    }

    // 2. 通用 HTTP 状态码映射
    let parsedBody: any
    try { parsedBody = typeof body === 'string' ? JSON.parse(body) : body } catch { parsedBody = body }

    // 尝试从 OpenAI-compatible error body 中提取 message
    let errorMessage = parsedBody?.error?.message || parsedBody?.message || body?.substring?.(0, 200) || 'Unknown error'
    if (typeof errorMessage !== 'string') errorMessage = String(errorMessage)

    const code = this.mapHttpStatus(status, parsedBody)
    const retryable = code === 'RATE_LIMIT' || code === 'TIMEOUT' || code === 'NETWORK_ERROR'

    return {
      code,
      message: errorMessage.slice(0, 500),
      provider,
      originalStatus: status,
      originalBody: typeof body === 'string' ? body.slice(0, 1000) : JSON.stringify(body).slice(0, 1000),
      retryable,
    }
  }

  // ─── Private helpers ───

  private tryOpenAI(raw: any): string | null {
    if (!raw || typeof raw !== 'object') return null
    try {
      const choice = raw.choices?.[0]
      if (choice?.message?.content) return choice.message.content
      if (choice?.text) return choice.text
      // 某些 OpenAI 兼容 API 返回 delta 而非 message（streaming）
      if (choice?.delta?.content) return choice.delta.content
    } catch { /* ignore */ }
    return null
  }

  private tryAnthropic(raw: any): string | null {
    if (!raw || typeof raw !== 'object') return null
    try {
      if (raw.content?.[0]?.text) return raw.content[0].text
    } catch { /* ignore */ }
    return null
  }

  private tryGemini(raw: any): string | null {
    if (!raw || typeof raw !== 'object') return null
    try {
      if (raw.candidates?.[0]?.content?.parts?.[0]?.text) {
        return raw.candidates[0].content.parts[0].text
      }
    } catch { /* ignore */ }
    return null
  }

  private tryParseBody(body: any): any {
    if (typeof body === 'string') {
      try { return JSON.parse(body) } catch { return { raw: body } }
    }
    return body
  }

  private mapHttpStatus(status: number, body: any): ErrorCode {
    if (status === 401 || status === 403) return 'AUTH_FAILED'
    if (status === 429) return 'RATE_LIMIT'
    if (status === 402) return 'QUOTA_EXCEEDED'
    if (status === 404) return 'MODEL_UNAVAILABLE'
    if (status === 408 || status === 504) return 'TIMEOUT'
    if (status >= 500) return 'NETWORK_ERROR'
    if (status >= 400) return 'INVALID_RESPONSE'

    // 检查 body 中的错误信息
    const errCode = body?.error?.code || body?.code || ''
    if (errCode.includes('auth') || errCode.includes('credential') || errCode.includes('permission')) return 'AUTH_FAILED'
    if (errCode.includes('quota') || errCode.includes('limit') || errCode.includes('insufficient')) return 'QUOTA_EXCEEDED'
    if (errCode.includes('rate') || errCode.includes('throttle')) return 'RATE_LIMIT'
    if (errCode.includes('timeout') || errCode.includes('deadline')) return 'TIMEOUT'
    if (errCode.includes('model') || errCode.includes('not found')) return 'MODEL_UNAVAILABLE'

    return 'UNKNOWN'
  }
}
