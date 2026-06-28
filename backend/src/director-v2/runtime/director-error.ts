/**
 * director-error.ts — Phase 6C.1: Error Unification Layer
 *
 * Director OS 唯一错误类型。所有 runtime 模块统一使用此错误。
 *
 * 契约：
 *   1. 所有 throw 必须使用 DirectorError
 *   2. 所有 catch 必须用 isDirectorError() 识别
 *   3. error shape 统一，序列化后可直接给 UI/logging
 *   4. recoverable 字段帮助 gatekeeper 判断系统健康
 */

// ============================================================
// Error Layer — 错误来源层
// ============================================================

export type ErrorLayer =
  | 'schema'           // Schema validation / constitution 结构
  | 'norm'             // Normalizer / repair / fingerprint
  | 'memory'           // Drift memory / constitution store
  | 'telemetry'        // Events / drift detection
  | 'compiler'         // Constitution compiler / skeleton / enrichment
  | 'runtime'          // Cache / merge / drift scorer
  | 'projection'       // Director projection layer
  | 'gatekeeper'       // Production gatekeeper
  | 'api'              // API surface (api-surface.ts)
  | 'intent'           // Cinematic intent engine
  | 'energy'           // Semantic energy layer
  | 'shadow'           // Shadow UI router
  | 'intervention'     // Drift intervention engine

// ============================================================
// Error Type — 错误语义类型
// ============================================================

export type ErrorType =
  | 'VALIDATION'       // Schema/structure 验证失败
  | 'INPUT'            // 外部输入不合法
  | 'CONSTITUTION'     // Constitution 异常（空/损坏/缺失字段）
  | 'DRIFT'            // 语义漂移异常
  | 'ENERGY'           // 能量计算异常
  | 'INTERVENTION'     // 干预执行失败
  | 'PROJECTION'       // 投影异常
  | 'MEMORY'           // 记忆存储异常
  | 'GATEKEEPER'       // 生产裁决异常
  | 'INTENT'           // 意图引擎异常
  | 'CACHE'            // 缓存异常
  | 'MERGE'            // 合并仲裁异常
  | 'INTERNAL'         // 内部错误（catch-all）
  | 'CONFIG'           // 配置错误
  | 'DEPENDENCY'       // 外部依赖错误（LLM/DB）

// ============================================================
// Severity
// ============================================================

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'fatal'

// ============================================================
// DirectorError
// ============================================================

export interface DirectorErrorPayload {
  /** 错误唯一 ID */
  errorId: string
  /** 来源层 */
  layer: ErrorLayer
  /** 语义类型 */
  type: ErrorType
  /** 严重级别 */
  severity: ErrorSeverity
  /** 人类可读描述（中文优先） */
  message: string
  /** 是否可恢复 */
  recoverable: boolean
  /** Session ID（如有） */
  sessionId?: string
  /** Trace ID（如有） */
  traceId?: string
  /** 上下文数据（可选，不泄露敏感信息） */
  context?: Record<string, unknown>
  /** 原始错误（仅 development 环境，production 应被 strip） */
  cause?: string
  /** 时间戳 */
  timestamp: number
}

export class DirectorError extends Error {
  public readonly payload: DirectorErrorPayload

