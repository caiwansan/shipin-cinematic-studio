/**
 * Causal Diff Viewer
 * Phase 6 — Execution Memory Layer
 *
 * 将 causal-diff-engine 的结果包装为人类可读的报告。
 * 支持节点级别差异的视觉化描述。
 */

import { DiffResult } from '../causal-engine/causal-diff-engine'

export interface DiffViewerReport {
  summary: string
  changed: string[]
  added: string[]
  removed: string[]
  status: 'UNCHANGED' | 'MODIFIED' | 'EVOLVED'
}

export class CausalDiffViewer {
  /**
   * 可视化差异报告
   */
  view(diff: DiffResult): DiffViewerReport {
    const total = diff.changed.length + diff.added.length + diff.removed.length
    let status: DiffViewerReport['status'] = 'UNCHANGED'
    let summary: string

    if (total === 0) {
      summary = '🟢 blueprint 无变化'
    } else if (diff.removed.length > 0) {
      status = 'EVOLVED'
      summary = `🟡 blueprint 有结构变化：${diff.added.length} 新增, ${diff.removed.length} 删除, ${diff.changed.length} 修改`
    } else {
      status = 'MODIFIED'
      summary = `🟠 blueprint 有内容变化：${diff.changed.length} 节点被修改`
    }

    return { summary, status, ...diff }
  }

  /**
   * 生成节点级别的详细差异行
   */
  viewLines(diff: DiffResult): string[] {
    const lines: string[] = []

    for (const id of diff.changed) {
      lines.push(`  📝 ${id} — 内容已修改`)
    }
    for (const id of diff.added) {
      lines.push(`  ✚ ${id} — 新增节点`)
    }
    for (const id of diff.removed) {
      lines.push(`  ✖ ${id} — 已移除`)
    }

    return lines
  }
}
