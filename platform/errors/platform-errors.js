"use strict";
// ============================================================
// Platform Error Model — unified error hierarchy for all Runtimes
// ARCH-001-H: All Runtimes must throw PlatformError subclasses
// ARCH-002: All errors carry optional PlatformContext
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodes = exports.NotFoundError = exports.ConfigurationError = exports.PermissionError = exports.ExecutionError = exports.ProviderError = exports.RuntimeError = exports.RepositoryError = exports.ContractError = exports.ValidationError = exports.PlatformError = void 0;
/**
 * Base platform error with error code, optional details, and context.
 */
class PlatformError extends Error {
    code;
    details;
    context;
    statusCode = 500;
    constructor(code, message, details, context) {
        super(message);
        this.code = code;
        this.details = details;
        this.context = context;
        this.name = 'PlatformError';
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            details: this.details,
            statusCode: this.statusCode,
        };
    }
}
exports.PlatformError = PlatformError;
/**
 * Validation error — input doesn't match schema.
 */
class ValidationError extends PlatformError {
    constructor(message, details, context) {
        super('VALIDATION_ERROR', message, details, context);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}
exports.ValidationError = ValidationError;
/**
 * Contract error — capability contract violation.
 */
class ContractError extends PlatformError {
    constructor(message, details, context) {
        super('CONTRACT_ERROR', message, details, context);
        this.name = 'ContractError';
        this.statusCode = 400;
    }
}
exports.ContractError = ContractError;
/**
 * Repository error — data access layer failure.
 */
class RepositoryError extends PlatformError {
    constructor(message, details, context) {
        super('REPOSITORY_ERROR', message, details, context);
        this.name = 'RepositoryError';
        this.statusCode = 500;
    }
}
exports.RepositoryError = RepositoryError;
/**
 * Runtime error — generic runtime failure.
 */
class RuntimeError extends PlatformError {
    constructor(message, details, context) {
        super('RUNTIME_ERROR', message, details, context);
        this.name = 'RuntimeError';
        this.statusCode = 500;
    }
}
exports.RuntimeError = RuntimeError;
/**
 * Provider error — external provider failure.
 */
class ProviderError extends PlatformError {
    constructor(message, details, context) {
        super('PROVIDER_ERROR', message, details, context);
        this.name = 'ProviderError';
        this.statusCode = 502;
    }
}
exports.ProviderError = ProviderError;
/**
 * Execution error — task/action execution failure.
 */
class ExecutionError extends PlatformError {
    constructor(message, details, context) {
        super('EXECUTION_ERROR', message, details, context);
        this.name = 'ExecutionError';
        this.statusCode = 500;
    }
}
exports.ExecutionError = ExecutionError;
/**
 * Permission error — access denied.
 */
class PermissionError extends PlatformError {
    constructor(message, details, context) {
        super('PERMISSION_ERROR', message, details, context);
        this.name = 'PermissionError';
        this.statusCode = 403;
    }
}
exports.PermissionError = PermissionError;
/**
 * Configuration error — invalid or missing configuration.
 */
class ConfigurationError extends PlatformError {
    constructor(message, details, context) {
        super('CONFIGURATION_ERROR', message, details, context);
        this.name = 'ConfigurationError';
        this.statusCode = 500;
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Not found error — entity not found.
 */
class NotFoundError extends PlatformError {
    constructor(message, details, context) {
        super('NOT_FOUND', message, details, context);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}
exports.NotFoundError = NotFoundError;
/**
 * Error code mapping for quick reference.
 */
exports.ErrorCodes = {
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
};
