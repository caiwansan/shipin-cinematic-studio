/**
 * director-intelligence/index.ts
 *
 * Director Intelligence 统一导出入口。
 *
 * Phase 3 — 在不破坏 Phase 2 编译系统的前提下，
 * 引入可控的生成能力（Narrative Intelligence）。
 */

export { expandIntent } from './intent-expander.js'
export { generateVariants, getVariants } from './story-variation.js'
export { Sampler, createRng, clampDivergence } from './sampler.js'
export { convergePlans, scorePlan } from './convergence-engine.js'
export type { ExpansionResult } from './intent-expander.js'
export type { VariationConfig } from './story-variation.js'
export type { SamplerConfig } from './sampler.js'
export type { ScoreResult, ConvergenceResult } from './convergence-engine.js'
