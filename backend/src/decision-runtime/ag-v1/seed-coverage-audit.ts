/**
 * seed-coverage-audit.ts — P0: Seed Coverage Audit
 *
 * 输出报告：哪些种子命中多、哪些冷、哪些查询匹配不到种子
 *
 * 用法:
 *   tsx src/decision-runtime/ag-v1/seed-coverage-audit.ts
 *
 * 前置条件:
 *   - benchmark-report.json 已存在（或 /tmp/ag-v1-raw-results.json）
 */

import fs from 'fs'
import path from 'path'

// ====== 配置 ======
const REPORT_PATH = path.resolve(__dirname, '../../benchmark-report.json')
const RAW_RESULTS_PATH = '/tmp/ag-v1-raw-results.json'
const OUTPUT_PATH = path.resolve(__dirname, '../../seed-coverage-report.json')

// ====== 类型 ======
interface ResultEntry {
  query: string
  evidenceCount: number
  clusterCount: number
  dominanceScore: number
  confidenceLabel: string
  coverageGap: boolean
  budgetExhausted: boolean
  coverageConfidence: number
  durationMs: number
  timeout: boolean
  error: string | null
  expectedIntent?: string
  expectedDomain?: string
}

interface SeedGroup {
  domain: string
  queries: ResultEntry[]
  total: number
  gapCount: number
  avgEvidence: number
  avgConfidence: number
  highConfRatio: number
  zeroEvidenceCount: number
}

interface SeedCoverageReport {
  generatedAt: string
  totalCases: number
  validCases: number
  
  // 全局统计
  globalGapRate: number
  avgEvidence: number
  avgCoverageConfidence: number
  
  // 按领域
  byDomain: Record<string, SeedGroup>
  
  // 按种子（命中数排序）
  seedRanking: Array<{
    domain: string
    total: number
    gapCount: number
    gapRate: number
    avgEvidence: number
    avgConfidence: number
    highConfRatio: number
    zeroEvidenceCount: number
  }>
  
  // 最需要补的领域
  priorityTargets: Array<{
    domain: string
    gapRate: number
    lowEvidenceRate: number
    recommendation: string
  }>
  
  // Gap 查询明细
  topGapQueries: Array<{
    query: string
    domain: string
    evidenceCount: number
    clusterCount: number
    confidenceLabel: string
    coverageConfidence: number
  }>
  
  // 零证据查询（最严重）
  zeroEvidenceQueries: Array<{
    query: string
    domain: string
  }>
  
  // Unmatched 查询（coverageConfidence < 0.3 且 gap=true）
  unmatchedQueries: Array<{
    query: string
    domain: string
    evidenceCount: number
    coverageConfidence: number
  }>
}

function loadResults(): ResultEntry[] {
  // Try benchmark-report.json first, then raw results
  for (const p of [REPORT_PATH, RAW_RESULTS_PATH]) {
    try {
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
        if (raw.results) return raw.results
        if (Array.isArray(raw)) return raw
      }
    } catch {}
  }
  return []
}

