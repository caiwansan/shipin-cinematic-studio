/**
 * CoverageExporter — 导出 coverage.json / coverage.md / coverage.csv
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CoverageReportData } from './CoverageReport.js'
import { exportJSON, exportMarkdown } from './CoverageReport.js'

export type ExportFormat = 'json' | 'md' | 'csv'

const EXPORT_DIR = path.resolve(process.cwd(), 'benchmarks', 'coverage', 'exports')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

/**
 * 导出全部格式
 */
export function exportAll(report: CoverageReportData): string[] {
  ensureDir(EXPORT_DIR)
  const files: string[] = []

  // JSON
  const jsonPath = path.join(EXPORT_DIR, 'coverage.json')
  fs.writeFileSync(jsonPath, exportJSON(report), 'utf-8')
  files.push(jsonPath)

  // Markdown
  const mdPath = path.join(EXPORT_DIR, 'coverage.md')
  fs.writeFileSync(mdPath, exportMarkdown(report), 'utf-8')
  files.push(mdPath)

  // CSV (summary table)
  const csvPath = path.join(EXPORT_DIR, 'coverage.csv')
  const csvLines: string[] = ['Capability,Stage,Difficulty,Primary,Secondary,Total,Status']
  for (const entry of report.entries) {
    const status = entry.gap ? 'GAP' : 'COVERED'
    csvLines.push(`${entry.capability},${entry.stage},${entry.difficulty},${entry.primaryDatasets.length},${entry.secondaryDatasets.length},${entry.totalCoverage},${status}`)
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8')
  files.push(csvPath)

  return files
}

/**
 * 导出指定格式
 */
export function exportFormat(report: CoverageReportData, format: ExportFormat): string {
  ensureDir(EXPORT_DIR)

  switch (format) {
    case 'json': {
      const fp = path.join(EXPORT_DIR, 'coverage.json')
      fs.writeFileSync(fp, exportJSON(report), 'utf-8')
      return fp
    }
    case 'md': {
      const fp = path.join(EXPORT_DIR, 'coverage.md')
      fs.writeFileSync(fp, exportMarkdown(report), 'utf-8')
      return fp
    }
    case 'csv': {
      const fp = path.join(EXPORT_DIR, 'coverage.csv')
      const csvLines: string[] = ['Capability,Stage,Difficulty,Primary,Secondary,Total,Status']
      for (const entry of report.entries) {
        const status = entry.gap ? 'GAP' : 'COVERED'
        csvLines.push(`${entry.capability},${entry.stage},${entry.difficulty},${entry.primaryDatasets.length},${entry.secondaryDatasets.length},${entry.totalCoverage},${status}`)
      }
      fs.writeFileSync(fp, csvLines.join('\n'), 'utf-8')
      return fp
    }
  }
}
