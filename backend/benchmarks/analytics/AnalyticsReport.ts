/**
 * Analytics Report — JSON / Markdown 导出
 */

import type { AnalyticsSnapshot, CapabilityAnalytics } from './AnalyticsTypes.js'

export function exportJSON(snapshot: AnalyticsSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}

export function exportMarkdown(snapshot: AnalyticsSnapshot): string {
  const lines: string[] = []

  lines.push('# Capability Analytics Report\n')
  lines.push(`Generated: ${snapshot.generated}`)
  lines.push(`Registry: ${snapshot.registryId} @ ${snapshot.registryVersion}\n`)

  // Summary
  const s = snapshot.summary
  lines.push('## Summary\n')
  lines.push(`| Metric | Value |`)
  lines.push(`|--------|-------|`)
  lines.push(`| Total Capabilities | ${s.total} |`)
  lines.push(`| ✅ Healthy | ${s.healthy} |`)
  lines.push(`| ⚠️  Weak | ${s.weak} |`)
  lines.push(`| ❌ Critical | ${s.critical} |`)
  lines.push(`| **Health Score** | **${s.healthScore}%** |`)
  lines.push(`| **Average Coverage** | **${s.averageCoverage}%** |`)

  // Health breakdown
  lines.push('\n## By Health\n')
  for (const h of ['critical', 'weak', 'healthy'] as const) {
    const entries = snapshot.analytics.filter(a => a.health === h)
    if (entries.length === 0) continue
    const icon = h === 'critical' ? '❌' : h === 'weak' ? '⚠️' : '✅'
    lines.push(`\n### ${icon} ${h.charAt(0).toUpperCase() + h.slice(1)} (${entries.length})\n`)
    lines.push(`| Capability | Coverage | Coverage Score |`)
    lines.push(`|------------|----------|---------------|`)
    for (const a of entries) {
      lines.push(`| ${a.capability} | ${a.primaryCoverage}p / ${a.secondaryCoverage}s | ${a.coverageScore}% |`)
    }
  }

  // Detail table
  lines.push('\n## Detail\n')
  lines.push(`| Capability | Group | Stage | Difficulty | Pri | Sec | Coverage | Health |`)
  lines.push(`|------------|-------|-------|------------|-----|-----|----------|--------|`)
  for (const a of snapshot.analytics) {
    const icon = a.health === 'critical' ? '❌' : a.health === 'weak' ? '⚠️' : '✅'
    lines.push(`| ${a.capability} | ${a.group} | ${a.stage} | ${a.difficulty} | ${a.primaryCoverage} | ${a.secondaryCoverage} | ${a.coverageScore}% | ${icon} ${a.health} |`)
  }

  lines.push('')
  return lines.join('\n')
}
