/**
 * observability/logger.ts — 结构化日志系统
 * 
 * 所有日志必须包含 traceId
 * 统一格式，支持按 module/level 过滤
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  traceId: string
  level: LogLevel
  module: string
  message: string
  meta?: Record<string, any>
  timestamp: string  // ISO
}

const MAX_LOG_ENTRIES = 5000
const logs: LogEntry[] = []
const listeners: Array<(entry: LogEntry) => void> = []

/**
 * 记录一条结构化日志
 */
export function logEvent(
  traceId: string,
  level: LogLevel,
  module: string,
  message: string,
  meta?: Record<string, any>
) {
  const entry: LogEntry = {
    traceId,
    level,
    module,
    message,
    meta,
    timestamp: new Date().toISOString(),
  }

  logs.push(entry)
  if (logs.length > MAX_LOG_ENTRIES) logs.shift()

  // 同步输出到 console
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${module}] [${traceId.substring(0, 8)}]`
  if (level === 'error') {
    console.error(`${prefix} ${message}`, meta ? JSON.stringify(meta) : '')
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`, meta ? JSON.stringify(meta) : '')
  } else {
    console.log(`${prefix} ${message}`, meta ? JSON.stringify(meta) : '')
  }

  // 通知监听器
  for (const listener of listeners) {
    try { listener(entry) } catch {}
  }
}

/**
 * 快捷方法
 */
export const logger = {
  debug: (traceId: string, module: string, msg: string, meta?: any) =>
    logEvent(traceId, 'debug', module, msg, meta),
  info: (traceId: string, module: string, msg: string, meta?: any) =>
    logEvent(traceId, 'info', module, msg, meta),
  warn: (traceId: string, module: string, msg: string, meta?: any) =>
    logEvent(traceId, 'warn', module, msg, meta),
  error: (traceId: string, module: string, msg: string, meta?: any) =>
    logEvent(traceId, 'error', module, msg, meta),
}

/**
 * 订阅日志事件
 */
export function onLogEvent(cb: (entry: LogEntry) => void) {
  listeners.push(cb)
}

/**
 * 获取最近的日志
 */
export function getRecentLogs(
  level?: LogLevel,
  module?: string,
  limit: number = 100
): LogEntry[] {
  let filtered = [...logs]
  if (level) filtered = filtered.filter(l => l.level === level)
  if (module) filtered = filtered.filter(l => l.module === module)
  return filtered.slice(-limit).reverse()
}

/**
 * 错误分类
 */
export type ErrorCategory =
  | 'USER_ERROR'        // 用户输入错误
  | 'PROVIDER_ERROR'    // AI Provider 返回错误
  | 'SYSTEM_ERROR'      // 后端 bug
  | 'TIMEOUT_ERROR'     // 超时
  | 'RATE_LIMIT_ERROR'  // 限流
  | 'AUTH_ERROR'        // 认证
  | 'QUOTA_ERROR'       // 配额不足

export function classifyError(errorMessage: string, statusCode?: number): {
  category: ErrorCategory
  severity: 'low' | 'medium' | 'high' | 'critical'
  recoverable: boolean
} {
  const msg = errorMessage.toLowerCase()

  // 超时
  if (msg.includes('timeout') || msg.includes('timed out') || statusCode === 408) {
    return { category: 'TIMEOUT_ERROR', severity: 'medium', recoverable: true }
  }

  // 限流
  if (msg.includes('rate limit') || msg.includes('too many') || statusCode === 429) {
    return { category: 'RATE_LIMIT_ERROR', severity: 'medium', recoverable: true }
  }

  // 认证
  if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('api key') || statusCode === 401 || statusCode === 403) {
    return { category: 'AUTH_ERROR', severity: 'high', recoverable: msg.includes('auth') }
  }

  // 配额
  if (msg.includes('quota') || msg.includes('limit') || msg.includes('insufficient')) {
    return { category: 'QUOTA_ERROR', severity: 'low', recoverable: true }
  }

  // Provider 错误
  if (msg.includes('provider') || msg.includes('upstream') || msg.includes('5') || 
      msg.includes('service unavailable') || msg.includes('bad gateway') ||
      statusCode && statusCode >= 500) {
    return { category: 'PROVIDER_ERROR', severity: 'high', recoverable: true }
  }

  // 用户输入
  if (msg.includes('invalid') || msg.includes('required') || msg.includes('missing')) {
    return { category: 'USER_ERROR', severity: 'low', recoverable: false }
  }

  // 默认：系统错误
  return { category: 'SYSTEM_ERROR', severity: 'high', recoverable: false }
}
