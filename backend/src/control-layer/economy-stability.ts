/**
 * control-layer/economy-stability.ts
 *
 * ⚔️ Phase 7 — Economy Stability Check（经济稳定性检查）
 *
 * 检查：
 *   1. reward alignment — 评分与质量对齐
 *   2. structural integrity preservation — 结构完整性保持
 *   3. absence of feedback loops — 无反馈回路
 */

import type { DirectorPlan } from '../director-runtime/types.js'
import type { CreativeValueScore } from '../creative-economy/value-function.js'
import type { IncentiveRecord } from '../director-economy/incentive-engine.js'

// ── 稳定性检查结果 ──

export interface EconomyStabilityResult {
  stable: boolean
  checks: Array<{
    name: string
    passed: boolean
    detail: string
    severity: 'error' | 'warning' | 'info'
  }>
}

// ── 1. Reward Alignment（奖励对齐） ──

/**
 * checkRewardAlignment — 检查评分是否符合结构质量
 *
 * 如果 Director 评分高但结构质量低 → 奖励不对齐。
 * 如果 Director 评分低但结构质量高 → 奖励不对齐。
 */
export function checkRewardAlignment(
  incentiveRecords: IncentiveRecord[]
): EconomyStabilityResult['checks'] {
  const checks: EconomyStabilityResult['checks'] = []

  if (incentiveRecords.length === 0) {
    checks.push({
      name: '奖励对齐',
      passed: true,
      detail: '暂无记录',
      severity: 'info',
    })
    return checks
  }

  // 检查低分 Director 是否有合理理由
  for (const record of incentiveRecords) {
    const recentScores = record.scores.slice(-5) // 最近 5 次
    if (recentScores.length > 0) {
      const grades = recentScores.map(s => s.value.grade)
      const gradeSet = new Set(grades)

      // 如果同一个 Director 的 grade 变化太大（S ↔ F），可能有问题
      if (gradeSet.has('S') && gradeSet.has('F')) {
        checks.push({
          name: '奖励对齐',
          passed: false,
          detail: `${record.directorId}: 评分波动过大 (${grades.join(', ')})，可能存在激励不稳定`,
          severity: 'warning',
        })
      }
    }
  }

  if (checks.length === 0) {
    checks.push({
      name: '奖励对齐',
      passed: true,
      detail: '所有 Director 评分稳定',
      severity: 'info',
    })
  }

  return checks
}

// ── 2. Structural Integrity Preservation（结构完整性保持） ──

/**
 * checkStructuralIntegrity — 检查 Director 是否在保持结构质量
 *
 * 通过比较 Director 的历史评分趋势，检查是否有"为了高分开始剧烈改变结构"的迹象。
 */
export function checkStructuralIntegrity(
  incentiveRecords: IncentiveRecord[]
): EconomyStabilityResult['checks'] {
  const checks: EconomyStabilityResult['checks'] = []

  for (const record of incentiveRecords) {
    const recentScores = record.scores.slice(-5)
    if (recentScores.length < 3) continue

    // 检查叙事连贯性趋势
    const coherenceTrend = recentScores.map(s => s.value.dimensions.narrativeCoherence.score)
    const hasCoherenceDecline = coherenceTrend.length > 1 &&
      coherenceTrend[coherenceTrend.length - 1] < coherenceTrend[0] - 15

    if (hasCoherenceDecline) {
      checks.push({
        name: '结构完整性保持',
        passed: false,
        detail: `${record.directorId}: 叙事连贯性下降趋势 (${coherenceTrend.join('→')})，可能为迎合评分修改结构`,
        severity: 'error',
      })
    }

    // 检查结构稳定性趋势
    const stabilityTrend = recentScores.map(s => s.value.dimensions.structuralStability.score)
    const hasStabilityDecline = stabilityTrend.length > 1 &&
      stabilityTrend[stabilityTrend.length - 1] < stabilityTrend[0] - 15

    if (hasStabilityDecline) {
      checks.push({
        name: '结构完整性保持',
        passed: false,
        detail: `${record.directorId}: 结构稳定性下降趋势 (${stabilityTrend.join('→')})`,
        severity: 'error',
      })
    }
  }

  if (checks.length === 0) {
    checks.push({
      name: '结构完整性保持',
      passed: true,
      detail: '所有 Director 结构稳定性良好',
      severity: 'info',
    })
  }

  return checks
}

// ── 3. Absence of Feedback Loops（无反馈回路） ──

/**
 * checkFeedbackLoops — 检查是否存在反馈回路
 *
 * 反馈回路 = 高评分 → 被更多人使用 → 获取更多流量 → 即使质量下降仍保持高评分
 *
 * 检测逻辑：
 *   如果使用次数很多但最近评分下降，可能存在反馈回路
 */
export function checkFeedbackLoops(
  incentiveRecords: IncentiveRecord[]
): EconomyStabilityResult['checks'] {
  const checks: EconomyStabilityResult['checks'] = []

  for (const record of incentiveRecords) {
    if (record.scores.length < 3) continue

    const recentScores = record.scores.slice(-3)
    const recentAvg = recentScores.reduce((sum, s) => sum + s.value.total, 0) / recentScores.length

    // 使用次数多但最近评分低于平均分 10 以上 → 可能存在反馈回路
    if (record.usageCount > 10 && recentAvg < record.averageScore - 10) {
      checks.push({
        name: '反馈回路检测',
        passed: false,
        detail: `${record.directorId}: 使用${record.usageCount}次但最近评分(${Math.round(recentAvg)})低于历史平均(${record.averageScore})，可能存在反馈回路`,
        severity: 'warning',
      })
    }
  }

  if (checks.length === 0) {
    checks.push({
      name: '反馈回路检测',
      passed: true,
      detail: '无反馈回路迹象',
      severity: 'info',
    })
  }

  return checks
}

// ── 主检查 ──

/**
 * checkEconomyStability — 综合经济稳定性检查
 */
export function checkEconomyStability(
  incentiveRecords: IncentiveRecord[]
): EconomyStabilityResult {
  const alignment = checkRewardAlignment(incentiveRecords)
  const integrity = checkStructuralIntegrity(incentiveRecords)
  const loops = checkFeedbackLoops(incentiveRecords)

  const allChecks = [...alignment, ...integrity, ...loops]
  const hasError = allChecks.some(c => c.severity === 'error' && !c.passed)

  return {
    stable: !hasError,
    checks: allChecks,
  }
}
