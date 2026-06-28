/**
 * A1-3 runtime-validator.ts — 标准错误结构（Error Contract）
 *
 * 全系统统一校验/错误返回格式。
 * 被 B1/B2/C1 等下游模块 import。
 */

// ─── 标准错误结构 ───

export interface RuntimeError {
  code: string
  message: string
  details?: Record<string, any>
  traceId?: string
}

export interface SuccessResult<T = any> {
  success: true
  data: T
}

export interface FailResult {
  success: false
  error: RuntimeError
}

export type ValidatedResult<T = any> = SuccessResult<T> | FailResult

// ─── 错误码常量 ───

export const ErrorCodes = {
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  ASSET_TYPE_MISMATCH: 'ASSET_TYPE_MISMATCH',
  ASSET_STATUS_INVALID: 'ASSET_STATUS_INVALID',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  MODEL_DISABLED: 'MODEL_DISABLED',
  AI_INVOCATION_FAILED: 'AI_INVOCATION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

// ─── Validator ───

export class RuntimeValidator {
  static ok<T>(data: T): SuccessResult<T> {
    return { success: true, data }
  }

  static fail(error: RuntimeError): FailResult {
    return { success: false, error }
  }

  static assetNotFound(id: string): FailResult {
    return this.fail({
      code: ErrorCodes.ASSET_NOT_FOUND,
      message: `资产 ${id} 不存在`,
      details: { assetId: id },
    })
  }

  static typeMismatch(expected: string, got: string): FailResult {
    return this.fail({
      code: ErrorCodes.ASSET_TYPE_MISMATCH,
      message: `资产类型不匹配：期望 ${expected}，实际 ${got}`,
      details: { expected, got },
    })
  }

  static statusInvalid(current: string, target: string): FailResult {
    return this.fail({
      code: ErrorCodes.ASSET_STATUS_INVALID,
      message: `状态变更不允许：当前 ${current} → ${target}`,
      details: { current, target },
    })
  }

  static validationFailed(errors: string[]): FailResult {
    return this.fail({
      code: ErrorCodes.VALIDATION_FAILED,
      message: '校验失败',
      details: { errors },
    })
  }

  static modelDisabled(modelType: string): FailResult {
    return this.fail({
      code: ErrorCodes.MODEL_DISABLED,
      message: `您已关闭 ${modelType} 功能，请在"大模型设置"中开启后再试`,
    })
  }

  static internalError(err: Error): FailResult {
    return this.fail({
      code: ErrorCodes.INTERNAL_ERROR,
      message: err.message || '内部错误',
    })
  }

  /**
   * 校验资产是否存在
   */
  static validateAssetExists<T>(asset: T | null, id: string): ValidatedResult<T> {
    if (!asset) return this.assetNotFound(id)
    return this.ok(asset)
  }
}
