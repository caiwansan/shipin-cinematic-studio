/**
 * signal-orchestration/index.ts — Phase A-3.3
 *
 * 统一导出
 */

export { TrustLevel, trustWeightRegistry, createTrustWeightRegistry, getBaseWeight } from './trust-weight-registry.js'
export type { TrustWeightRegistry } from './trust-weight-registry.js'

export { DEFAULT_PRIORITY_CONFIG, signalPriorityEngine, createSignalPriorityEngine } from './signal-priority-engine.js'
export type { PriorityConfig, PriorityRankedSignal, SignalPriorityEngine } from './signal-priority-engine.js'

export { ConflictStrategy, createConflictResolver, DEFAULT_CONFLICT_CONFIG } from './conflict-resolver.js'
export type { ConflictDetectionConfig, ResolvedSignal, ConflictGroup, ConflictResolver } from './conflict-resolver.js'

export { OrchestrationStage, createOrchestrationResult } from './orchestration-result.js'
export type { OrchestrationResult } from './orchestration-result.js'

export { DEFAULT_ORCHESTRATOR_CONFIG, signalOrchestrator, createSignalOrchestrator } from './signal-orchestrator.js'
export type { OrchestratorConfig, SignalOrchestrator } from './signal-orchestrator.js'