function generateReport(results: ResultEntry[]): SeedCoverageReport {
  const valid = results.filter(r => !r.timeout && !r.error)
  const n = valid.length

  // 1. 按领域分组
  const byDomain: Record<string, ResultEntry[]> = {}
  for (const r of valid) {
    const d = r.expectedDomain || 'unknown'
    if (!byDomain[d]) byDomain[d] = []
    byDomain[d].push(r)
  }

  // 2. 计算每组的统计
  const groups: Record<string, SeedGroup> = {}
  for (const [domain, queries] of Object.entries(byDomain)) {
    const gapCount = queries.filter(q => q.coverageGap).length
    const avgEvidence = queries.reduce((s, q) => s + q.evidenceCount, 0) / queries.length
    const avgConf = queries.reduce((s, q) => s + (q.coverageConfidence || 0), 0) / queries.length
    const highConfRatio = queries.filter(q => q.confidenceLabel === 'high' || q.confidenceLabel === 'medium').length / queries.length
    const zeroEvidenceCount = queries.filter(q => q.evidenceCount === 0).length

    groups[domain] = {
      domain,
      queries,
      total: queries.length,
      gapCount,
      avgEvidence: parseFloat(avgEvidence.toFixed(2)),
      avgConfidence: parseFloat(avgConf.toFixed(3)),
      highConfRatio: parseFloat(highConfRatio.toFixed(3)),
      zeroEvidenceCount,
    }
  }

  // 3. 排序：按 gapRate 降序
  const seedRanking = Object.values(groups)
    .map(g => ({
      domain: g.domain,
      total: g.total,
      gapCount: g.gapCount,
      gapRate: parseFloat((g.gapCount / g.total).toFixed(3)),
      avgEvidence: g.avgEvidence,
      avgConfidence: g.avgConfidence,
      highConfRatio: g.highConfRatio,
      zeroEvidenceCount: g.zeroEvidenceCount,
    }))
    .sort((a, b) => b.gapRate - a.gapRate)

  // 4. Priority Targets
  const priorityTargets = seedRanking
    .filter(r => r.gapRate > 0.5 || r.zeroEvidenceCount / r.total > 0.5)
    .map(r => {
      const lowEvidenceRate = r.zeroEvidenceCount / r.total
      let recommendation = ''
      if (r.gapRate > 0.7) {
        recommendation = `🔴 紧急：gap=${(r.gapRate * 100).toFixed(0)}%，零证据率=${(lowEvidenceRate * 100).toFixed(0)}%，需补充 ${r.domain} 领域种子`
      } else if (r.gapRate > 0.5) {
        recommendation = `🟡 需关注：gap=${(r.gapRate * 100).toFixed(0)}%，存在 ${r.zeroEvidenceCount}/${r.total} 条零证据查询`
      } else {
        recommendation = `🟢 较健康，可继续观察`
      }
      return {
        domain: r.domain,
        gapRate: r.gapRate,
        lowEvidenceRate: parseFloat(lowEvidenceRate.toFixed(3)),
        recommendation,
      }
    })

  // 5. Top Gap Queries
  const topGapQueries = valid
    .filter(r => r.coverageGap)
    .sort((a, b) => a.evidenceCount - b.evidenceCount)
    .slice(0, 50)
    .map(r => ({
      query: r.query,
      domain: r.expectedDomain || 'unknown',
      evidenceCount: r.evidenceCount,
      clusterCount: r.clusterCount,
      confidenceLabel: r.confidenceLabel,
      coverageConfidence: r.coverageConfidence || 0,
    }))

  // 6. Zero Evidence
  const zeroEvidenceQueries = valid
    .filter(r => r.evidenceCount === 0 && r.coverageGap)
    .map(r => ({
      query: r.query,
      domain: r.expectedDomain || 'unknown',
    }))

  // 7. Unmatched (low covConf + gap)
  const unmatchedQueries = valid
    .filter(r => r.coverageGap && (r.coverageConfidence || 0) < 0.3)
    .sort((a, b) => (a.coverageConfidence || 0) - (b.coverageConfidence || 0))
    .slice(0, 50)
    .map(r => ({
      query: r.query,
      domain: r.expectedDomain || 'unknown',
      evidenceCount: r.evidenceCount,
      coverageConfidence: r.coverageConfidence || 0,
    }))

  // 全局统计
  const globalGapRate = valid.filter(r => r.coverageGap).length / n
  const avgEvidence = valid.reduce((s, r) => s + r.evidenceCount, 0) / n
  const avgCoverageConfidence = valid.reduce((s, r) => s + (r.coverageConfidence || 0), 0) / n

  return {
    generatedAt: new Date().toISOString(),
    totalCases: results.length,
    validCases: n,
    globalGapRate: parseFloat(globalGapRate.toFixed(3)),
    avgEvidence: parseFloat(avgEvidence.toFixed(2)),
    avgCoverageConfidence: parseFloat(avgCoverageConfidence.toFixed(3)),
    byDomain: groups,
    seedRanking,
    priorityTargets,
    topGapQueries,
    zeroEvidenceQueries,
    unmatchedQueries,
  }
}

function main() {
  console.log('========================================')
  console.log('  Seed Coverage Audit')
  console.log('========================================\n')

  const results = loadResults()
  if (results.length === 0) {
    console.error('❌ 未找到 benchmark 结果文件！')
    console.error('   请先运行 benchmark 或提供 RAW_RESULTS_PATH')
    process.exit(1)
  }

  console.log(`加载 ${results.length} 条结果\n`)

  const report = generateReport(results)

  // 输出摘要
  console.log('--- 全局 ---')
  console.log(`  总用例: ${report.totalCases}`)
  console.log(`  有效用例: ${report.validCases}`)
  console.log(`  全局 Gap 率: ${(report.globalGapRate * 100).toFixed(1)}%`)
  console.log(`  平均证据数: ${report.avgEvidence}`)
  console.log(`  平均覆盖率置信度: ${report.avgCoverageConfidence}`)
  console.log()

  console.log('--- Seed Ranking (按 gapRate 降序) ---')
  for (const r of report.seedRanking) {
    const bar = '█'.repeat(Math.round(r.gapRate * 10)) + '░'.repeat(10 - Math.round(r.gapRate * 10))
    console.log(`  [${r.domain.padEnd(12)}] ${bar} gap=${(r.gapRate * 100).toFixed(0)}% ev=${r.avgEvidence.toFixed(1)} zeroEv=${r.zeroEvidenceCount}/${r.total}`)
  }
  console.log()

  console.log('--- Priority Targets ---')
  for (const t of report.priorityTargets) {
    console.log(`  ${t.recommendation}`)
  }
  console.log()

  console.log(`--- Top Gap Queries (前 10) ---`)
  for (const q of report.topGapQueries.slice(0, 10)) {
    console.log(`  [${q.domain}] ${q.query} — ev=${q.evidenceCount} conf=${q.confidenceLabel}`)
  }
  console.log()

  console.log(`--- Zero Evidence (${report.zeroEvidenceQueries.length} 条) ---`)
  for (const q of report.zeroEvidenceQueries.slice(0, 10)) {
    console.log(`  [${q.domain}] ${q.query}`)
  }
  console.log()

  console.log(`--- Unmatched (低 covConf + gap, ${report.unmatchedQueries.length} 条) ---`)
  for (const q of report.unmatchedQueries.slice(0, 10)) {
    console.log(`  [${q.domain}] ${q.query} — covConf=${q.coverageConfidence.toFixed(2)} ev=${q.evidenceCount}`)
  }

  // 输出报告文件
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2,), 'utf-8')
  console.log(`\n报告已写入: ${OUTPUT_PATH}`)
}

main()
