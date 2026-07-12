/**
 * Base Repository — shared contract for all GEO Repositories
 *
 * All Repositories follow:
 * - Singleton pattern (getXxxRepository())
 * - Uniform method signatures
 * - Consistent error handling
 * - Cachable state (with refresh/invalidate)
 * - SSR-safe (guarded by typeof window check)
 * - Unit-testable (injectable API client)
 */

export interface RepositoryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastFetched: number | null
}

export interface Repository<T> {
  /** Get current data (may return cached) */
  get(): T | null
  /** Fetch fresh data from API */
  refresh(): Promise<T>
  /** Clear cached data */
  invalidate(): void
  /** Current loading state */
  isLoading(): boolean
  /** Current error state */
  getError(): string | null
}

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string }

export function createInitialState<T>(): RepositoryState<T> {
  return {
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
  }
}
