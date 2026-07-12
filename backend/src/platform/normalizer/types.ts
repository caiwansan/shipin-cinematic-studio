/**
 * types.ts — 标准 LLM 响应 & 错误类型
 *
 * ResponseNormalizer 的产出类型。
 * 用于解耦 Provider 原始响应与上层消费方。
 */

export interface StandardLLMResponse {
  content: string
  finishReason: 'stop' | 'length' | 'tool_calls' | 'unknown'
  tokens?: {
    input: number
    output: number
    total: number
    inputDetail?: 'provider_reported' | 'estimated'
    outputDetail?: 'provider_reported' | 'estimated'
  }
  metadata?: Record<string, unknown>
}

export type ErrorCode =
  | 'AUTH_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'PARSER_FAILED'
  | 'MODEL_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'

export interface StandardError {
  code: ErrorCode
  message: string
  provider: string
  originalStatus?: number
  originalBody?: string
  retryable: boolean
}
