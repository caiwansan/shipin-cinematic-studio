/**
 * providers/error-classifier.ts — 错误分类器
 *
 * P4.1.1: 区分 Invalid Key / Network Error / Rate Limit / Provider Error
 * 供 Verify API 使用，返回稳定的结构化的错误码。
 *
 * 不修改 Frozen Core。
 */

export type ClassifiedErrorCode =
  | 'INVALID_API_KEY'     // 401: API Key 格式或内容无效
  | 'EXPIRED_API_KEY'     // 401 + 特定 body: Key 已过期
  | 'PERMISSION_DENIED'   // 403: Key 无权限
  | 'RATE_LIMITED'        // 429: 请求过于频繁
  | 'QUOTA_EXCEEDED'      // 403/429: 账户余额不足
  | 'PROVIDER_ERROR'      // 5xx: Provider 服务端错误
  | 'DNS_ERROR'           // DNS 解析失败
  | 'NETWORK_TIMEOUT'     // 请求超时
  | 'NETWORK_ERROR'       // 其他网络错误
  | 'UNKNOWN_ERROR'       // 未分类错误

export interface ClassifiedError {
  code: ClassifiedErrorCode
  message: string
  retryable: boolean
}

const ERROR_MESSAGES: Record<ClassifiedErrorCode, string> = {
  INVALID_API_KEY: 'API Key 无效，请检查是否复制完整',
  EXPIRED_API_KEY: 'API Key 已过期，请在 Provider 平台重新生成',
  PERMISSION_DENIED: 'API Key 无权限访问该模型，请检查账户权限',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  QUOTA_EXCEEDED: '账户余额不足，请充值',
  PROVIDER_ERROR: 'AI 服务商暂时异常，请稍后重试',
  DNS_ERROR: '无法连接 Provider，请检查网络或 baseURL',
  NETWORK_TIMEOUT: '连接超时（10秒），请检查网络',
  NETWORK_ERROR: '网络连接异常',
  UNKNOWN_ERROR: '验证失败',
}

export function classifyError(err: any): ClassifiedError {
  // 1. AbortError / Timeout
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
    return { code: 'NETWORK_TIMEOUT', message: ERROR_MESSAGES.NETWORK_TIMEOUT, retryable: true }
  }

  // 2. DNS / Fetch errors
  const msg = (err?.message || '').toLowerCase()
  if (msg.includes('enotfound') || msg.includes('dns') || msg.includes('getaddrinfo')) {
    return { code: 'DNS_ERROR', message: ERROR_MESSAGES.DNS_ERROR, retryable: true }
  }
  if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('econnaborted')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, retryable: true }
  }
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('socket hang up')) {
    return { code: 'NETWORK_TIMEOUT', message: ERROR_MESSAGES.NETWORK_TIMEOUT, retryable: true }
  }
  if (msg.includes('fetch failed') || msg.includes('network') || msg.includes('request failed')) {
    return { code: 'NETWORK_ERROR', message: ERROR_MESSAGES.NETWORK_ERROR, retryable: true }
  }

  // 3. HTTP Status based
  if (err?.status || err?.response?.status || err?.statusCode) {
    const status = err.status || err.response?.status || err.statusCode
    return classifyByStatus(status, err?.body || err?.response?.body || '')
  }

  return { code: 'UNKNOWN_ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR, retryable: false }
}

function classifyByStatus(status: number, body: string): ClassifiedError {
  switch (status) {
    case 400:
      return { code: 'INVALID_API_KEY', message: ERROR_MESSAGES.INVALID_API_KEY, retryable: false }
    case 401:
      // Check if body indicates expired key
      if (body.includes('expired') || body.includes('Expired')) {
        return { code: 'EXPIRED_API_KEY', message: ERROR_MESSAGES.EXPIRED_API_KEY, retryable: false }
      }
      return { code: 'INVALID_API_KEY', message: ERROR_MESSAGES.INVALID_API_KEY, retryable: false }
    case 403:
      if (body.includes('quota') || body.includes('insufficient') || body.includes('balance')) {
        return { code: 'QUOTA_EXCEEDED', message: ERROR_MESSAGES.QUOTA_EXCEEDED, retryable: false }
      }
      return { code: 'PERMISSION_DENIED', message: ERROR_MESSAGES.PERMISSION_DENIED, retryable: false }
    case 429:
      return { code: 'RATE_LIMITED', message: ERROR_MESSAGES.RATE_LIMITED, retryable: true }
    case 500:
    case 502:
    case 503:
    case 504:
      return { code: 'PROVIDER_ERROR', message: ERROR_MESSAGES.PROVIDER_ERROR, retryable: true }
    default:
      return { code: 'UNKNOWN_ERROR', message: `HTTP ${status}: ${body.slice(0, 100)}`, retryable: false }
  }
}

/**
 * 从 ModelAdapter 执行结果中提取分类错误
 * adapters 在 execute 失败时通常抛出的错误对象包含 status 和 body
 */
export function classifyAdapterError(err: any): ClassifiedError {
  // 适配器错误通常有:
  // err.status / err.statusCode
  // err.message (格式: "... (401): ..." 或 "... status 401 ...")
  if (err?.status || err?.statusCode) {
    return classifyByStatus(err.status || err.statusCode, err.body || err.message || '')
  }

  // 从错误消息中提取 HTTP 状态码
  const msg = err?.message || ''
  const statusMatch = msg.match(/\((\d{3})\)|status (\d{3})|HTTP (\d{3})/i)
  if (statusMatch) {
    const status = parseInt(statusMatch[1] || statusMatch[2] || statusMatch[3], 10)
    return classifyByStatus(status, msg)
  }

  return classifyError(err)
}