  constructor(
    layer: ErrorLayer,
    type: ErrorType,
    severity: ErrorSeverity,
    message: string,
    options?: {
      recoverable?: boolean
      sessionId?: string
      traceId?: string
      context?: Record<string, unknown>
      cause?: Error | string
    },
  ) {
    const errorId = `DE_${layer}_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    super(`[${layer}/${type}] ${message}`)
    this.name = 'DirectorError'

    this.payload = {
      errorId,
      layer,
      type,
      severity,
      message,
      recoverable: options?.recoverable ?? true,
      sessionId: options?.sessionId,
      traceId: options?.traceId,
      context: options?.context,
      cause: options?.cause
        ? (typeof options.cause === 'string' ? options.cause : options.cause.message)
        : undefined,
      timestamp: Date.now(),
    }
  }

  /** 序列化为纯对象（安全传输） */
  toJSON(): DirectorErrorPayload {
    return { ...this.payload }
  }

  /** 格式化日志输出 */
  toLogString(): string {
    const parts = [
      `[${this.payload.severity.toUpperCase()}]`,
      `${this.payload.layer}/${this.payload.type}`,
      this.payload.message,
    ]
    if (this.payload.sessionId) parts.push(`session=${this.payload.sessionId}`)
    if (this.payload.recoverable) parts.push('recoverable')
    return parts.join(' | ')
  }
}

// ============================================================
// Error Factory — 便捷创建
// ============================================================

/** 便捷工厂函数 */
export function directorError(
  layer: ErrorLayer,
  type: ErrorType,
  severity: ErrorSeverity,
  message: string,
  options?: {
    recoverable?: boolean
    sessionId?: string
    traceId?: string
    context?: Record<string, unknown>
    cause?: Error | string
  },
): DirectorError {
  return new DirectorError(layer, type, severity, message, options)
}

/** 非可恢复错误（快捷） */
export function fatalError(
  layer: ErrorLayer,
  type: ErrorType,
  message: string,
  options?: {
    sessionId?: string
    traceId?: string
    context?: Record<string, unknown>
    cause?: Error | string
  },
): DirectorError {
  return new DirectorError(layer, type, 'fatal', message, { ...options, recoverable: false })
}

// ============================================================
// Error Checker
// ============================================================

/** 判断是否为 DirectorError */
export function isDirectorError(err: unknown): err is DirectorError {
  return err instanceof DirectorError
}

/** 安全提取错误信息（任意 error → string） */
export function extractErrorMessage(err: unknown): string {
  if (isDirectorError(err)) return err.payload.message
  if (err instanceof Error) return err.message
  return String(err)
}

/** 安全提取错误 payload（任意 error → DirectorErrorPayload 或 fallback） */
export function extractErrorPayload(err: unknown): DirectorErrorPayload | { errorId: string; message: string; severity: 'high'; recoverable: false } {
  if (isDirectorError(err)) return err.payload
  return {
    errorId: `UNKNOWN_${Date.now()}`,
    message: extractErrorMessage(err),
    severity: 'high',
    recoverable: false,
  }
}

// ============================================================
// Error Collection（用于聚合 multiple errors）
// ============================================================

export interface ErrorCollection {
  errors: DirectorError[]
  count: number
  highestSeverity: ErrorSeverity
  allRecoverable: boolean
}

/** 创建错误集合 */
export function collectErrors(errors: DirectorError[]): ErrorCollection {
  const severityOrder: ErrorSeverity[] = ['low', 'medium', 'high', 'fatal']
  let highestIdx = 0
  let allRecoverable = true

  for (const err of errors) {
    const idx = severityOrder.indexOf(err.payload.severity)
    if (idx > highestIdx) highestIdx = idx
    if (!err.payload.recoverable) allRecoverable = false
  }

  return {
    errors,
    count: errors.length,
    highestSeverity: severityOrder[highestIdx],
    allRecoverable,
  }
}

// ============================================================
// 便捷常量 — 常见错误消息
// ============================================================

export const Errors = {
  sessionNotFound: (sessionId: string) =>
    directorError('api', 'INPUT', 'medium', `Session 不存在: ${sessionId}`, { recoverable: false }),

  constitutionEmpty: (layer: ErrorLayer) =>
    directorError(layer, 'CONSTITUTION', 'high', 'Constitution 为空或未初始化', { recoverable: true }),

  driftCritical: (score: number, dimension: string) =>
    directorError('runtime', 'DRIFT', 'high', `${dimension} 漂移严重: ${score.toFixed(2)}`, { recoverable: true }),

  interventionFailed: (strategy: string, detail: string) =>
    directorError('intervention', 'INTERVENTION', 'medium', `${strategy} 干预失败: ${detail}`, { recoverable: true }),

  projectionRejected: (hint: string) =>
    directorError('projection', 'VALIDATION', 'low', `投影拒绝 hint: ${hint}`, { recoverable: true }),

  cacheMiss: (key: string) =>
    directorError('runtime', 'CACHE', 'low', `缓存未命中: ${key}`, { recoverable: true }),

  dependencyFailed: (name: string, detail: string) =>
    directorError('api', 'DEPENDENCY', 'high', `外部依赖失败: ${name} — ${detail}`, { recoverable: true }),

  internalError: (message: string) =>
    directorError('api', 'INTERNAL', 'fatal', message, { recoverable: false }),
}
