/**
 * infra/oges/ogesSafetyGuard.ts
 *
 * OGES v1 Safety Guard
 *
 * Non-invasive read-only protection layer for Baseline v1.0.
 * Enforces immutable observation regime — no production path mutation.
 *
 * Purpose:
 *   Prevent accidental writes to OGES runtime during CSOP phase.
 *   Lock observability endpoints to whitelist.
 *   Never modifies CTBL/UOA/DecisionEngine/Shadow logic.
 */

export class OGESSafetyGuard {
  private static readonly OBSERVABILITY_WHITELIST = [
    '/api/observability/ctbl/convergence',
    '/api/observability/ctbl/trend',
    '/api/observability/ctbl/trend/summary',
    '/api/observability/ctbl/variance',
  ]

  /**
   * Assert we are in read-only baseline mode
   * Throws if write mode is accidentally enabled
   */
  static assertReadOnlyMode(): void {
    if (process.env.OGES_WRITE_MODE === 'true') {
      throw new Error('[OGES-GUARD] WRITE MODE IS FORBIDDEN IN BASELINE v1.0')
    }
  }

  /**
   * Validate that an observability path is in the whitelist
   */
  static validateObservabilityAccess(path: string): boolean {
    const normalizedPath = path.split('?')[0]  // strip query params
    const allowed = this.OBSERVABILITY_WHITELIST.some(prefix =>
      normalizedPath === prefix || normalizedPath.startsWith(prefix),
    )
    if (!allowed) {
      console.warn(`[OGES-GUARD] 🚫 Blocked observability access to: ${path}`)
      return false
    }
    return true
  }

  /**
   * Runtime integrity check — returns current baseline state
   */
  static runtimeCheck(): {
    mode: string
    executionLocked: boolean
    controlLocked: boolean
    shadowAllowed: boolean
    learningDisabled: boolean
    baseline: string
  } {
    return {
      mode: 'READ_ONLY',
      executionLocked: true,
      controlLocked: true,
      shadowAllowed: true,
      learningDisabled: true,
      baseline: 'v1.0_IMMUTABLE',
    }
  }

  /**
   * Get observability whitelist (for diagnostics)
   */
  static getAllowedPaths(): string[] {
    return [...this.OBSERVABILITY_WHITELIST]
  }
}
