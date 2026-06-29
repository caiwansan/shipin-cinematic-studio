/**
 * HealthManager — Per-provider health tracking.
 *
 * Health is more than up/down. Tracks:
 * - Success rate (0-100%)
 * - Average latency
 * - Error rate
 * - Consecutive failures
 * - Auto-decay for providers that have been down
 *
 * @package @studio/platform/capability
 */

// ============ Health Types ============

/**
 * Provider health status levels.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unavailable';

/**
 * Full health record for a single provider.
 */
export interface ProviderHealth {
  /** Provider identifier */
  providerId: string;

  /** Current health status */
  status: HealthStatus;

  /** Success rate percentage (0-100) */
  successRate: number;

  /** Average latency in milliseconds */
  avgLatencyMs: number;

  /** Error rate percentage (0-100) */
  errorRate: number;

  /** Number of consecutive failures */
  consecutiveFailures: number;

  /** Timestamp of last health check */
  lastChecked: number;

  /** Last error message (if any) */
  lastError?: string;
}

/**
 * Internal tracking state for a single provider.
 */
interface ProviderState {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalLatencyMs: number;
  consecutiveFailures: number;
  lastChecked: number;
  lastError?: string;
  lastSuccessTime: number;
  lastFailureTime: number;
}

// ============ HealthManager ============

/**
 * HealthManager — tracks and reports provider health.
 *
 * Features:
 * - recordSuccess: mark a successful call with latency
 * - recordFailure: mark a failed call with error
 * - get: get health for a specific provider
 * - getAll: get health for all providers
 * - isHealthy: quick health check for a provider
 * - Auto-decay: unavailable providers slowly recover to degraded over TTL
 */
export class HealthManager {
  /** Provider state (internal tracking) */
  private state: Map<string, ProviderState> = new Map();

  /** Default TTL in ms before an unavailable provider decays to degraded (5 minutes) */
  private readonly decayTtlMs: number = 5 * 60 * 1000;

  /** Window size for health calculations (last N calls) */
  private readonly windowSize: number = 100;

  /** Ring buffer for recent latency measurements */
  private latencyBuffers: Map<string, number[]> = new Map();

  /**
   * Record a successful provider call.
   *
   * @param providerId — The provider that succeeded
   * @param latencyMs — The call latency in milliseconds
   */
  recordSuccess(providerId: string, latencyMs: number): void {
    const state = this.getOrCreateState(providerId);
    state.totalCalls++;
    state.successCalls++;
    state.totalLatencyMs += latencyMs;
    state.consecutiveFailures = 0;
    state.lastChecked = Date.now();
    state.lastSuccessTime = Date.now();

    // Track latency in ring buffer
    this.recordLatency(providerId, latencyMs);

    // Prune state if exceeded window
    this.pruneState(providerId, state);
  }

  /**
   * Record a failed provider call.
   *
   * @param providerId — The provider that failed
   * @param error — Error message from the failure
   */
  recordFailure(providerId: string, error: string): void {
    const state = this.getOrCreateState(providerId);
    state.totalCalls++;
    state.failedCalls++;
    state.consecutiveFailures++;
    state.lastChecked = Date.now();
    state.lastError = error;
    state.lastFailureTime = Date.now();

    // Prune state if exceeded window
    this.pruneState(providerId, state);
  }

  /**
   * Get the current health record for a provider.
   * If no calls have been recorded, returns a default healthy record.
   *
   * @param providerId — The provider to check
   * @returns ProviderHealth record
   */
  get(providerId: string): ProviderHealth {
    this.decayUnhealthy();

    const state = this.state.get(providerId);
    if (!state || state.totalCalls === 0) {
      return {
        providerId,
        status: 'healthy',
        successRate: 100,
        avgLatencyMs: 0,
        errorRate: 0,
        consecutiveFailures: 0,
        lastChecked: Date.now(),
      };
    }

    const successRate = (state.successCalls / state.totalCalls) * 100;
    const errorRate = (state.failedCalls / state.totalCalls) * 100;
    const avgLatencyMs = state.totalCalls > 0
      ? Math.round(state.totalLatencyMs / state.totalCalls)
      : 0;

    const status = this.computeStatus(successRate, state.consecutiveFailures, state.lastSuccessTime);

    return {
      providerId,
      status,
      successRate: Math.round(successRate * 100) / 100,
      avgLatencyMs,
      errorRate: Math.round(errorRate * 100) / 100,
      consecutiveFailures: state.consecutiveFailures,
      lastChecked: state.lastChecked,
      lastError: state.lastError,
    };
  }

