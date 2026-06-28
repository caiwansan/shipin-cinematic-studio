// ============================================================
// Platform Error Model — unified error hierarchy for all Runtimes
// ARCH-001-H: All Runtimes must throw PlatformError subclasses
// ARCH-002: All errors carry optional PlatformContext
// ============================================================

import type { PlatformContext } from '../context/platform-context.js'

/**
 * Base platform error with error code, optional details, and context.
 */
export class PlatformError extends Error {
  public statusCode: number = 500

  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public context?: PlatformContext,
  ) {
    super(message)
    this.name = 'PlatformError'
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
    }
  }
}

/**
 * Validation error — input doesn't match schema.
 */
export class ValidationError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('VALIDATION_ERROR', message, details, context)
    this.name = 'ValidationError'
    this.statusCode = 400
  }
}

/**
 * Contract error — capability contract violation.
 */
export class ContractError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('CONTRACT_ERROR', message, details, context)
    this.name = 'ContractError'
    this.statusCode = 400
  }
}

/**
 * Repository error — data access layer failure.
 */
export class RepositoryError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('REPOSITORY_ERROR', message, details, context)
    this.name = 'RepositoryError'
    this.statusCode = 500
  }
}

/**
 * Runtime error — generic runtime failure.
 */
export class RuntimeError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('RUNTIME_ERROR', message, details, context)
    this.name = 'RuntimeError'
    this.statusCode = 500
  }
}

/**
 * Provider error — external provider failure.
 */
export class ProviderError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('PROVIDER_ERROR', message, details, context)
    this.name = 'ProviderError'
    this.statusCode = 502
  }
}

/**
 * Execution error — task/action execution failure.
 */
export class ExecutionError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('EXECUTION_ERROR', message, details, context)
    this.name = 'ExecutionError'
    this.statusCode = 500
  }
}

/**
 * Permission error — access denied.
 */
export class PermissionError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('PERMISSION_ERROR', message, details, context)
    this.name = 'PermissionError'
    this.statusCode = 403
  }
}

/**
 * Configuration error — invalid or missing configuration.
 */
export class ConfigurationError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('CONFIGURATION_ERROR', message, details, context)
    this.name = 'ConfigurationError'
    this.statusCode = 500
  }
}

/**
 * Not found error — entity not found.
 */
export class NotFoundError extends PlatformError {
  constructor(message: string, details?: Record<string, any>, context?: PlatformContext) {
    super('NOT_FOUND', message, details, context)
    this.name = 'NotFoundError'
    this.statusCode = 404
  }
}

/**
 * Error code mapping for quick reference.
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  REPOSITORY_ERROR: 'REPOSITORY_ERROR',
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
