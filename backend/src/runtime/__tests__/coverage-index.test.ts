/**
 * Coverage Index Generator — 测试
 *
 * P1.3.3: 覆盖扫描 + 三级缺口分析 + 多格式导出
 */

import { describe, test, expect } from 'vitest'
import { scanAllDatasets, computeSummary } from '../../../benchmarks/coverage/CoverageScanner.js'
import { analyzeGaps, printGapReport } from '../../../benchmarks/coverage/GapAnalyzer.js'
import { buildCoverageReport, exportJSON, exportMarkdown } from '../../../benchmarks/coverage/CoverageReport.js'
import { exportAll, exportFormat } from '../../../benchmarks/coverage/CoverageExporter.js'
import { CapabilityRegistry } from '../../../benchmarks/capabilities/registry.js'

describe('CoverageScanner', () => {
  test('扫描所有能力，数量匹配 Registry', () => {
    const entries = scanAllDatasets()
    expect(entries.length).toBe(CapabilityRegistry.all.length)
  })

  test('每个能力有 stage 和 difficulty', () => {
    const entries = scanAllDatasets()
    for (const e of entries) {
      expect(e.stage).toBeTruthy()
      expect(e.difficulty).toBeTruthy()
    }
  })

  test('CHARACTER_REFERENCE 至少有一个 primary dataset', () => {
    const entries = scanAllDatasets()
    const cr = entries.find(e => e.capability === 'CHARACTER_REFERENCE')
    expect(cr).toBeDefined()
    expect(cr!.primaryDatasets.length).toBeGreaterThanOrEqual(1)
  })
})

describe('CoverageSummary', () => {
  test('computeSummary 返回正确统计', () => {
    const entries = scanAllDatasets()
    const summary = computeSummary(entries)
    expect(summary.total).toBeGreaterThanOrEqual(29)
    expect(summary.covered + summary.missing + summary.weak + summary.sparse).toBe(summary.total)
    expect(summary.coverageScore).toBeGreaterThanOrEqual(0)
    expect(summary.coverageScore).toBeLessThanOrEqual(100)
  })
})

describe('GapAnalyzer', () => {
  test('analyzeGaps 返回三级缺口', () => {
    const entries = scanAllDatasets()
    const report = analyzeGaps(entries)
    expect(report.suggestions.length).toBeGreaterThanOrEqual(0)
    expect(report.critical.length + report.weak.length + report.sparse.length).toBe(report.totalGaps)
  })

  test('每个 gap suggestion 有 suggestedId', () => {
    const entries = scanAllDatasets()
    const report = analyzeGaps(entries)
    for (const s of report.suggestions) {
      expect(s.suggestedId).toBeTruthy()
      expect(s.primaryCapability).toBe(s.capability)
      expect(s.reason).toBeTruthy()
    }
  })

  test('printGapReport 输出 Markdown', () => {
    const entries = scanAllDatasets()
    const report = analyzeGaps(entries)
    const text = printGapReport(report)
    expect(text).toContain('Gap Report')
    if (report.critical.length > 0) expect(text).toContain('P0')
  })
})

describe('CoverageReport', () => {
  test('buildCoverageReport 包含所有维度', () => {
    const entries = scanAllDatasets()
    const report = buildCoverageReport(entries)
    expect(report.summary.total).toBeDefined()
    expect(report.gapReport).toBeDefined()
    expect(report.byStage).toBeDefined()
    expect(report.byDifficulty).toBeDefined()
    expect(report.byGroup).toBeDefined()
  })

  test('byGroup 覆盖每个 group', () => {
    const entries = scanAllDatasets()
    const report = buildCoverageReport(entries)
    const groups = CapabilityRegistry.listGroups()
    for (const g of groups) {
      expect(report.byGroup[g.id]).toBeDefined()
    }
  })

  test('exportJSON 输出有效 JSON', () => {
    const entries = scanAllDatasets()
    const report = buildCoverageReport(entries)
    const json = exportJSON(report)
    const parsed = JSON.parse(json)
    expect(parsed.summary).toBeDefined()
    expect(parsed.entries.length).toBeGreaterThan(0)
  })

  test('exportMarkdown 输出完整 Markdown', () => {
    const entries = scanAllDatasets()
    const report = buildCoverageReport(entries)
    const md = exportMarkdown(report)
    expect(md).toContain('# Capability Coverage Report')
    expect(md).toContain('Coverage Score')
    expect(md).toContain('## Gaps')
    expect(md).toContain('## Detail')
  })
})

describe('CoverageExporter', () => {
  test('exportAll 输出三种格式', () => {
    const entries = scanAllDatasets()
    const report = buildCoverageReport(entries)
    const files = exportAll(report)
    expect(files.length).toBe(3)
    for (const f of files) {
      expect(f).toMatch(/coverage\.(json|md|csv)$/)
    }
  })

  test('exportFormat 支持 json/md/csv', () => {
    const entries = scanAllDatasets()
    const report = buildCoverageReport(entries)
    const extMap = { json: '.json', md: '.md', csv: '.csv' } as const
    for (const [fmt, ext] of Object.entries(extMap)) {
      const fp = exportFormat(report, fmt as any)
      expect(fp.endsWith(ext)).toBe(true)
    }
  })
})
