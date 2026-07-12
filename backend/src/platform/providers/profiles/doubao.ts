/**
 * 豆包 (火山引擎 ARK) Provider Profile
 *
 * 火山引擎 API 不完全兼容 OpenAI 格式。
 * 已知差异：
 *   1. ARK 的 streaming 响应格式不同（data: {"event":"...","data":"..."} 而非 data: {"choices":...}）
 *   2. 非 streaming 格式兼容 OpenAI /chat/completions，但字段顺序/命名可能有细微差异
 *   3. 错误响应体可能不是标准的 { error: { message, code } } 格式
 *
 * 修复策略：
 *   - responseMapper 处理 ARK 非标准响应
 *   - 主要依赖通用 OpenAI 解析（tryOpenAI），对特殊格式做 fallback
 */

import { ProviderProfile } from '../provider-profile.types.js'
import { StandardLLMResponse, StandardError } from '../../normalizer/types.js'

export const doubaoProfile: ProviderProfile = {
  name: 'doubao',
  displayName: '豆包 (火山引擎)',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  models: ['doubao-seed-2-0-plus-260428', 'doubao-seed-2-1-pro-260628'],
  authentication: {
    type: 'bearer',
  },
  endpoints: {
    chat: '/chat/completions',
  },
  responseFormat: 'openai',
  tokenReporting: 'standard',
  responseMapper: (raw: any): StandardLLMResponse => {
    // 火山引擎 ARK 在某些版本中返回嵌套结构
    // 标准: { choices: [{ message: { content: '...' } }] }
    // 非标准: { data: { choices: [...] } } 或 { response: { text: '...' } }

    // 尝试 Standard OpenAI path
    const content = raw?.choices?.[0]?.message?.content
    if (content) {
      return {
        content,
        finishReason: raw.choices[0]?.finish_reason === 'stop' ? 'stop' : 'unknown',
        tokens: raw.usage
          ? {
              input: raw.usage.prompt_tokens ?? 0,
              output: raw.usage.completion_tokens ?? 0,
              total: raw.usage.total_tokens ?? 0,
              inputDetail: 'provider_reported',
              outputDetail: 'provider_reported',
            }
          : undefined,
      }
    }

    // 尝试嵌套 data 结构
    const nestedContent = raw?.data?.choices?.[0]?.message?.content
    if (nestedContent) {
      return {
        content: nestedContent,
        finishReason: raw.data.choices[0]?.finish_reason === 'stop' ? 'stop' : 'unknown',
      }
    }

    // 尝试 response.text
    if (raw?.response?.text) {
      return {
        content: raw.response.text,
        finishReason: 'unknown',
      }
    }

    // 尝试 result/output 字段（某些火山引擎模型）
    if (raw?.result) {
      return {
        content: typeof raw.result === 'string' ? raw.result : JSON.stringify(raw.result),
        finishReason: 'unknown',
      }
    }

    // 如果 raw 本身就是 string
    if (typeof raw === 'string') {
      return { content: raw, finishReason: 'unknown' }
    }

    // 无法解析
    return { content: '', finishReason: 'unknown' }
  },
  errorMapper: (status: number, body: any): StandardError => {
    // 火山引擎错误可能包含 code/message 在顶层或嵌套
    const msg = body?.error?.message || body?.message || body?.error_description || ''
    const code = body?.error?.code || body?.code || ''

    let errorCode: StandardError['code'] = 'UNKNOWN'
    if (status === 401 || status === 403 || code.includes('auth') || code.includes('credential')) {
      errorCode = 'AUTH_FAILED'
    } else if (status === 429 || code.includes('rate') || code.includes('throttle')) {
      errorCode = 'RATE_LIMIT'
    } else if (status === 402 || code.includes('quota') || code.includes('insufficient')) {
      errorCode = 'QUOTA_EXCEEDED'
    } else if (status === 404 || code.includes('model') || code.includes('not found')) {
      errorCode = 'MODEL_UNAVAILABLE'
    } else if (status >= 500) {
      errorCode = 'NETWORK_ERROR'
    }

    return {
      code: errorCode,
      message: msg || `火山引擎 API 错误 (HTTP ${status})`,
      provider: 'doubao',
      originalStatus: status,
      originalBody: typeof body === 'string' ? body : JSON.stringify(body),
      retryable: errorCode === 'RATE_LIMIT' || errorCode === 'NETWORK_ERROR',
    }
  },
}
