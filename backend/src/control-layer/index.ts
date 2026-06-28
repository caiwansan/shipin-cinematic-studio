/**
 * control-layer/index.ts
 *
 * Phase 5 — Control Layer 统一导出
 */
export { orchestrate } from './orchestrator.js'
export { runSafetyGuard, checkDSLOverreach } from './guard.js'
export type { ExecutionPlan, CombinationResult } from './orchestrator.js'
export type { GuardResult } from './guard.js'
