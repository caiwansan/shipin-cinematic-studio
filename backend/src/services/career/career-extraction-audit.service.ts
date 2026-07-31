// ─── Sprint-09E-02 Task 02.1 Extraction Audit Log ─────
// 零 Schema 审计：JSON 文件日志，可 tail/search/导入运营后台

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.resolve(__dirname, '../../../../logs/extraction')

interface AuditEntry {
  timestamp: string
  userId: string
  sessionId?: string
  rawMessage: string
  fields: Array<{
    field: string
    value: unknown
    source: string
    confidence: number
    action: string
    evidence: string
  }>
  confirmedFacts: string[]
  derivedSuggestions: string[]
  ignored: string[]
  traceSource?: string
}

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

export function writeExtractionAudit(entry: Omit<AuditEntry, 'timestamp'>): void {
  try {
    ensureLogDir()
    const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const logFile = path.join(LOG_DIR, `extraction-${date}.jsonl`)
    const full: AuditEntry = { ...entry, timestamp: new Date().toISOString() }
    fs.appendFileSync(logFile, JSON.stringify(full) + '\n', 'utf-8')

    // 保持日志可读 — 控制台只打印摘要
    const confirmed = entry.confirmedFacts.length
    const suggested = entry.derivedSuggestions.length
    const ignored = entry.ignored.length
    console.log(`[ExtractionAudit] ${entry.userId}: ${confirmed}写/${suggested}推/${ignored}拒`)
  } catch (err) {
    // 审计失败不阻塞主流程
    console.warn('[ExtractionAudit] 写入失败:', (err as Error).message)
  }
}

/**
 * 读取某日审计日志（运营后台用）
 */
export function readExtractionAudit(date: string): AuditEntry[] {
  try {
    const logFile = path.join(LOG_DIR, `extraction-${date}.jsonl`)
    if (!fs.existsSync(logFile)) return []
    const lines = fs.readFileSync(logFile, 'utf-8').trim().split('\n')
    return lines.filter(Boolean).map(line => JSON.parse(line))
  } catch {
    return []
  }
}