  /**
   * Get health records for all tracked providers.
   */
  getAll(): Record<string, ProviderHealth> {
    this.decayUnhealthy();

    const result: Record<string, ProviderHealth> = {};
    for (const providerId of this.state.keys()) {
      result[providerId] = this.get(providerId);
    }
    return result;
  }

  /**
   * Quick health check — is this provider healthy enough for routing?
   *
   * A provider is considered healthy if:
   * - Status is not 'unavailable'
   * - Success rate > 50%
   * - Consecutive failures < 5
   *
   * @param providerId — The provider to check
   * @returns true if the provider is healthy enough
   */
  isHealthy(providerId: string): boolean {
    const health = this.get(providerId);
    return health.status !== 'unavailable';
  }

  /**
   * Reset health tracking for a provider.
   * Useful when a provider is re-registered or reconfigured.
   */
  reset(providerId: string): void {
    this.state.delete(providerId);
    this.latencyBuffers.delete(providerId);
  }

  /**
   * Reset all health tracking.
   */
  resetAll(): void {
    this.state.clear();
    this.latencyBuffers.clear();
  }

  // ============ Private ============

  /**
   * Auto-decay: if a provider has been unavailable for longer than TTL,
   * recover to 'degraded' status so it gets retried.
   */
  private decayUnhealthy(): void {
    const now = Date.now();
    for (const [providerId, state] of this.state.entries()) {
      if (state.consecutiveFailures > 0 && (now - state.lastFailureTime) > this.decayTtlMs) {
        console.log(`[HealthManager] Decaying provider '${providerId}' from unhealthy to degraded (TTL expired)`);
        // Reset consecutive failures but keep history
        state.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Get or create internal state for a provider.
   */
  private getOrCreateState(providerId: string): ProviderState {
    let state = this.state.get(providerId);
    if (!state) {
      state = {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        totalLatencyMs: 0,
        consecutiveFailures: 0,
        lastChecked: Date.now(),
        lastSuccessTime: Date.now(),
        lastFailureTime: 0,
      };
      this.state.set(providerId, state);
    }
    return state;
  }

  /**
   * Record latency in ring buffer for rolling average.
   */
  private recordLatency(providerId: string, latencyMs: number): void {
    let buffer = this.latencyBuffers.get(providerId);
    if (!buffer) {
      buffer = [];
      this.latencyBuffers.set(providerId, buffer);
    }
    buffer.push(latencyMs);
    if (buffer.length > this.windowSize) {
      buffer.shift();
    }
  }

  /**
   * Prune old data if state exceeds window size.
   * Keeps only the last windowSize calls.
   */
  private pruneState(providerId: string, state: ProviderState): void {
    if (state.totalCalls > this.windowSize) {
      state.totalCalls = this.windowSize;
      state.successCalls = Math.min(state.successCalls, this.windowSize);
      state.failedCalls = Math.min(state.failedCalls, this.windowSize);

      // Reset latency total (will be recalculated from ring buffer)
      const buffer = this.latencyBuffers.get(providerId);
      if (buffer && buffer.length > 0) {
        state.totalLatencyMs = buffer.reduce((sum, l) => sum + l, 0);
      }
    }
  }

  /**
   * Compute health status based on current metrics.
   */
  private computeStatus(
    successRate: number,
    consecutiveFailures: number,
    lastSuccessTime: number
  ): HealthStatus {
    if (consecutiveFailures >= 5) {
      return 'unavailable';
    }
    if (consecutiveFailures >= 3 || successRate < 50) {
      return 'degraded';
    }
    return 'healthy';
  }
}
