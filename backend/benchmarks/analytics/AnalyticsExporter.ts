/**
 * Analytics Exporter — 导出 JSON/Markdown 文件 + Trend 快照
 */

import * as fs from 'fs'
import * as path from 'path'
import type { AnalyticsSnapshot } from './AnalyticsTypes.js'
import { exportJSON, exportMarkdown } from './AnalyticsReport.js'

const EXPORT_DIR = path.resolve(process.cwd(), 'benchmarks', 'analytics', 'exports')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

/**
 * 导出当前快照
 */
export function exportSnapshot(snapshot: AnalyticsSnapshot): string[] {
  ensureDir(EXPORT_DIR)
  const files: string[] = []

  // JSON
  const jsonPath = path.join(EXPORT_DIR, 'analytics.json')
  fs.writeFileSync(jsonPath, exportJSON(snapshot), 'utf-8')
  files.push(jsonPath)

  // Markdown
  const mdPath = path.join(EXPORT_DIR, 'analytics.md')
  fs.writeFileSync(mdPath, exportMarkdown(snapshot), 'utf-8')
  files.push(mdPath)

  // Timestamped run snapshot (for Trend)
  const ts = snapshot.generated.replace(/[:.]/g, '-')
  const runDir = path.join(EXPORT_DIR, 'runs')
  ensureDir(runDir)
  const runPath = path.join(runDir, `run_${ts}.json`)
  fs.writeFileSync(runPath, exportJSON(snapshot), 'utf-8')
  files.push(runPath)

  return files
}

/**
 * 读取历史 Trend 快照
 */
export function listRuns(): { timestamp: string; path: string }[] {
  const runDir = path.join(EXPORT_DIR, 'runs')
  if (!fs.existsSync(runDir)) return []

  const runs: { timestamp: string; path: string }[] = []
  for (const file of fs.readdirSync(runDir)) {
    if (!file.startsWith('run_') || !file.endsWith('.json')) continue
    const ts = file.replace('run_', '').replace('.json', '').replace(/-/g, ':')
    runs.push({ timestamp: ts, path: path.join(runDir, file) })
  }

  return runs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

/**
 * 计算 Trend 数据（简版）
 */
export function computeTrends(): { coverageHistory: { time: string; score: number; health: number }[] } {
  const runs = listRuns()
  const coverageHistory: { time: string; score: number; health: number }[] = []

  for (const run of runs) {
    try {
      const data = JSON.parse(fs.readFileSync(run.path, 'utf-8')) as AnalyticsSnapshot
      coverageHistory.push({
        time: run.timestamp,
        score: data.summary.averageCoverage,
        health: data.summary.healthScore,
      })
    } catch {
      // skip corrupt runs
    }
  }

  return { coverageHistory }
}
