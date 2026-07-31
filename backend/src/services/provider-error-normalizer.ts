/**
 * services/provider-error-normalizer.ts
 *
 * Provider 错误映射 — 技术错误 → 用户可理解的产品化错误
 *
 * 将所有 AI Provider 返回的原始错误（HTTP 401/403/404/500）
 * 转换为统一的 { code, message } 结构。
 *
 * 使用：
 *   const normalized = normalizeProviderError(rawError, providerName)
 *   // → { code: 'PROVIDER_AUTH_FAILED', message: 'AI模型服务授权失败，请检查模型配置' }
 */

// ── 规范化错误结构 ──

export interface NormalizedError {
  /** 机器可读的错误码 */
  code: string
  /** 用户可理解的错误消息 */
  message: string
  /** 原始错误消息（仅供日志） */
  raw?: string
}

// ── 错误模式匹配 ──

/**
 * 错误模式规则
 * key: 错误正则
 * value: { code, message }
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp
  code: string
  message: string
}> = [
  // ---- 认证/授权错误 ----
  {
    pattern: /401|Unauthorized|unauthorized|Invalid API.?key|invalid.?api.?key|invalid_key|ApiKeyInvalid|AccessDenied/i,
    code: 'PROVIDER_AUTH_FAILED',
    message: 'AI模型服务授权失败，请检查模型配置中的 API Key 是否正确',
  },
  {
    pattern: /403|Forbidden|Insufficient.*quota|quota.*exceeded|RateLimit/i,
    code: 'PROVIDER_QUOTA_EXCEEDED',
    message: 'AI模型服务调用次数已达上限或被限流，请稍后重试或检查账户余额',
  },
  {
    pattern: /429|Too Many Requests|rate.*limit|RequestRateLimit/i,
    code: 'PROVIDER_RATE_LIMITED',
    message: 'AI模型服务请求过于频繁，请稍后重试',
  },
  {
    pattern: /not.?found|NotFound|ModelNotFound|InvalidEndpoint/i,
    code: 'PROVIDER_MODEL_NOT_FOUND',
    message: 'AI模型不存在或未开通，请确认已在模型提供商控制台开通该模型',
  },
  {
    pattern: /timeout|Timeout|timed.?out/i,
    code: 'PROVIDER_TIMEOUT',
    message: 'AI模型服务响应超时，请稍后重试',
  },
  {
    pattern: /429|Too Many Requests/i,
    code: 'PROVIDER_RATE_LIMITED',
    message: 'AI模型服务请求过于频繁，请稍后重试',
  },
  {
    pattern: /500|502|503|Internal Server Error|Service Unavailable|Bad Gateway/i,
    code: 'PROVIDER_SERVER_ERROR',
    message: 'AI模型服务暂时不可用，请稍后重试',
  },
  {
    pattern: /content.*filter|content.*policy|safety|blocked|violation/i,
    code: 'PROVIDER_CONTENT_FILTERED',
    message: 'AI模型判定输入内容不合规，请调整 prompt 后重试',
  },
]

// ── 空/未配置 Key 检测（在调用 Provider 前） ──

export function checkApiKeyConfigured(apiKey: string | undefined | null, providerName: string): NormalizedError | null {
  if (!apiKey || apiKey.trim() === '') {
    return {
      code: 'API_KEY_NOT_CONFIGURED',
      message: `尚未配置 ${providerName} 的 API Key，请在「模型设置」中添加`,
    }
  }
  if (apiKey.length < 10) {
    return {
      code: 'API_KEY_INVALID_FORMAT',
      message: `${providerName} 的 API Key 格式不正确，请检查后重新输入`,
    }
  }
  return null
}

// ── 主入口：规范化 Provider 错误 ──

/**
 * normalizeProviderError — 将 Provider 原始错误转为产品化错误
 *
 * @param error 原始 Error 对象或字符串
 * @param providerName 提供商名称（用于日志）
 * @returns NormalizedError
 */
export function normalizeProviderError(
  error: Error | string,
  providerName?: string,
): NormalizedError {
  const errMsg = typeof error === 'string' ? error : error.message || String(error)
  const provider = providerName || ''

  // 遍历所有错误模式
  for (const rule of ERROR_PATTERNS) {
    if (rule.pattern.test(errMsg)) {
      const enriched = rule.code === 'PROVIDER_AUTH_FAILED'
        ? `AI模型服务授权失败（${provider}），请检查「大模型设置」中的 API Key 是否正确`
        : rule.message

      return { code: rule.code, message: enriched, raw: errMsg.slice(0, 300) }
    }
  }

  // 无法匹配的兜底
  return {
    code: 'PROVIDER_UNKNOWN_ERROR',
    message: `AI模型调用异常（${provider}）：${errMsg.slice(0, 200)}`,
    raw: errMsg.slice(0, 300),
  }
}

// ── 快捷函数：映射到 422 错误结构 ──

export function toProducerErrorResponse(
  error: Error | string,
  providerName?: string,
): { error: string; code: string } {
  const { code, message } = normalizeProviderError(error, providerName)
  return { error: message, code }
}
