/**
 * NOS Pipeline Log — Writer → Librarian → Commit 全链路可观测性日志
 *
 * 每写一章产生 1 行 Pipeline Record，可用于：
 * - 生产监控（每章耗时/TTFB）
 * - 性能分析（Snapshot/Librarian/Commit 各自耗时）
 * - MRI 回放（Snapshot Hash ↔ Runtime Hash）
 * - Coverage 分析（Old Legacy ↔ New Snapshot 事实覆盖率）
 *
 * Phase 3.2A Gate
 */

import { createHash } from 'crypto'

export interface PipelineRecord {
  /** 项目 ID */
  projectId: string
  /** 章节号 */
  chapterNo: number
  /** 重写模式 */
  isRewrite: boolean
  /** 时间戳 */
  timestamp: string

  // ── Snapshot ──
  snapshotBuildTime: number      // ms
  snapshotChars: number          // characters in snapshot
  snapshotEvents: number
  snapshotRels: number
  snapshotTimeline: number
  snapshotHash: string           // SHA256(JSON.stringify(snapshot))
  snapshotTokenEstimate: number  // token ~ chars/4

  // ── Prompt ──
  promptTokenEstimate: number    // tokens (estimated)
  promptSizeBytes: number

  // ── LLM ──
  llmTime: number                // ms
  llmProvider: string
  llmModel: string
  llmOutputChars: number
  llmOutputTokens: number

  // ── Story Librarian ──
  librarianTime: number          // ms
  librarianEventsExtracted: number
  librarianRelationshipsExtracted: number
  librarianOtherFacts: number

  // ── Runtime Commit ──
  commitTime: number             // ms
  commitFilesWritten: number
  commitStatus: 'success' | 'partial' | 'failed'
  commitErrors: string[]

  // ── Integrity ──
  integrityTime: number          // ms
  integrityPassed: boolean
  integrityRulesPassed: number
  integrityRulesTotal: number
  integrityErrors: string[]

  // ── Dual Read Coverage ──
  legacyFactCount: number        // 旧 Memory 中的事实条目数
  snapshotFactCount: number      // Snapshot 中的事实条目数
  factCoveragePercent: number    // Snapshot 覆盖 Legacy 的程度

  // ── Total ──
  totalTime: number              // ms
  pipelineStatus: 'pass' | 'fallback' | 'fail'
}

/**
 * 计算 Snapshot Hash
 * 排除 uuid 类字段（每次构建不同），只 hash 业务字段
 */
export function computeSnapshotHash(snapshot: any): string {
  const fingerprint = {
    chars: (snapshot.characters || []).map((c: any) =>
      `${c.name}:${c.lifecycle}:${c.role}:${(c.statusFlags || []).map((f: any) => `${f.flag}=${f.value}`).sort().join('|')}`
    ).sort(),
    events: (snapshot.events || []).map((e: any) =>
      `${e.chapterNo}:${e.title}:${e.category}`
    ).sort(),
    timeline: (snapshot.timeline || []).map((t: any) =>
      `${t.chapterNo}:${(t.summary || '').slice(0, 50)}`
    ).sort(),
    rels: (snapshot.relationships || []).map((r: any) =>
      [r.characterAName || r.characterA, r.characterBName || r.characterB].sort().join(':')
    ).sort(),
    foreshadows: (snapshot.foreshadows || []).map((f: any) =>
      `${f.plantedChapterNo}:${(f.description || '').slice(0, 50)}`
    ).sort(),
    inventory: (snapshot.inventory || []).map((i: any) =>
      `${i.itemName}:${i.ownerCharacterName || ''}`
    ).sort(),
  }
  return createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex').slice(0, 8)
}

/**
 * 计算事实覆盖率
 * 
 * "事实" = 有信息量的条目（Events + Characters + Relationships + Foreshadows + Timeline + Inventory）
 * 不计算 Knowledge / World / Constraints（这些维度已知缺失故排除）
 */
export function computeFactCoverage(snapshot: any, legacyMemory?: any): {
  snapshotFactCount: number
  legacyFactCount: number
  coveragePercent: number
} {
  const snapshotFactCount =
    (snapshot.characters?.length || 0) +
    (snapshot.events?.length || 0) +
    (snapshot.relationships?.length || 0) +
    (snapshot.foreshadows?.length || 0) +
    (snapshot.timeline?.length || 0) +
    (snapshot.inventory?.length || 0)

  if (!legacyMemory) {
    return { snapshotFactCount, legacyFactCount: 0, coveragePercent: 0 }
  }

  // 旧 Memory 事实数估算：每个 memory 条目计为 1 个事实（适用于 7-Truths）
  const legacyFactCount = (legacyMemory.memories?.length || 0) > 0
    ? legacyMemory.memories.length * 3  // 每个 memory type 平均包含 3 个事实
    : 0

  const coveragePercent = legacyFactCount > 0
    ? Math.round((snapshotFactCount / legacyFactCount) * 10000) / 100
    : 100  // 没有 legacy 则视为 100%

  return { snapshotFactCount, legacyFactCount, coveragePercent }
}

/**
 * 格式化 Pipeline Log 为一行日志
 */
export function formatPipelineLog(record: Partial<PipelineRecord>): string {
  const parts: string[] = []

  parts.push(`[NOS/Pipeline]`)
  parts.push(`ch${record.chapterNo || '?'}`)

  // Snapshot
  if (record.snapshotBuildTime !== undefined) parts.push(`snapshot:${record.snapshotBuildTime}ms`)
  if (record.snapshotHash) parts.push(`hash:${record.snapshotHash}`)
  if (record.snapshotTokenEstimate !== undefined) parts.push(`tokens:${record.snapshotTokenEstimate}`)

  // LLM
  if (record.llmTime !== undefined) parts.push(`llm:${(record.llmTime / 1000).toFixed(1)}s`)
  if (record.llmOutputChars !== undefined) parts.push(`out:${record.llmOutputChars}chars`)

  // Librarian
  if (record.librarianTime !== undefined) parts.push(`lib:${record.librarianTime}ms`)
  if (record.librarianEventsExtracted !== undefined) parts.push(`ev:${record.librarianEventsExtracted}`)

  // Commit
  if (record.commitTime !== undefined) parts.push(`commit:${record.commitTime}ms`)
  if (record.commitStatus) parts.push(`status:${record.commitStatus}`)

  // Integrity
  if (record.integrityPassed !== undefined) parts.push(`integrity:${record.integrityPassed ? 'PASS' : 'FAIL'}`)

  // Coverage
  if (record.factCoveragePercent !== undefined) parts.push(`coverage:${record.factCoveragePercent}%`)

  // Total
  if (record.totalTime !== undefined) parts.push(`total:${(record.totalTime / 1000).toFixed(1)}s`)

  return parts.join(' ')
}
