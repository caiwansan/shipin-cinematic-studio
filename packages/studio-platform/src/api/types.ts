/**
 * Unified API Response — Mandated by API-SPEC.md
 * All routes MUST return this format.
 *
 * @package @studio/platform/api
 * @see API-SPEC.md §1
 */

/**
 * Standardized API response envelope for all endpoints.
 * Every route in the platform returns this format.
 */
export interface ApiResponse<T = unknown> {
  /** Request success indicator */
  success: boolean;

  /** Response payload (present when success=true) */
  data?: T;

  /** Error information (present when success=false) */
  error?: ApiError;

  /** Distributed tracing ID */
  traceId: string;

  /** Response timestamp (ISO 8601) */
  timestamp: string;

  /** API version string */
  version: string;
}

/**
 * Standardized error structure returned in ApiResponse.error
 */
export interface ApiError {
  /** Machine-readable error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Additional error context for debugging */
  details?: Record<string, unknown>;

  /** Validation error details (for VALIDATION_ERROR) */
  validation?: ValidationDetail[];
}

/**
 * Individual field validation error
 */
export interface ValidationDetail {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

/**
 * Standard error codes — all platform routes MUST use these.
 * @see API-SPEC.md §3
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'BUSINESS_ERROR'
  | 'CAPABILITY_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'INTERNAL_ERROR'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'DEPRECATED'
  | 'PERMISSION_ERROR'
  | 'VERSION_CONFLICT'
  | 'PROVIDER_UNAVAILABLE';

// ============ Pagination Types ============

/**
 * Cursor-based pagination (preferred for large datasets)
 */
export interface CursorPagination {
  /** Base64-encoded cursor for the next page */
  cursor: string;
  /** Whether more items exist */
  hasMore: boolean;
  /** Items per page */
  limit: number;
}

/**
 * Offset-based pagination (alternative for small datasets)
 */
export interface PagePagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: CursorPagination | PagePagination;
}
