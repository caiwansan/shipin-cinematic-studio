/**
 * grounding/index.ts — Phase A-3.2 Reality Grounding Layer
 *
 * 统一导出层
 */

export { SignalAuthority, isSignalExpired, effectiveReliability, sortByReliability } from './grounding-signal.js'
export type { GroundingSignal } from './grounding-signal.js'

export { DriftLevel, assessDrift, classifyDriftLevel, aggregateDrifts } from './drift-detector.js'
export type { DriftAssessment, AggregatedDrift } from './drift-detector.js'

export { MAX_ADJUSTMENT_RATIO, createRealityAdjustmentEngine } from './reality-adjustment-engine.js'
export type { AdjustedScoreCard, AdjustmentRecord, AdjustmentConfig, RealityAdjustmentEngine } from './reality-adjustment-engine.js'

export { createDriftLogger } from './drift-logger.js'
export type { DriftRecord, DriftLogger, HistoricalBaseline, BaselineQuery } from './drift-logger.js'

export { createGroundingLayer } from './grounding-integration.js'
export type { GroundingLayer, GroundingResult } from './grounding-integration.js'
