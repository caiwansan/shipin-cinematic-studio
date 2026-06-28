// ============================================================
// Constraint Validator — validate constraints against request
// ============================================================

import type { ValidationResult, ValidationError, ValidationWarning } from '../types.js'

export interface ConstraintValidationRequest {
  maxTimeout?: number
  maxRetries?: number
  idempotent?: boolean
  streaming?: boolean
  maxInputSize?: number
  maxOutputSize?: number
  allowedProviders?: string[]
}

export interface ConstraintProfile {
  maxTimeout?: number
  maxRetries?: number
  idempotent?: boolean
  streaming?: boolean
  maxInputSize?: number
  maxOutputSize?: number
  allowedProviders?: string[]
}

export class ConstraintValidator {
  /**
   * Validate request constraints against contract constraints
   */
  validate(
    request: ConstraintValidationRequest,
    constraintsStr: string | null,
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    if (!constraintsStr) {
      return {
        valid: true,
        errors: [],
        warnings: [{ field: 'constraints', code: 'NO_CONSTRAINTS', message: 'No constraints defined' }],
        validatedAt: new Date().toISOString(),
      }
    }

    let profile: ConstraintProfile
    try {
      profile = JSON.parse(constraintsStr)
    } catch {
      return {
        valid: false,
        errors: [{ field: 'constraints', code: 'INVALID_JSON', message: 'Constraints is not valid JSON' }],
        warnings: [],
        validatedAt: new Date().toISOString(),
      }
    }

    // Check timeout
    if (profile.maxTimeout !== undefined && request.maxTimeout !== undefined) {
      if (request.maxTimeout > profile.maxTimeout) {
        errors.push({
          field: 'maxTimeout',
          code: 'EXCEEDS_TIMEOUT',
          message: `Requested timeout (${request.maxTimeout}ms) exceeds contract limit (${profile.maxTimeout}ms)`,
          value: request.maxTimeout,
        })
      }
    }

    // Check retries
    if (profile.maxRetries !== undefined && request.maxRetries !== undefined) {
      if (request.maxRetries > profile.maxRetries) {
        errors.push({
          field: 'maxRetries',
          code: 'EXCEEDS_RETRIES',
          message: `Requested retries (${request.maxRetries}) exceeds contract limit (${profile.maxRetries})`,
          value: request.maxRetries,
        })
      }
    }

    // Check idempotency
    if (profile.idempotent === false && request.idempotent === true) {
      errors.push({
        field: 'idempotent',
        code: 'NOT_IDEMPOTENT',
        message: 'Contract does not support idempotent execution',
        value: request.idempotent,
      })
    }

    // Check streaming
    if (profile.streaming === false && request.streaming === true) {
      errors.push({
        field: 'streaming',
        code: 'NOT_STREAMING',
        message: 'Contract does not support streaming',
        value: request.streaming,
      })
    }

    // Check input size
    if (profile.maxInputSize !== undefined && request.maxInputSize !== undefined) {
      if (request.maxInputSize > profile.maxInputSize) {
        errors.push({
          field: 'maxInputSize',
          code: 'EXCEEDS_INPUT_SIZE',
          message: `Requested input size exceeds contract limit`,
          value: request.maxInputSize,
        })
      }
    }

    // Check output size
    if (profile.maxOutputSize !== undefined && request.maxOutputSize !== undefined) {
      if (request.maxOutputSize > profile.maxOutputSize) {
        errors.push({
          field: 'maxOutputSize',
          code: 'EXCEEDS_OUTPUT_SIZE',
          message: `Requested output size exceeds contract limit`,
          value: request.maxOutputSize,
        })
      }
    }

    // Check allowed providers
    if (profile.allowedProviders && profile.allowedProviders.length > 0) {
      warnings.push({
        field: 'allowedProviders',
        code: 'PROVIDER_RESTRICTION',
        message: `Contract restricted to providers: ${profile.allowedProviders.join(', ')}`,
        value: profile.allowedProviders,
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
    }
  }
}

export const constraintValidator = new ConstraintValidator()
