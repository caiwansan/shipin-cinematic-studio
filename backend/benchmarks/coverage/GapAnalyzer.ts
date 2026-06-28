/**
 * GapAnalyzer — 三级缺口分析 + 建议 Dataset
 *
 * P0（Critical）: primary=0, secondary=0 → 必须补
 * P1（Weak）:    primary=0, secondary>0 → 需要专门测试
 * P2（Sparse）:  primary<=1, secondary<=1 → 以后补
 */

import type { CoverageEntry, GapLevel } from './CoverageIndex.js'
import { calculateGapLevel } from './CoverageIndex.js'
import { CapabilityRegistry } from '../capabilities/registry.js'

export interface GapSuggestion {
  capability: string
  level: GapLevel
  suggestedId: string
  primaryCapability: string
  secondaryCapabilities: string[]
  reason: string
  priority: number
}

export interface GapReport {
  critical: GapSuggestion[]
  weak: GapSuggestion[]
  sparse: GapSuggestion[]
  totalGaps: number
  suggestions: GapSuggestion[]
}

/**
 * 分析缺口并生成建议 Dataset ID
 */
export function analyzeGaps(entries: CoverageEntry[]): GapReport {
  const critical: GapSuggestion[] = []
  const weak: GapSuggestion[] = []
  const sparse: GapSuggestion[] = []

  for (const entry of entries) {
    if (!entry.gap) continue
    const level = calculateGapLevel(entry)
    if (!level) continue

    // 获取能力定义和组信息
    const def = CapabilityRegistry.byId(entry.capability)
    const groupId = def?.group ?? 'UNKNOWN'
    const suggestedId = `${entry.difficulty}-${groupId}`

    // 获取同组的其它能力作为建议的 secondary
    const groupCapabilities = CapabilityRegistry.query({ group: groupId })
      .map(c => c.id)
      .filter(id => id !== entry.capability)

    const suggestion: GapSuggestion = {
      capability: entry.capability,
      level,
      suggestedId,
      primaryCapability: entry.capability,
      secondaryCapabilities: groupCapabilities.slice(0, 3),
      reason: level === 'P0'
        ? `Capability "${entry.capability}" (${def?.name ?? ''}) has zero coverage: primary=0, secondary=0. Requires dedicated dataset.`
        : level === 'P1'
        ? `Capability "${entry.capability}" (${def?.name ?? ''}) only has secondary coverage (primary=0). Needs dedicated test.`
        : `Capability "${entry.capability}" has sparse coverage (primary=${entry.primaryDatasets.length}, secondary=${entry.secondaryDatasets.length}).`,
      priority: level === 'P0' ? 1 : level === 'P1' ? 2 : 3,
    }

    if (level === 'P0') critical.push(suggestion)
    else if (level === 'P1') weak.push(suggestion)
    else if (level === 'P2') sparse.push(suggestion)
  }

  const sortByPriority = (a: GapSuggestion, b: GapSuggestion) => a.priority - b.priority
  critical.sort(sortByPriority)
  weak.sort(sortByPriority)
  sparse.sort(sortByPriority)

  return {
    critical,
    weak,
    sparse,
    totalGaps: critical.length + weak.length + sparse.length,
    suggestions: [...critical, ...weak, ...sparse],
  }
}

/**
 * 生成人类可读的 Gap 摘要
 */
export function printGapReport(report: GapReport): string {
  const lines: string[] = []

  lines.push(`Gap Report`)
  lines.push(``)
  lines.push(`Total gaps: ${report.totalGaps}`)

  if (report.critical.length > 0) {
    lines.push(`\n🔴 P0 — Critical (${report.critical.length})`)
    lines.push(`Primary=0, Secondary=0 — must add datasets`)
    for (const g of report.critical) {
      lines.push(`\n- **${g.capability}**: ${g.reason}`)
      lines.push(`  → Suggested: \`${g.suggestedId}\` with secondary: ${g.secondaryCapabilities.join(', ') || '(none)'}`)
    }
  }

  if (report.weak.length > 0) {
    lines.push(`\n🟡 P1 — Weak (${report.weak.length})`)
    lines.push(`Primary=0, Secondary>0 — needs dedicated test`)
    for (const g of report.weak) {
      lines.push(`\n- **${g.capability}**: ${g.reason}`)
      lines.push(`  → Suggested: \`${g.suggestedId}\``)
    }
  }

  if (report.sparse.length > 0) {
    lines.push(`\n🟢 P2 — Sparse (${report.sparse.length})`)
    lines.push(`Coverage too low — fill later`)
    for (const g of report.sparse) {
      lines.push(`\n- **${g.capability}**: ${g.reason}`)
    }
  }

  return lines.join('\n')
}
