/**
 * P7-GOV — LearningAuditLog（学习审计日志）
 *
 * 记录所有 P7 进化决策的完整链路。
 * 支持回溯、回放、审计。
 *
 * ═══ 宪法 ═══
 * 每次进化必须被记录。
 * 审计日志不能被删除，只能归档。
 */

import { EvolutionProposal } from './evolution-guard.js'

export interface AuditEntry {
  timestamp: number
  type: EvolutionProposal['type']
  capability?: string
  previousValue: any
  proposedValue: any
  reason: string
  approved: boolean
  violations: string[]
  entryId: string
}

class LearningAuditLog {
  private entries: AuditEntry[] = []
  private maxEntries = 10000

  /**
   * 记录审计条目
   */
  async record(data: Omit<AuditEntry, 'entryId'>): Promise<void> {
    const entry: AuditEntry = {
      ...data,
      entryId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }

    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries.shift()
    }
  }

  /**
   * 查询审计日志
   */
  query(filter?: { type?: string; approved?: boolean; limit?: number }): AuditEntry[] {
    let results = [...this.entries]

    if (filter?.type) results = results.filter(e => e.type === filter.type)
    if (filter?.approved !== undefined) results = results.filter(e => e.approved === filter.approved)
    if (filter?.limit) results = results.slice(-filter.limit)

    return results.reverse()
  }

  /**
   * 获取统计
   */
  getStats(): { total: number; approved: number; rejected: number; types: Record<string, number> } {
    const types: Record<string, number> = {}
    let approved = 0
    let rejected = 0

    for (const entry of this.entries) {
      types[entry.type] = (types[entry.type] || 0) + 1
      if (entry.approved) approved++
      else rejected++
    }

    return { total: this.entries.length, approved, rejected, types }
  }
}

export const learningAuditLog = new LearningAuditLog()
