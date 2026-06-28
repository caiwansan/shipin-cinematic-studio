/**
 * Capability Backlog — 根据 Coverage Index 自动生成唯一待办
 *
 * P1.4.1: Backlog 是 Dataset 资产生产的唯一驱动源。
 * 任何新增能力自动进入 Backlog，不允许跳过 Backlog 直接写 Dataset。
 */

import { scanAllDatasets } from '../coverage/CoverageScanner.js'
import { CapabilityRegistry } from '../capabilities/registry.js'
import { analyzeGaps } from '../coverage/GapAnalyzer.js'
import type { BacklogEntry } from './AssetTypes.js'

const BACKLOG_PATH = 'benchmarks/assets/BACKLOG.yaml'

/**
 * 根据 Coverage Index 的 Gap 生成 Backlog
 */
export function generateBacklog(): BacklogEntry[] {
  const entries = scanAllDatasets()
  const gapReport = analyzeGaps(entries)
  const backlog: BacklogEntry[] = []

  for (const g of gapReport.suggestions) {
    const def = CapabilityRegistry.byId(g.capability)
    backlog.push({
      capability: g.capability,
      priority: g.level as 'P0' | 'P1' | 'P2',
      group: def?.group ?? 'UNKNOWN',
      stage: def?.stage ?? 'unknown',
      difficulty: def?.difficulty ?? 'L0',
      suggestedId: g.suggestedId,
      reason: g.reason,
      status: 'todo',
      createdAt: new Date().toISOString(),
    })
  }

  // P0 排在前面，组内排序
  const priorityOrder = { P0: 0, P1: 1, P2: 2 }
  backlog.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
    if (pDiff !== 0) return pDiff
    return a.group.localeCompare(b.group)
  })

  return backlog
}

/**
 * 格式化 Backlog 为 Markdown
 */
export function formatBacklog(backlog: BacklogEntry[]): string {
  const lines: string[] = []
  lines.push('# Capability Backlog\n')
  lines.push(`Generated: ${new Date().toISOString()}\n`)
  lines.push(`Total entries: ${backlog.length}\n`)

  for (const priority of ['P0', 'P1', 'P2'] as const) {
    const items = backlog.filter(b => b.priority === priority)
    if (items.length === 0) continue
    const icon = priority === 'P0' ? '🔴' : priority === 'P1' ? '🟡' : '🟢'
    lines.push(`## ${icon} ${priority} (${items.length})\n`)

    lines.push(`| Priority | Capability | Group | Stage | Difficulty | Suggested ID | Status |`)
    lines.push(`|----------|------------|-------|-------|------------|--------------|--------|`)
    for (const b of items) {
      lines.push(`| ${b.priority} | ${b.capability} | ${b.group} | ${b.stage} | ${b.difficulty} | ${b.suggestedId} | ${b.status} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 格式化 Backlog 为 CSV
 */
export function formatBacklogCSV(backlog: BacklogEntry[]): string {
  const lines: string[] = ['Priority,Capability,Group,Stage,Difficulty,SuggestedId,Status,CreatedAt']
  for (const b of backlog) {
    lines.push(`${b.priority},${b.capability},${b.group},${b.stage},${b.difficulty},${b.suggestedId},${b.status},${b.createdAt}`)
  }
  return lines.join('\n')
}
