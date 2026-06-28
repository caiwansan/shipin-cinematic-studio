/**
 * Visual Constraint Loop — Phase 4: Selection Engine
 *
 * 从多采样候选池中选择最佳组合。
 *
 * 核心流程：
 *   1. 对每个视图的 N 个候选做 validate + score
 *   2. 选每个视图的最佳候选
 *   3. 计算全局一致性评分
 *   4. 若全局可接受，返回 selected views
 *   5. 若不可接受，尝试次优组合
 *   6. 所有组合都不可接受，返回最佳的次优方案
 */

import type {
  ViewType,
  ViewCandidate,
  ViewCandidatePool,
  SelectedViews,
  IdentityState,
  ViewConstraint,
} from './types.js'
import { FOUR_VIEW_CONSTRAINT } from './types.js'
import { validateImageStructure } from './vision-validator.js'
import { scoreView, selectBestCandidate, isGloballyAcceptable, viewPassed } from './constraint-scoring.js'

export interface SelectionOptions {
  /**
   * 每个视图的候选池（portrait/front/side/back 各有 N 个候选）
   */
  pool: ViewCandidatePool

  /**
   * 用户 ID（BYOK 链路用）
   */
  userId: string

  /**
   * 约束 schema（默认 FOUR_VIEW_CONSTRAINT）
   */
  constraint?: ViewConstraint

  /**
   * 全局最低接受分（默认 60）
   */
  minGlobalScore?: number
}

export interface SelectionResult {
  selected: SelectedViews
  globalScore: number
  globalDetails: string[]
  acceptable: boolean
}

/**
 * 主入口：从候选池中选择最佳四视图组合
 */
export async function selectBestViews(
  options: SelectionOptions,
): Promise<SelectionResult> {
  const {
    pool,
    userId,
    constraint = FOUR_VIEW_CONSTRAINT,
    minGlobalScore = 60,
  } = options

  // Step 1: 对每个候选项做 validate + score
  const validatedPool = await validateAllCandidates(pool, userId, constraint)

  // Step 2: 选每个视图的最佳候选
  const selected = selectEachView(validatedPool, constraint)

  // Step 3: 全局评分
  const { score, details } = await computeGlobalScore(validatedPool, selected, userId)
  const acceptable = score >= minGlobalScore

  return {
    selected,
    globalScore: score,
    globalDetails: details,
    acceptable,
  }
}

/**
 * 对所有候选项批量校验 + 评分
 */
async function validateAllCandidates(
  pool: ViewCandidatePool,
  userId: string,
  constraint: ViewConstraint,
): Promise<ViewCandidatePool> {
  const result: ViewCandidatePool = {} as ViewCandidatePool

  for (const vt of ['portrait', 'front', 'side', 'back'] as ViewType[]) {
    const candidates = pool[vt] || []
    const validated = await Promise.all(
      candidates.map(async (c) => {
        if (!c.url) return { ...c, validation: null, validationStatus: undefined, score: 0 }

        const { result: validation, validationStatus } = await validateImageStructure(c.url, userId)
        const score = scoreView(vt, validation, constraint, validationStatus)

        return { ...c, validation, validationStatus, score }
      }),
    )
    result[vt] = validated
  }

  return result
}

/**
 * 为每个视图选择最佳候选
 */
function selectEachView(
  pool: ViewCandidatePool,
  constraint: ViewConstraint,
): SelectedViews {
  const identityState: IdentityState = {
    frontImageUrl: '',
    clothingSignature: '',
    poseConsistency: 0,
  }

  const selected: SelectedViews = {
    portrait: null,
    front: null,
    side: null,
    back: null,
    identityState: null,
  }

  for (const vt of ['portrait', 'front', 'side', 'back'] as ViewType[]) {
    const candidates = pool[vt] || []
    selected[vt] = selectBestCandidate(candidates, vt, constraint)
  }

  // 用 front 作为 identity anchor
  if (selected.front?.url) {
    identityState.frontImageUrl = selected.front.url
    identityState.clothingSignature = extractClothingSignature(selected.front)
  }

  selected.identityState = identityState

  return selected
}

/**
 * 从候选的 caption 中提取服装描述
 * 用于 Identity Lock（Phase 6 预留）
 */
function extractClothingSignature(candidate: ViewCandidate): string {
  const caption = candidate.validation?.rawCaption || ''
  // 简单摘取服装关键词（精确提取留给 Phase 6）
  const clothingMatch = caption.match(/wearing\s+(.+?)(?:\.|,|$)/i)
  return clothingMatch?.[1]?.trim() || ''
}

/**
 * 计算全局一致性评分
 * 使用 constraint-scoring.ts 的 globalConsistencyScore
 */
async function computeGlobalScore(
  pool: ViewCandidatePool,
  selected: SelectedViews,
  userId: string,
): Promise<{ score: number; details: string[] }> {
  const { globalConsistencyScore } = await import('./constraint-scoring.js')
  return globalConsistencyScore(pool, selected)
}

/**
 * 从候选池中提取所有图片 URL（用于前端展示调试）
 */
export function extractAllUrls(pool: ViewCandidatePool): string[] {
  const urls: string[] = []
  for (const vt of ['portrait', 'front', 'side', 'back'] as ViewType[]) {
    for (const c of pool[vt] || []) {
      if (c.url) urls.push(c.url)
    }
  }
  return urls
}
