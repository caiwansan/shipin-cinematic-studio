// ============================================================
// convergence/conflict-collector.ts
//
// 职责：D4 Conflict Collector
//   收集来自多个 domain 的 D2 decision，检测冲突
//
// 冲突检测规则：
//   1. 跨 domain 决策不一致（accept vs retry）
//   2. 同一维度在不同 domain 的评分矛盾
//   3. ontology 映射传递的质量矛盾
// ============================================================

import type { QualityDomain } from '../pipeline/validators/core/baseline-registry.js'
import { resolveDimensionMapping } from '../pipeline/validators/core/baseline-registry.js'
import type { DomainProposal, ArbitrationVerdict, SoftLossEstimate } from './types.js'

// ─── 冲突类型 ──────────────────────────────────────────

export type ConflictType =
  | 'decision_conflict'    // 同一任务多 domain 决策不一致
  | 'quality_gap'          // 关联 domain 质量差距过大
  | 'ontology_mismatch'    // ontology 映射端对端质量断裂

export interface DomainConflict {
  type: ConflictType
  description: string
  severity: 'low' | 'mid' | 'high'
  involvedDomains: QualityDomain[]
  /** 相关评分 */
  scores: Record<string, number>
}

// ─── 冲突检测 ──────────────────────────────────────────

export interface ConflictReport {
  conflicts: DomainConflict[]
  /** 冲突最多的 domain */
  hottestDomain: QualityDomain | null
  /** 全局一致性评分（0-1，越高越好） */
  globalConsistencyScore: number
}

/**
 * 收集并分析多 domain 决策冲突
 */
export function collectConflicts(proposals: DomainProposal[]): ConflictReport {
  const conflicts: DomainConflict[] = []

  // ── 检测 1：决策不一致 ──
  const actions = proposals.map(p => ({ domain: p.domain, action: p.action.type }))
  const uniqueActions = [...new Set(actions.map(a => a.action))]
  if (uniqueActions.length > 1) {
    const decisionDesc = actions.map(a => `${a.domain}=${a.action}`).join(', ')
    conflicts.push({
      type: 'decision_conflict',
      description: `跨 domain 决策不一致：${decisionDesc}`,
      severity: 'mid',
      involvedDomains: proposals.map(p => p.domain),
      scores: Object.fromEntries(proposals.map(p => [p.domain, p.calibratedScore])),
    })
  }

  // ── 检测 2：质量差距过大 ──
  if (proposals.length >= 2) {
    const sorted = [...proposals].sort((a, b) => a.calibratedScore - b.calibratedScore)
    const minScore = sorted[0].calibratedScore
    const maxScore = sorted[sorted.length - 1].calibratedScore
    const gap = maxScore - minScore
    if (gap > 0.4) {
      conflicts.push({
        type: 'quality_gap',
        description: `${sorted[0].domain}(${sorted[0].calibratedScore}) vs ${sorted[sorted.length - 1].domain}(${sorted[sorted.length - 1].calibratedScore}) 差距 ${(gap * 100).toFixed(0)}%`,
        severity: gap > 0.6 ? 'high' : 'mid',
        involvedDomains: [sorted[0].domain, sorted[sorted.length - 1].domain],
        scores: Object.fromEntries(proposals.map(p => [p.domain, p.calibratedScore])),
      })
    }
  }

  // ── 检测 3：Ontology 映射断裂 ──
  // 检查跨 domain 关联维度的一致性
  for (const prop of proposals) {
    const dims = resolveDimensionMapping(prop.domain, 'identityStability')
    for (const mapping of dims) {
      const related = proposals.find(p => p.domain === mapping.targetDomain)
      if (related && Math.abs(prop.calibratedScore - related.calibratedScore) > 0.35) {
        conflicts.push({
          type: 'ontology_mismatch',
          description: `${prop.domain}(${prop.calibratedScore}) 与 ${related.domain}(${related.calibratedScore}) ontology 映射断裂（dimension: identityStability → ${mapping.targetDimension}, weight: ${mapping.semanticWeight}）`,
          severity: 'mid',
          involvedDomains: [prop.domain, related.domain],
          scores: { [prop.domain]: prop.calibratedScore, [related.domain]: related.calibratedScore },
        })
      }
    }
  }

  // ── 综合指标 ──
  const conflictCounts: Record<string, number> = {}
  for (const c of conflicts) {
    for (const dom of c.involvedDomains) {
      conflictCounts[dom] = (conflictCounts[dom] ?? 0) + 1
    }
  }
  let hottestDomain: QualityDomain | null = null
  let maxCount = 0
  for (const [dom, count] of Object.entries(conflictCounts)) {
    if (count > maxCount) {
      maxCount = count
      hottestDomain = dom as QualityDomain
    }
  }

  // 全局一致性评分
  const scores = proposals.map(p => p.calibratedScore)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
  const globalConsistencyScore = Math.max(0, Math.min(1, 1 - Math.sqrt(variance)))

  return { conflicts, hottestDomain, globalConsistencyScore }
}
