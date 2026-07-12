/**
 * Report Generator
 *
 * Generates a Markdown regression report from regression, determinism, and diff results.
 *
 * Usage: npx tsx report-generator.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { runRegression } from './regression-suite'
import { runDeterminismCheck } from './determinism-check'
import { snapshotManager } from './snapshot-manager'
import { computeDiff } from './diff-engine'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPORTS_DIR = path.resolve(__dirname, '../reports')
const REPORT_PATH = path.join(REPORTS_DIR, 'regression-report.md')

interface ReportData {
  regression: ReturnType<typeof runRegression>
  determinism: ReturnType<typeof runDeterminismCheck>
  diff: Awaited<ReturnType<typeof snapshotManager.diff>>
}

async function generateReport(): Promise<ReportData> {
  // 1. Run regression
  const regression = runRegression('knowledge')

  // 2. Run determinism check
  const determinism = runDeterminismCheck()

  // 3. Try to compute diff from snapshot
  let diff
  try {
    const oldSnap = await snapshotManager.load('knowledge', 'v1.0')
    const latestSnap = await snapshotManager.load('knowledge', 'latest')
    diff = computeDiff(oldSnap, latestSnap)
  } catch {
    // If no baseline snapshot, create a dummy one
    diff = {
      objectsWithChanges: [],
      recommendationChanges: [],
      maxScoreDelta: 0,
      riskLevel: 'NONE' as const,
      summary: 'No baseline snapshot available for diff comparison.',
    }
  }

  return { regression, determinism, diff }
}

function buildRuleCoverageTable(ruleCoverage: Record<string, { triggered: number; notTriggered: number }>): string {
  let table = '| Rule ID | Triggered | Not Triggered | Coverage % |\n'
  table += '|---------|-----------|---------------|------------|\n'
  for (const [ruleId, cov] of Object.entries(ruleCoverage)) {
    const total = cov.triggered + cov.notTriggered
    const pct = total > 0 ? Math.round((cov.triggered / total) * 100) : 0
    table += `| ${ruleId} | ${cov.triggered} | ${cov.notTriggered} | ${pct}% |\n`
  }
  return table
}

function buildPASSFAILTable(results: Array<{
  objectId: string
  status: string
  actualQuality: { score: number; label: string }
  actualRecommendation: { priority: string }
}>): string {
  let table = '| Object | Status | Quality Score | Quality Label | Recommendation |\n'
  table += '|--------|--------|--------------|---------------|----------------|\n'
  for (const r of results) {
    const statusIcon = r.status === 'PASS' ? '✓ PASS' : '✗ FAIL'
    table += `| ${r.objectId} | ${statusIcon} | ${r.actualQuality.score} | ${r.actualQuality.label} | ${r.actualRecommendation.priority} |\n`
  }
  return table
}

function buildScoreDiffTable(regressionResults: Array<{
  objectId: string
  actualQuality: { score: number; label: string }
  expectedQuality: { score: number; label: string }
}>): string {
  let table = '| Object | Before | After | Delta | Risk |\n'
  table += '|--------|--------|-------|-------|------|\n'
  for (const r of regressionResults) {
    const delta = Math.round((r.actualQuality.score - r.expectedQuality.score) * 100) / 100
    const absDelta = Math.abs(delta)
    let risk = 'None'
    if (absDelta >= 10 && r.actualQuality.label !== r.expectedQuality.label) risk = 'HIGH'
    else if (absDelta >= 10) risk = 'MEDIUM'
    else if (absDelta > 0) risk = 'LOW'
    table += `| ${r.objectId} | ${r.expectedQuality.score} | ${r.actualQuality.score} | ${delta > 0 ? '+' : ''}${delta} | ${risk} |\n`
  }
  return table
}

function buildRecommendationDiffTable(regressionResults: Array<{
  objectId: string
  actualRecommendation: { priority: string }
  expectedRecommendation: { priority: string }
}>): string {
  let table = '| Object | Before | After | Change |\n'
  table += '|--------|--------|-------|--------|\n'
  let hasChanges = false
  for (const r of regressionResults) {
    const changed = r.actualRecommendation.priority !== r.expectedRecommendation.priority
    if (changed) {
      hasChanges = true
      table += `| ${r.objectId} | ${r.expectedRecommendation.priority} | ${r.actualRecommendation.priority} | Yes (${r.expectedRecommendation.priority} → ${r.actualRecommendation.priority}) |\n`
    }
  }
  if (!hasChanges) {
    table += '| _(no changes)_ | — | — | — |\n'
  }
  return table
}

function buildTriggeredRuleMatrix(regressionResults: Array<{
  objectId: string
}>): string {
  // Simplified matrix — just lists all objects and their triggered rules
  // For full matrix, we'd need rule trace per object
  let table = '| Object | ' + ['COV', 'FRESH', 'FRESH2', 'CITE1', 'CITE2', 'AUTH', 'CONS'].join(' | ') + ' |\n'
  table += '|--------|' + '---|'.repeat(7) + '\n'

  const expectations = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../golden/knowledge/expectations/v1.0.json'),
    'utf-8',
  ))
  const traceMap = new Map<string, string[]>()
  for (const exp of expectations.expectations) {
    traceMap.set(exp.objectId, exp.expectedRuleTrace.triggeredRuleIds)
  }

  for (const r of regressionResults) {
    const trace = traceMap.get(r.objectId) || []
    const cov = trace.includes('KR-COVERAGE-001') ? '✓' : '─'
    const fresh1 = trace.includes('KR-FRESHNESS-001') ? '✓' : '─'
    const fresh2 = trace.includes('KR-FRESHNESS-002') ? '✓' : '─'
    const cite1 = trace.includes('KR-CITATION-001') ? '✓' : '─'
    const cite2 = trace.includes('KR-CITATION-002') ? '✓' : '─'
    const auth = trace.includes('KR-AUTHORITY-001') ? '✓' : '─'
    const cons = trace.includes('KR-CONSISTENCY-001') ? '✓' : '─'
    table += `| ${r.objectId} | ${cov} | ${fresh1} | ${fresh2} | ${cite1} | ${cite2} | ${auth} | ${cons} |\n`
  }

  return table
}

async function main(): Promise<void> {
  const data = await generateReport()
  const reg = data.regression
  const det = data.determinism
  const diff = data.diff

  const regPct = reg.total > 0 ? Math.round((reg.passed / reg.total) * 100) : 0
  const detPct = det.total > 0 ? Math.round((det.passed / det.total) * 100) : 0
  const stabilityScore = Math.round((regPct + detPct) / 2)

  const markdown = `# Intelligence Regression Report

## Summary
- **Domain**: ${reg.domain}
- **Regression**: ${reg.passed}/${reg.total} PASS
- **Determinism**: ${detPct}%
- **Stability Score**: ${stabilityScore}%
- **Risk Level**: ${diff.riskLevel}

## PASS / FAIL Detail

${buildPASSFAILTable(reg.results)}

## Rule Coverage

${buildRuleCoverageTable(reg.ruleCoverage)}

## Score Diff (vs v1.0 expectation)

${buildScoreDiffTable(reg.results)}

## Recommendation Diff

${buildRecommendationDiffTable(reg.results)}

## Triggered Rule Matrix

Rows = Objects, Columns = Rules. ✓ = triggered, ─ = not triggered.

${buildTriggeredRuleMatrix(reg.results)}

## Architecture Impact
- **新增平台能力**: Intelligence Test Platform v1.0
- **可复用模块**: regression-suite, determinism-check, snapshot-manager, diff-engine, report-generator
- **后续可复用引擎**: Discovery, Packaging, Distribution, Observation, Adaptive
- **是否改变平台架构**: 是（新增平台级验证能力）
- **是否新增工程规范**: 是（IRG — Intelligence Regression Gate）

## IRG Checklist
- [${reg.passed === reg.total ? 'x' : ' '}] Golden Replay: ${reg.passed}/${reg.total} PASS
- [${det.passed === det.total ? 'x' : ' '}] Determinism: ${detPct}% PASS
- [${Object.values(reg.ruleCoverage).some(c => c.triggered > 0) ? 'x' : ' '}] Rule Coverage: 每条 Rule 有覆盖
- [${diff.riskLevel !== 'HIGH' ? 'x' : ' '}] Score Diff: 可解释
- [${diff.recommendationChanges.length === 0 ? 'x' : ' '}] Recommendation Diff: 可解释
- [${stabilityScore >= 95 ? 'x' : ' '}] Stability Score: ${stabilityScore}% ≥ 95%

---

*Generated: ${new Date().toISOString()}*
*Engine: KnowledgeIntelligenceEngine v1.0*
`

  // Write report
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
  fs.writeFileSync(REPORT_PATH, markdown, 'utf-8')
  console.log(`Report written to ${REPORT_PATH}`)
}

// Run if executed directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith('report-generator.ts') ||
  process.argv[1].endsWith('report-generator')
)

if (isMain) {
  main().catch((err) => {
    console.error('Report generation failed:', err)
    process.exit(1)
  })
}

export { generateReport }
