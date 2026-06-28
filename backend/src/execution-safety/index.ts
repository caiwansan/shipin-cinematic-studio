/**
 * execution-safety/index.ts — 统一导出
 */
export { safetyGate } from './safety-gate.js'
export { onSuccess, onFailure, getCircuitState, FAILURE_THRESHOLD, COOLDOWN_MS } from './circuit-breaker.js'
export type { SafetyState, CircuitState } from './types.js'
