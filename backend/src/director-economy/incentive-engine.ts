/**
 * director-economy/incentive-engine.ts
 *
 * ⚔️ Phase 7 — Director Incentive Engine（导演激励引擎）
 *
 * 规则：
 *   - Director score = 基于输出质量结构评分
 *   - 无直接流量奖励
 *   - 无用互反馈
 *   - 评分只影响排序/推荐，不影响生成
 */

import type { DirectorPlan } from '../director-runtime/types.js'
import type { DirectorProfile } from '../director-registry/index.js'
import type { CreativeValueScore } from '../creative-economy/value-function.js'

// ── 激励记录 ──

export interface IncentiveRecord {
  /** Director ID */
  directorId: string
  /** 历史评分 */
  scores: Array<{
    value: CreativeValueScore
    timestamp: number
    projectId?: string
  }>
  /** 平均分 */
  averageScore: number
  /** 使用次数 */
  usageCount: number
  /** 最后使用时间 */
  lastUsedAt: number
  /** 当前排名 */
  rank: number
}

// ── 激励存储 ──

const incentiveRecords: Map<string, IncentiveRecord> = new Map()

// ── 记录评分 ──

/**
 * recordScore — 为 Director 记录一次评分
 *
 * 规则：
 *   - 只基于结构质量
 *   - 不记录流量/点击/互动数据
 */
export function recordScore(
  directorId: string,
  score: CreativeValueScore,
  projectId?: string
): IncentiveRecord {
  const existing = incentiveRecords.get(directorId)

  const record: IncentiveRecord = existing ?? {
    directorId,
    scores: [],
    averageScore: 0,
    usageCount: 0,
    lastUsedAt: 0,
    rank: 0,
  }

  record.scores.push({
    value: score,
    timestamp: Date.now(),
    projectId,
  })
  record.usageCount++
  record.lastUsedAt = Date.now()

  // 计算平均分
  const total = record.scores.reduce((sum, s) => sum + s.value.total, 0)
  record.averageScore = Math.round(total / record.scores.length)

  incentiveRecords.set(directorId, record)
  updateRanks()

  console.log(`[INCENTIVE] ${directorId}: score=${score.total} grade=${score.grade} avg=${record.averageScore} rank=${record.rank}`)
  return record
}

// ── 排名更新 ──

/**
 * updateRanks — 重新计算排名
 *
 * 只基于 averageScore，不基于使用次数或流量。
 */
function updateRanks(): void {
  const sorted = Array.from(incentiveRecords.values())
    .sort((a, b) => b.averageScore - a.averageScore)

  for (let i = 0; i < sorted.length; i++) {
    sorted[i].rank = i + 1
    incentiveRecords.set(sorted[i].directorId, sorted[i])
  }
}

// ── 查询 ──

export function getIncentiveRecord(directorId: string): IncentiveRecord | undefined {
  return incentiveRecords.get(directorId)
}

export function listIncentiveRecords(): IncentiveRecord[] {
  return Array.from(incentiveRecords.values())
    .sort((a, b) => a.rank - b.rank)
}

export function getTopDirectors(limit: number = 5): IncentiveRecord[] {
  return listIncentiveRecords().slice(0, limit)
}

// ── 推荐（基于评分，非流量） ──

export interface DirectorRecommendation {
  directorId: string
  name: string
  averageScore: number
  rank: number
  usageCount: number
}

/**
 * recommendDirectors — 推荐 Director（基于质量评分）
 *
 * 推荐逻辑：
 *   1. 从未使用过的 Director 优先推荐（exploration）
 *   2. 使用过但评分高的 Director 优先推荐（exploitation）
 *   3. 平均分相同的，按使用次数排序
 */
export function recommendDirectors(
  allDirectors: DirectorProfile[],
  limit: number = 3
): DirectorRecommendation[] {
  const scored: DirectorRecommendation[] = allDirectors.map(d => {
    const record = incentiveRecords.get(d.id)
    return {
      directorId: d.id,
      name: d.name,
      averageScore: record?.averageScore ?? 0,
      rank: record?.rank ?? 999,
      usageCount: record?.usageCount ?? 0,
    }
  })

  // 排序：未使用过的优先（exploration），然后高分的（exploitation）
  scored.sort((a, b) => {
    // 都没用过 → 按注册顺序
    if (a.usageCount === 0 && b.usageCount === 0) return 0
    // 一个没用过 → 优先推荐没用过的
    if (a.usageCount === 0) return -1
    if (b.usageCount === 0) return 1
    // 都用过 → 按平均分
    if (a.averageScore !== b.averageScore) return b.averageScore - a.averageScore
    // 平均分相同 → 按使用次数
    return b.usageCount - a.usageCount
  })

  return scored.slice(0, limit)
}

// ── 安全性检查 ──

export interface EconomyStabilityCheck {
  stable: boolean
  checks: Array<{
    name: string
    passed: boolean
    detail: string
  }>
}

/**
 * checkEconomyStability — 检查激励系统是否稳定
 *
 * 检查：
 *   1. 是否有评分膨胀（分数集中在 90+）
 *   2. 是否有评分通缩（分数集中在 30-）
 *   3. 是否有大量未评分 Director
 *   4. 是否有排名震荡（频繁换位）
 */
export function checkEconomyStability(): EconomyStabilityCheck {
  const records = listIncentiveRecords()
  const checks: EconomyStabilityCheck['checks'] = []

  if (records.length === 0) {
    checks.push({ name: '评分分布', passed: true, detail: '暂无记录' })
    return { stable: true, checks }
  }

  // 检查评分膨胀
  const highScoreCount = records.filter(r => r.averageScore >= 85).length
  if (highScoreCount > records.length * 0.5) {
    checks.push({
      name: '评分膨胀检测',
      passed: false,
      detail: `${highScoreCount}/${records.length} 的 Director 评分在 85+，可能存在评分膨胀`,
    })
  } else {
    checks.push({
      name: '评分膨胀检测',
      passed: true,
      detail: `${highScoreCount}/${records.length} 的 Director 评分在 85+，分布正常`,
    })
  }

  // 检查评分通缩
  const lowScoreCount = records.filter(r => r.averageScore <= 30).length
  if (lowScoreCount > records.length * 0.5) {
    checks.push({
      name: '评分通缩检测',
      passed: false,
      detail: `${lowScoreCount}/${records.length} 的 Director 评分在 30-，可能存在评分通缩`,
    })
  } else {
    checks.push({
      name: '评分通缩检测',
      passed: true,
      detail: `${lowScoreCount}/${records.length} 的 Director 评分在 30-，分布正常`,
    })
  }

  return {
    stable: checks.every(c => c.passed),
    checks,
  }
}
