/**
 * provider-state.ts — Provider State Layer v1
 *
 * 把 provider 从"外部函数调用"升级为"系统内部状态实体"。
 * 每个用户 × provider 有一个运行时状态，记录可用性/错误分类/时间线。
 */

/** Provider 运行时状态 */
export type ProviderStatus = 'healthy' | 'degraded' | 'invalid_key' | 'billing_failed' | 'down' | 'permission_denied'

export interface ProviderState {
  /** provider 标识，如 volcengine / siliconflow / aliyun */
  provider: string
  /** 当前健康状态 */
  status: ProviderStatus
  /** 最近一次错误消息 */
  lastError?: string
  /** 最近一次错误分类码 */
  lastErrorCode?: string
  /** 上次成功调用时间戳 */
  lastSuccessAt?: number
  /** 上次失败调用时间戳 */
  lastFailAt?: number
  /** Key 指纹（前8位哈希），用来快速识别 Key 是否变更 */
  keyFingerprint?: string
  /** 是否允许调用（管理员可手动禁用） */
  enabled: boolean
  /** 连续失败次数（超过阈值自动禁用） */
  consecutiveFailures: number
  /** v1.2: Circuit Breaker 熔断开启时间（ms） */
  circuitOpenedAt?: number
}

/** 创建默认状态 */
export function createDefaultState(provider: string): ProviderState {
  return {
    provider,
    status: 'healthy',
    enabled: true,
    consecutiveFailures: 0,
  }
}

/** 根据错误消息分类 Provider 状态 */
export function classifyProviderError(error: any): { status: ProviderStatus; errorCode: string } {
  const msg = extractProviderMessage(error)
  const normalized = msg.toLowerCase()

  // 🧠 1. MODEL LIFECYCLE（最高优先级）
  if (normalized.includes('model disabled') || normalized.includes('model_disabled')) {
    return { status: 'degraded', errorCode: 'MODEL_DISABLED' }
  }
  if (normalized.includes('deprecated') || normalized.includes('model not available')) {
    return { status: 'degraded', errorCode: 'MODEL_DEPRECATED' }
  }
  if (normalized.includes('model does not exist') || normalized.includes('model not found')) {
    return { status: 'degraded', errorCode: 'MODEL_UNAVAILABLE' }
  }
  if (normalized.includes('not have access') || normalized.includes('InvalidEndpointOrModel.NotFound')) {
    return { status: 'invalid_key', errorCode: 'MODEL_NOT_FOUND' }
  }

  // 💰 2. BILLING / QUOTA
  if (
    normalized.includes('accountoverdue') ||
    normalized.includes('account has an overdue') ||
    normalized.includes('insufficient_balance') ||
    normalized.includes('余额不足') ||
    normalized.includes('欠费') ||
    normalized.includes('quota') ||
    normalized.includes('insufficient')
  ) {
    return { status: 'billing_failed', errorCode: 'ACCOUNT_OVERDUE' }
  }
  if (normalized.includes('limit') || normalized.includes('rate_limit') || normalized.includes('quota_exceeded')) {
    return { status: 'degraded', errorCode: 'RATE_LIMITED' }
  }

  // 🔐 3. AUTH — 精确匹配 body 语义，不依赖 HTTP code
  if (
    normalized.includes('invalid api key') ||
    normalized.includes('api key invalid') ||
    normalized.includes('invalid_api_key') ||
    normalized.includes('unauthorized') ||
    normalized.includes('authentication')
  ) {
    return { status: 'invalid_key', errorCode: 'INVALID_API_KEY' }
  }

  // 4. HTTP CODE FALLBACK — 只有 body 无精确匹配时才回落
  const status = typeof error?.status === 'number' ? error.status
    : typeof error?.response?.status === 'number' ? error.response.status
    : (typeof error?.statusCode === 'number' ? error.statusCode : 0)

  if (status === 401 || status === 403) {
    return { status: 'permission_denied' as any, errorCode: 'PERMISSION_DENIED' }
  }

  // 5. NETWORK
  if (
    normalized.includes('timeout') ||
    normalized.includes('etimedout') ||
    normalized.includes('econnrefused') ||
    normalized.includes('fetch failed') ||
    normalized.includes('econnreset')
  ) {
    return { status: 'down', errorCode: 'NETWORK_ERROR' }
  }

  // 6. PARAMETER (400 others)
  if (status === 400 || normalized.includes('bad request') || normalized.includes('invalid_parameter') || normalized.includes('invalid voice')) {
    return { status: 'degraded', errorCode: 'INVALID_PARAMETERS' }
  }

  // 7. 默认：临时降级
  return { status: 'degraded', errorCode: 'UNKNOWN_ERROR' }
}

/**
 * 从 error 对象中提取语义化消息
 * 优先解析 response body → error.message → 回退 toString
 */
function extractProviderMessage(error: any): string {
  if (!error) return ''

  // 1. 直接传入字符串
  if (typeof error === 'string') return error

  // 2. 优先解析 response body（如 fetch 抛出的带 body 的异常）
  if (error.body) {
    if (typeof error.body === 'string') return error.body
    if (error.body.error?.message) return error.body.error.message
    if (error.body.message) return error.body.message
  }
  if (error.data) {
    if (typeof error.data === 'string') return error.data
    if (error.data.error?.message) return error.data.error.message
    if (error.data.message) return error.data.message
  }
  if (error.response?.data) {
    const d = error.response.data
    if (typeof d === 'string') return d
    if (d.error?.message) return d.error.message
    if (d.message) return d.message
  }

  // 3. 从 error.message 中提取 JSON body
  // 硅基流动格式: "硅基 TTS 失败 (403): {\"code\":30003,\"message\":\"Model disabled.\",\"data\":null}"
  if (error.message) {
    const msg = error.message
    const jsonMatch = msg.match(/\{.*"message"\s*:\s*"[^"]+".*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.message) return parsed.message
      } catch { /* not json */ }
    }
    // colon 后内容: "硅基 TTS 失败 (403): Model disabled"
    const colonMatch = msg.match(/:\s*(.+)/)
    if (colonMatch) return colonMatch[1].trim()
    return msg
  }

  return String(error)
}
