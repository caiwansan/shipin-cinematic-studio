/**
 * Tension Curve Validator
 * 张力曲线校验器 — 检查曲线是否满足叙事连续性要求
 *
 * 验证规则：
 *   1. 连续性 — 没有超过阈值的突然跳变
 *   2. 单调性 — build/release 阶段的定义域内应单调
 *   3. 峰值定位 — 峰值在正确的区域内
 *   4. 平坦检测 — rise_fall 不允许平段
 *   5. 软修正 — 当 drift 被检测到时，给出修正建议
 */

import {
  NarrativeConstraint,
  TensionCurve,
  ConstraintViolation,
  ValidationResult,
} from './narrative-constraint-types.js'
import { detectPeaks } from './story-arc-governor.js'

export interface TensionValidationResult {
  valid: boolean
  violations: ConstraintViolation[]
  normalizedCurve: TensionCurve
  monotonicRegions: MonotonicRegion[]
  peakPositions: number[]
  driftAmount: number
  driftDirection: 'up' | 'down' | 'none'
  suggestedCorrection?: TensionCurve
}

export interface MonotonicRegion {
  start: number
  end: number
  direction: 'up' | 'down' | 'flat'
  length: number
}

/**
 * 主线验证函数
 */
export function validateTensionCurve(
  curve: TensionCurve,
  constraint: NarrativeConstraint,
): TensionValidationResult {
  const violations: ConstraintViolation[] = []

  // 1. 连续性检查
  const continuityViolations = checkContinuity(curve, constraint)
  violations.push(...continuityViolations)

  // 2. 单调区域检测
  const monotonicRegions = detectMonotonicRegions(curve)

  // 3. 峰值定位
  const peakPositions = detectPeaks(curve)

  // 4. 平坦检测（仅 rise_fall）
  if (constraint.arcType === 'rise_fall') {
    const flatViolations = checkFlatSegments(curve, monotonicRegions)
    violations.push(...flatViolations)
  }

  // 5. Drift 检测
  const drift = detectDrift(curve, constraint)
  violations.push(...drift.violations)

  // 6. 归一化
  const normalizedCurve = normalizeCurve(curve)

  // 7. 修正建议
  const suggestedCorrection = drift.driftAmount > 0.3
    ? generateCorrection(curve, constraint)
    : undefined

  return {
    valid: violations.length === 0,
    violations,
    normalizedCurve,
    monotonicRegions,
    peakPositions,
    driftAmount: drift.driftAmount,
    driftDirection: drift.direction,
    suggestedCorrection,
  }
}

/**
 * 连续性检查 — 相邻点之间不能超过 maxTensionDelta
 */
function checkContinuity(
  curve: TensionCurve,
  constraint: NarrativeConstraint,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []

  for (let i = 1; i < curve.length; i++) {
    const delta = Math.abs(curve[i] - curve[i - 1])
    if (delta > constraint.maxTensionDelta) {
      violations.push({
        ruleId: 'tension-continuity-001',
        reason: 'tension_break',
        nodeId: undefined,
        shotIndex: i,
        message: `张力跳变 ${delta.toFixed(2)} 超过阈值 ${constraint.maxTensionDelta}（第 ${i - 1}→${i} 镜）`,
        severity: constraint.strictMode ? 'error' : 'warning',
        suggestion: `建议在第 ${i - 1} 和第 ${i} 镜之间插入过渡镜头`,
      })
    }
  }

  return violations
}

/**
 * 单调区域检测
 */
function detectMonotonicRegions(curve: TensionCurve): MonotonicRegion[] {
  if (curve.length < 2) return []

  const regions: MonotonicRegion[] = []
  let start = 0
  let direction: 'up' | 'down' | 'flat' = getDirection(curve[0], curve[1])

  for (let i = 1; i < curve.length - 1; i++) {
    const currentDir = getDirection(curve[i], curve[i + 1])
    if (currentDir !== direction) {
      regions.push({
        start,
        end: i,
        direction,
        length: i - start,
      })
      start = i
      direction = currentDir
    }
  }

  regions.push({
    start,
    end: curve.length - 1,
    direction,
    length: curve.length - 1 - start,
  })

  return regions
}

function getDirection(a: number, b: number): 'up' | 'down' | 'flat' {
  const diff = b - a
  if (Math.abs(diff) < 0.02) return 'flat'
  return diff > 0 ? 'up' : 'down'
}

/**
 * 平坦段检查 — rise_fall arc 不允许
 */
function checkFlatSegments(
  curve: TensionCurve,
  regions: MonotonicRegion[],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  for (const region of regions) {
    if (region.direction === 'flat' && region.length > 1) {
      violations.push({
        ruleId: 'tension-flat-001',
        reason: 'tension_break',
        message: `rise_fall arc 含有 ${region.length} 镜平坦段（第 ${region.start}→${region.end} 镜）`,
        severity: 'warning',
        suggestion: '建议为平坦段增加张力微变',
      })
    }
  }
  return violations
}

/**
 * Drift 检测 — 张力曲线是否偏离了约束的理想形态
 */
function detectDrift(
  curve: TensionCurve,
  constraint: NarrativeConstraint,
): { driftAmount: number; direction: 'up' | 'down' | 'none'; violations: ConstraintViolation[] } {
  const violations: ConstraintViolation[] = []
  const ideal = constraint.tensionCurve

  if (curve.length === 0 || ideal.length === 0) {
    return { driftAmount: 0, direction: 'none', violations }
  }

  // 对齐长度
  const len = Math.min(curve.length, ideal.length)
  let totalDrift = 0

  for (let i = 0; i < len; i++) {
    totalDrift += Math.abs(curve[i] - ideal[i])
  }

  const avgDrift = totalDrift / len
  const meanCurve = curve.reduce((a, b) => a + b, 0) / curve.length
  const meanIdeal = ideal.reduce((a, b) => a + b, 0) / ideal.length

  const direction = meanCurve > meanIdeal + 0.1 ? 'up' : meanCurve < meanIdeal - 0.1 ? 'down' : 'none'

  if (avgDrift > 0.3) {
    violations.push({
      ruleId: 'tension-drift-001',
      reason: 'tension_break',
      message: `张力曲线 drift ${avgDrift.toFixed(2)}，偏离理想形态${direction !== 'none' ? `（偏${direction === 'up' ? '高' : '低'}）` : ''}`,
      severity: 'warning',
      suggestion: avgDrift > 0.5
        ? '建议使用标准化修正（generateCorrection）'
        : '建议微调峰值位置',
    })
  }

  return { driftAmount: avgDrift, direction, violations }
}

/**
 * 曲线归一化 — 映射到 0-1 范围
 */
function normalizeCurve(curve: TensionCurve): TensionCurve {
  if (curve.length === 0) return []
  const min = Math.min(...curve)
  const max = Math.max(...curve)
  if (max === min) return curve.map(() => 0.5)
  return curve.map(v => (v - min) / (max - min))
}

/**
 * 生成修正曲线建议
 */
function generateCorrection(
  current: TensionCurve,
  constraint: NarrativeConstraint,
): TensionCurve {
  const ideal = constraint.tensionCurve
  if (ideal.length === 0) return current

  // 混合：70% 理想曲线 + 30% 当前曲线
  return current.map((v, i) => {
    const target = i < ideal.length ? ideal[i] : 0.5
    return target * 0.7 + v * 0.3
  })
}
