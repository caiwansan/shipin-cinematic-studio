/**
 * Visual Constraint Loop — 入口模块
 *
 * 所有子模块统一从此导出。
 * Phase 5 集成时只需 import { visualConstraintPipeline } from './services/visual-constraint/index.js'
 *
 * 当前状态：旁路运行（Feature Flag 默认关闭）
 * 启用方式：process.env.ENABLE_VISUAL_CONSTRAINT_LOOP === 'true'
 */

import type { SampleGeneratorOptions } from './sample-generator.js'
import type { SelectionOptions, SelectionResult } from './selection-engine.js'
import { FOUR_VIEW_CONSTRAINT } from './types.js'

export { generateImageSamples } from './sample-generator.js'
export { validateImageStructure, validateImageStructureLegacy, isValidationDegraded } from './vision-validator.js'
export { scoreView, viewPassed, selectBestCandidate, globalConsistencyScore, isGloballyAcceptable } from './constraint-scoring.js'
export { selectBestViews } from './selection-engine.js'
export { FOUR_VIEW_CONSTRAINT, DEGRADED_RESULT } from './types.js'
export type { SampleGeneratorOptions } from './sample-generator.js'
export type { SelectionOptions, SelectionResult } from './selection-engine.js'
export type { ViewType, ViewValidationResult, ViewCandidate, ViewCandidatePool, SelectedViews, IdentityState, ViewConstraint, ValidationResult } from './types.js'

// ─── Feature Flag ───
export const VISUAL_CONSTRAINT_ENABLED = (): boolean => {
  return process.env.ENABLE_VISUAL_CONSTRAINT_LOOP === 'true'
}

/**
 * 完整 Pipeline 入口（供 Phase 5 集成使用）
 *
 * 入参：4 组 prompt + 参数
 * 出参：最佳 4 视图 URL + 评分
 */
export async function visualConstraintPipeline(
  viewOptions: Record<'portrait' | 'front' | 'side' | 'back', SampleGeneratorOptions & { viewType: string }>,
  userId: string,
): Promise<SelectionResult> {
  const { generateImageSamples } = await import('./sample-generator.js')
  const { selectBestViews } = await import('./selection-engine.js')

  // Step 1: 并行生成所有视图的候选池
  const [portraitCandidates, frontCandidates, sideCandidates, backCandidates] = await Promise.all([
    generateImageSamples(viewOptions.portrait),
    generateImageSamples(viewOptions.front),
    generateImageSamples(viewOptions.side),
    generateImageSamples(viewOptions.back),
  ])

  const pool = {
    portrait: portraitCandidates,
    front: frontCandidates,
    side: sideCandidates,
    back: backCandidates,
  }

  // Step 2: 选择最佳组合
  return selectBestViews({ pool, userId })
}
