/**
 * Visual Constraint Loop — Phase 3: Constraint Scoring Engine
 *
 * 对单张图片的校验结果进行结构化评分。
 * 不做语义判断，只做规则匹配计分。
 *
 * 分值设计（总分 100）：
 *   - personCount === expected: 40（单人最核心）
 *   - personCount !== 1: -100（多人直接废）
 *   - bodyVisibility 匹配: 30
 *   - faceVisibility 匹配: 20
 *   - cameraAngle 匹配: 10
 *   - 任何关键字段为 'unknown': -10
 *   - hasExtraPerson: -50（即使 personCount=1 也扣）
 *
 * 全局一致性评分（0-100）：
 *   - 服装描述一致性（四个视图的 caption 中服装部分比对）
 *   - 所有视图均有有效候选: +30
 *   - 视图视角不重复: +20（没有两张 front 等情况）
 */

import type {
  ViewType,
  ViewValidationResult,
  ViewRule,
  ViewConstraint,
  ViewCandidate,
  ViewCandidatePool,
  SelectedViews,
  IdentityState,
  ValidationResult,
} from './types.js'

/** P5.2: degraded 检测 — 判断 validation 是否已降级 */
function isDegraded(v: ViewValidationResult | null, validationStatus?: ValidationResult): boolean {
  return validationStatus?.degraded === true
}

/** P5.2: 中性分 — validator 降级时不影响 selection */
const NEUTRAL_SCORE = 0.5
const DEGRADED_PASS = false

// ─── 单视图评分 ───

function checkPersonCount(expected: number, actual: number): number {
  if (actual !== expected) return actual > 1 ? -100 : -50
  return 40
}

function checkBodyVisibility(
  expected: ViewValidationResult['bodyVisibility'],
  actual: ViewValidationResult['bodyVisibility'],
): number {
  if (actual === expected) return 30
  if (actual === 'unknown') return -10
  // 部分匹配：expected=full_body, actual=partial 给 10 分
  if (expected === 'full_body' && actual === 'partial') return 10
  if (expected === 'head_shoulders' && actual === 'partial') return 10
  return 0
}

function checkFaceVisibility(
  expected: ViewValidationResult['faceVisibility'],
  actual: ViewValidationResult['faceVisibility'],
): number {
  if (actual === expected) return 20
  if (actual === 'unknown') return -10
  if (expected === 'hidden' && actual === 'partial') return 10  // partial hidden 可以接受
  if (expected === 'visible' && actual === 'partial') return 5   // partial visible 勉强
  return 0
}

function checkCameraAngle(
  expected: ViewValidationResult['cameraAngle'],
  actual: ViewValidationResult['cameraAngle'],
): number {
  if (actual === expected) return 10
  if (actual === 'unknown') return -10
  // three_quarter 接近 front/profile 可部分接受
  if (expected === 'front' && actual === 'three_quarter') return 5
  if (expected === 'profile' && actual === 'three_quarter') return 5
  return 0
}

function applyExtraPenalty(hasExtraPerson: boolean): number {
  return hasExtraPerson ? -50 : 0
}

/**
 * 对单视图校验结果评分
 * P5.2: validationStatus.degraded → 返回中性分 0.5，不污染 selection
 */
export function scoreView(
  viewType: ViewType,
  validation: ViewValidationResult | null,
  constraint?: ViewConstraint,
  validationStatus?: ValidationResult,
): number {
  if (!validation) return 0

  // P5.2: degraded 中性分
  if (isDegraded(validation, validationStatus)) return NEUTRAL_SCORE

  const rules = constraint?.rules.filter(r => r.viewType === viewType) || []

  if (rules.length === 0) {
    // 无约束规则，使用默认评分（仅检查单人）
    return checkPersonCount(1, validation.personCount) +
           applyExtraPenalty(validation.hasExtraPerson)
  }

  let score = 0
  for (const rule of rules) {
    for (const check of rule.checks) {
      switch (check.kind) {
        case 'personCount':
          score += checkPersonCount(check.expected, validation.personCount)
          break
        case 'bodyVisibility':
          score += checkBodyVisibility(check.expected, validation.bodyVisibility)
          break
        case 'faceVisibility':
          score += checkFaceVisibility(check.expected, validation.faceVisibility)
          break
        case 'cameraAngle':
          score += checkCameraAngle(check.expected, validation.cameraAngle)
          break
      }
    }
  }

  score += applyExtraPenalty(validation.hasExtraPerson)

  return score
}

