/**
 * runtime/runtime-gate.ts — Phase 4.3 Step 4
 *
 * Lightweight runtime enforcement gate.
 * Currently only enforces: OBSERVE domains must not execute in SYNC path.
 *
 * If the gate trips:
 * - Logs a warning (graceful)
 * - In CI/strict mode: throws a clear error
 *
 * @phase4-owner { entry: "narrative-gateway", mode: "SYNC" }
 */

// Domains that are allowed to call narrativeGateway.execute()
const ALLOWED_CALLER_DOMAINS = new Set([
  'SYNC',
  'ASYNC',
  'WORKER',
  'TOOL',
])

/**
 * Lightweight gate — checks if a module's domain is allowed to
 * participate in execution routing.
 *
 * If strict mode is enabled, throws on violation.
 *
 * Usage: called at the top of narrative-gateway.execute()
 */
export function checkDomainAllowed(
  callerModule: string,
  callerMode: string,
  strictMode: boolean = false,
): void {
  if (ALLOWED_CALLER_DOMAINS.has(callerMode)) return

  const message = `[RuntimeGate] Domain violation: ${callerModule} (mode=${callerMode}) attempted execution. ` +
    `Allowed domains: ${[...ALLOWED_CALLER_DOMAINS].join(', ')}`

  console.warn(message)

  if (strictMode) {
    throw new Error(`RuntimeGate: ${callerModule} belongs to ${callerMode} domain, which is not allowed to execute.`)
  }
}
