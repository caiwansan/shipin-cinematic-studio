// ============================================================
// Platform Error Model — unified error hierarchy for all Runtimes
// ARCH-001-H: All Runtimes must throw PlatformError subclasses
// ============================================================

/**
 * Base platform error with error code and optional details.
 */
export class PlatformError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
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
    }
  }
}

/**
 * Validation error — input doesn't match schema.
 */
export class ValidationError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, details)
    this.name = 'ValidationError'
  }
}

/**
 * Contract error — capability contract violation.
 */
export class ContractError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('CONTRACT_ERROR', message, details)
    this.name = 'ContractError'
  }
}

/**
 * Repository error — data access layer failure.
 */
export class RepositoryError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('REPOSITORY_ERROR', message, details)
    this.name = 'RepositoryError'
  }
}

/**
 * Runtime error — generic runtime failure.
 */
export class RuntimeError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('RUNTIME_ERROR', message, details)
    this.name = 'RuntimeError'
  }
}

/**
 * Provider error — external provider failure.
 */
export class ProviderError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('PROVIDER_ERROR', message, details)
    this.name = 'ProviderError'
  }
}

/**
 * Execution error — task/action execution failure.
 */
export class ExecutionError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('EXECUTION_ERROR', message, details)
    this.name = 'ExecutionError'
  }
}

/**
 * Permission error — access denied.
 */
export class PermissionError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('PERMISSION_ERROR', message, details)
    this.name = 'PermissionError'
  }
}

/**
 * Configuration error — invalid or missing configuration.
 */
export class ConfigurationError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('CONFIGURATION_ERROR', message, details)
    this.name = 'ConfigurationError'
  }
}

/**
 * Not found error — entity not found.
 */
export class NotFoundError extends PlatformError {
  constructor(message: string, details?: Record<string, any>) {
    super('NOT_FOUND', message, details)
    this.name = 'NotFoundError'
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
