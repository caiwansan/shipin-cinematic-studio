// ============================================================
// GEO AI Provider — Circuit Breaker
// RC2-T001: GEO AI Provider Infrastructure
//
// State machine:
//   CLOSED (正常) → failure >= threshold → OPEN (断开)
//   OPEN → after duration → HALF_OPEN (半开)
//   HALF_OPEN → success → CLOSED
//   HALF_OPEN → failure → OPEN
//
// Supports per-provider circuit breakers.
// ============================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitStateData {
  state: CircuitState
  failureCount: number
  successCountInHalfOpen: number
  lastFailureAt: number | null
  openedAt: number | null
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitStateData>()
  private threshold: number
  private durationMs: number
  private halfOpenMaxSuccesses: number

  constructor(
    threshold: number = 5,
    durationMs: number = 30000,
    halfOpenMaxSuccesses: number = 3
  ) {
    this.threshold = threshold
    this.durationMs = durationMs
    this.halfOpenMaxSuccesses = halfOpenMaxSuccesses
  }

  /**
   * Check if a request is allowed for the given provider.
   */
  allowRequest(provider: string): { allowed: boolean; state: CircuitState } {
    const circuit = this.circuits.get(provider)
    if (!circuit) {
      return { allowed: true, state: 'CLOSED' }
    }

    if (circuit.state === 'CLOSED') {
      return { allowed: true, state: 'CLOSED' }
    }

    if (circuit.state === 'OPEN') {
      const elapsed = Date.now() - (circuit.openedAt ?? Date.now())
      if (elapsed >= this.durationMs) {
        // Transition to HALF_OPEN
        circuit.state = 'HALF_OPEN'
        circuit.successCountInHalfOpen = 0
        return { allowed: true, state: 'HALF_OPEN' }
      }
      return { allowed: false, state: 'OPEN' }
    }

    // HALF_OPEN state — allow limited requests
    return { allowed: true, state: 'HALF_OPEN' }
  }

  /**
   * Record a successful request.
   */
  recordSuccess(provider: string): void {
    const circuit = this.circuits.get(provider)
    if (!circuit) return

    if (circuit.state === 'HALF_OPEN') {
      circuit.successCountInHalfOpen++
      if (circuit.successCountInHalfOpen >= this.halfOpenMaxSuccesses) {
        // Reset to CLOSED
        circuit.state = 'CLOSED'
        circuit.failureCount = 0
        circuit.successCountInHalfOpen = 0
        circuit.openedAt = null
        circuit.lastFailureAt = null
      }
    } else if (circuit.state === 'CLOSED') {
      // Reset failure count on success
      circuit.failureCount = Math.max(0, circuit.failureCount - 1)
    }
  }

  /**
   * Record a failed request.
   */
  recordFailure(provider: string): void {
    const circuit = this.circuits.get(provider)
    if (!circuit) {
      // Initialize with first failure
      this.circuits.set(provider, {
        state: 'CLOSED',
        failureCount: 1,
        successCountInHalfOpen: 0,
        lastFailureAt: Date.now(),
        openedAt: null,
      })
      return
    }

    circuit.lastFailureAt = Date.now()

    switch (circuit.state) {
      case 'CLOSED':
        circuit.failureCount++
        if (circuit.failureCount >= this.threshold) {
          circuit.state = 'OPEN'
          circuit.openedAt = Date.now()
          console.warn(`[GeoCircuitBreaker] 🔴 ${provider} → OPEN (${circuit.failureCount} failures)`)
        }
        break

      case 'HALF_OPEN':
        // Failure in HALF_OPEN → back to OPEN
        circuit.state = 'OPEN'
        circuit.openedAt = Date.now()
        circuit.successCountInHalfOpen = 0
        console.warn(`[GeoCircuitBreaker] 🔴 ${provider} → OPEN (probe failed)`)
        break

      case 'OPEN':
        // Already open, nothing to do
        break
    }
  }

  /**
   * Get the current state of a provider's circuit.
   */
  getState(provider: string): CircuitState {
    const circuit = this.circuits.get(provider)
    if (!circuit) return 'CLOSED'

    // Auto-transition from OPEN to HALF_OPEN if enough time passed
    if (circuit.state === 'OPEN' && circuit.openedAt) {
      if (Date.now() - circuit.openedAt >= this.durationMs) {
        circuit.state = 'HALF_OPEN'
        circuit.successCountInHalfOpen = 0
      }
    }

    return circuit.state
  }

  /**
   * Reset a provider's circuit breaker.
   */
  reset(provider?: string): void {
    if (provider) {
      this.circuits.delete(provider)
    } else {
      this.circuits.clear()
    }
  }

  /**
   * Get all circuit states.
   */
  getAllStates(): Record<string, { state: CircuitState; failureCount: number; lastFailureAt: number | null }> {
    const result: Record<string, any> = {}
    for (const [provider, data] of this.circuits) {
      result[provider] = {
        state: this.getState(provider),
        failureCount: data.failureCount,
        lastFailureAt: data.lastFailureAt,
      }
    }
    return result
  }
}