/**
 * 判断单视图是否通过约束（pass/fail 二值判断）
 * P5.2: validationStatus.degraded → 返回 false，不误判为通过
 */
export function viewPassed(
  viewType: ViewType,
  validation: ViewValidationResult | null,
  constraint?: ViewConstraint,
  validationStatus?: ValidationResult,
): boolean {
  if (!validation) return false
  // P5.2: degraded 时不判定为 pass
  if (isDegraded(validation, validationStatus)) return DEGRADED_PASS

  // 硬性失败条件
  if (validation.personCount !== 1) return false
  if (validation.hasExtraPerson) return false

  const rules = constraint?.rules.filter(r => r.viewType === viewType) || []
  if (rules.length === 0) return true  // 无约束默认通过

  for (const rule of rules) {
    for (const check of rule.checks) {
      switch (check.kind) {
        case 'personCount':
          if (validation.personCount !== check.expected) return false
          break
        case 'cameraAngle':
          // cameraAngle 允许 three_quarter 替代 front/profile
          if (check.expected === 'front' && validation.cameraAngle === 'three_quarter') continue
          if (check.expected === 'profile' && validation.cameraAngle === 'three_quarter') continue
          if (validation.cameraAngle !== check.expected) return false
          break
        // bodyVisibility 和 faceVisibility 不硬拦截（降低过杀率）
      }
    }
  }

  return true
}

/**
 * 从 candidate 池中选择最佳候选（最高分优先）
 * P5.2: 传递 validationStatus 给 viewPassed
 */
export function selectBestCandidate(
  candidates: ViewCandidate[],
  viewType: ViewType,
  constraint?: ViewConstraint,
): ViewCandidate | null {
  if (candidates.length === 0) return null

  // 先按 pass 排序
  const passing = candidates.filter(c => viewPassed(viewType, c.validation, constraint, c.validationStatus))
  if (passing.length > 0) {
    passing.sort((a, b) => b.score - a.score)
    return passing[0]
  }

  // 无 pass 候选，取最高分
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}

// ─── 全局一致性评分 ───

/**
 * 检查四个视图的视角是否不重复
 */
function checkViewAngleUniqueness(pool: ViewCandidatePool): number {
  const angles = new Set<string>()
  let uniqueCount = 0
  for (const vt of ['portrait', 'front', 'side', 'back'] as ViewType[]) {
    const best = pool[vt]?.[0]
    if (best?.validation?.cameraAngle && best.validation.cameraAngle !== 'unknown') {
      if (!angles.has(best.validation.cameraAngle)) {
        angles.add(best.validation.cameraAngle)
        uniqueCount++
      }
    }
  }
  // 4 个不同视角 = 满分 20，每少一个减 5
  return Math.max(0, uniqueCount * 5)
}

/**
 * 全局一致性评分
 * 检查四张图是否构成一组合理的多视角组
 */
export function globalConsistencyScore(
  pool: ViewCandidatePool,
  selected: SelectedViews,
): { score: number; details: string[] } {
  const details: string[] = []
  let score = 0

  // 1. 所有视图都有候选
  const allViewsPresent = Object.values(selected).filter(v => v !== null && typeof v === 'object' && 'url' in v).length >= 4
  if (allViewsPresent) {
    score += 30
    details.push('all_views_present: +30')
  } else {
    const missing = (['portrait', 'front', 'side', 'back'] as ViewType[])
      .filter(vt => !selected[vt])
    details.push(`missing_views: ${missing.join(',')} -30`)
  }

  // 2. 视角不重复
  const angleScore = checkViewAngleUniqueness(pool)
  score += angleScore
  details.push(`angle_uniqueness: +${angleScore}`)

  // 3. 没人有多人
  let multiPenalty = 0
  for (const vt of ['portrait', 'front', 'side', 'back'] as ViewType[]) {
    const c = selected[vt]
    if (c?.validation?.hasExtraPerson || (c?.validation?.personCount ?? 1) > 1) {
      multiPenalty -= 50
      details.push(`${vt}_multi_person: -50`)
    }
  }
  score += multiPenalty

  return { score, details }
}

/**
 * 检查全局是否可接受
 */
export function isGloballyAcceptable(
  pool: ViewCandidatePool,
  selected: SelectedViews,
  minScore: number = 60,
): boolean {
  const { score } = globalConsistencyScore(pool, selected)
  return score >= minScore
}
