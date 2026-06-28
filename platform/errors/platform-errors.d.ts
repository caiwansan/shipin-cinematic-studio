import type { PlatformContext } from '../context/platform-context.js';
/**
 * Base platform error with error code, optional details, and context.
 */
export declare class PlatformError extends Error {
    code: string;
    details?: Record<string, any> | undefined;
    context?: PlatformContext | undefined;
    statusCode: number;
    constructor(code: string, message: string, details?: Record<string, any> | undefined, context?: PlatformContext | undefined);
    toJSON(): {
        name: string;
        code: string;
        message: string;
        details: Record<string, any> | undefined;
        statusCode: number;
    };
}
/**
 * Validation error — input doesn't match schema.
 */
export declare class ValidationError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Contract error — capability contract violation.
 */
export declare class ContractError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Repository error — data access layer failure.
 */
export declare class RepositoryError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Runtime error — generic runtime failure.
 */
export declare class RuntimeError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Provider error — external provider failure.
 */
export declare class ProviderError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Execution error — task/action execution failure.
 */
export declare class ExecutionError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Permission error — access denied.
 */
export declare class PermissionError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Configuration error — invalid or missing configuration.
 */
export declare class ConfigurationError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Not found error — entity not found.
 */
export declare class NotFoundError extends PlatformError {
    constructor(message: string, details?: Record<string, any>, context?: PlatformContext);
}
/**
 * Error code mapping for quick reference.
 */
export declare const ErrorCodes: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly CONTRACT_ERROR: "CONTRACT_ERROR";
    readonly REPOSITORY_ERROR: "REPOSITORY_ERROR";
    readonly RUNTIME_ERROR: "RUNTIME_ERROR";
    readonly PROVIDER_ERROR: "PROVIDER_ERROR";
    readonly EXECUTION_ERROR: "EXECUTION_ERROR";
    readonly PERMISSION_ERROR: "PERMISSION_ERROR";
    readonly CONFIGURATION_ERROR: "CONFIGURATION_ERROR";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly TIMEOUT: "TIMEOUT";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
