/**
 * runner.ts — CLI entry point for GEO Entity Benchmark.
 *
 * Usage:
 *   tsx benchmark/entity/runner.ts [--provider <name>] [--model <name>] [--sample N] [--category X]
 *
 * Environment:
 *   GLOBAL_TOKEN  – API auth token (required)
 *   BASE_URL      – API base URL (default http://localhost:4002)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { evaluateDataset } from './evaluator'
import {
  generateHtmlReport,
  generateJsonReport,
  generateCsvReport,
  saveBaseline,
  compareWithBaseline,
} from './report'
import type { RunResult } from './evaluator'

// ---------------------------------------------------------------------------
// CLI argument parser
// ---------------------------------------------------------------------------

function parseArgs(): {
  provider?: string
  model?: string
  sample?: number
  category?: string
} {
  const args = process.argv.slice(2)
  const opts: any = {}
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--provider':
        opts.provider = args[++i]
        break
      case '--model':
        opts.model = args[++i]
        break
      case '--sample':
        opts.sample = parseInt(args[++i], 10)
        break
      case '--category':
        opts.category = args[++i]
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
    }
  }
  return opts
}

function printHelp(): void {
  console.log(`
GEO Entity Benchmark Runner

Usage:
  tsx benchmark/entity/runner.ts [options]

Options:
  --provider <name>    Provider name (default: user's configured provider)
  --model <name>       Model name (default: user's configured model)
  --sample <N>         Max number of samples to run
  --category <X>       Filter by category (e.g., "AI", "SaaS")
  --help, -h           Show this help

Environment:
  GLOBAL_TOKEN         API auth token (required)
  BASE_URL             API base URL (default: http://localhost:4002)

Example:
  GLOBAL_TOKEN=xxx tsx benchmark/entity/runner.ts --sample 2 --category ai
`)
}

// ---------------------------------------------------------------------------
// Reports directory
// ---------------------------------------------------------------------------

function reportsDir(): string {
  const dir = path.resolve(
    import.meta.dirname ?? __dirname,
    '..',
    'reports',
    new Date().toISOString().split('T')[0].replace(/-/g, ''),
  )
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// ---------------------------------------------------------------------------
// Console summary output (table format)
// ---------------------------------------------------------------------------

function printSummary(result: RunResult): void {
  const s = result.summary
  console.log('')
  console.log('='.repeat(70))
  console.log('  GEO Entity Benchmark — Summary')
  console.log('='.repeat(70))
  console.log(`  Timestamp:        ${result.timestamp}`)
  console.log(`  Provider/Model:   ${result.provider} / ${result.model}`)
  console.log(`  Prompt Version:   ${result.promptVersion}`)
  console.log(`  Total Samples:    ${result.totalSamples}`)
  console.log('')
  console.log('  ┌──────────────────────┬──────────┐')
  console.log(`  │ Avg Entity Count     │ ${String(s.avgEntityCount).padStart(8)} │`)
  console.log(`  │ Avg Relation Count   │ ${String(s.avgRelationCount).padStart(8)} │`)
  console.log(`  │ Avg Type Coverage    │ ${String(s.avgTypeCoverage).padStart(7)}% │`)
  console.log(`  │ Avg Expected Found   │ ${String(s.avgExpectedFound).padStart(8)} │`)
  console.log(`  │ Avg Runtime (ms)     │ ${String(s.avgRuntimeMs).padStart(8)} │`)
  console.log(`  │ Avg Total Tokens     │ ${String(s.avgTotalTokens).padStart(8)} │`)
  console.log(`  │ Avg Cost (\$ USD)     │ ${String(s.avgCost).padStart(8)} │`)
  console.log(`  │ Avg Score            │ ${String(s.avgScore).padStart(8)} │`)
  console.log('  ├──────────────────────┼──────────┤')
  const dist = s.gradeDistribution
  console.log(`  │ Grade A              │ ${String(dist.A).padStart(8)} │`)
  console.log(`  │ Grade B              │ ${String(dist.B).padStart(8)} │`)
  console.log(`  │ Grade C              │ ${String(dist.C).padStart(8)} │`)
  console.log(`  │ Grade D              │ ${String(dist.D).padStart(8)} │`)
  console.log('  └──────────────────────┴──────────┘')

  // Per-sample table
  console.log('')
  console.log('  ┌──────────────┬──────────┬────────┬───────┬────────┬────────┐')
  console.log('  │ Sample       │   Score  │ Grade  │ Ent.  │ Found  │ Err?   │')
  console.log('  ├──────────────┼──────────┼────────┼───────┼────────┼────────┤')
  for (const sr of result.samples) {
    const id = (sr.metrics.sampleId ?? '?').slice(0, 12).padEnd(12)
    const score = String(sr.score.overall).padStart(8)
    const grade = sr.score.grade.padEnd(6)
    const ent = String(sr.metrics.entityCount).padStart(5)
    const found = `${sr.metrics.expectedFound}/${sr.metrics.expectedTotal}`.padStart(6)
    const err = sr.error ? '⚠'.padStart(6) : '✓'.padStart(6)
    console.log(`  │ ${id} │ ${score} │ ${grade} │ ${ent} │ ${found} │ ${err} │`)
  }
  console.log('  └──────────────┴──────────┴────────┴───────┴────────┴────────┘')
  console.log('')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs()
  const dir = reportsDir()

  if (!process.env.GLOBAL_TOKEN) {
    console.error('ERROR: GLOBAL_TOKEN environment variable is required.')
    console.error('Set it to your API auth token.')
    process.exit(1)
  }

  // 1. Load dataset
  const datasetPath = path.resolve(
    import.meta.dirname ?? __dirname,
    'dataset.json',
  )
  if (!fs.existsSync(datasetPath)) {
    console.error(`ERROR: Dataset not found at ${datasetPath}`)
    process.exit(1)
  }
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'))
  console.log(`[runner] Loaded dataset: ${dataset.meta?.description ?? ''} (${(dataset.samples ?? []).length} samples)`)

  // 2. Evaluate
  const result: RunResult = await evaluateDataset(dataset, options)

  // 3. Generate reports
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const baseName = `benchmark-${dateStr}-${result.provider}-${result.model}`

  generateHtmlReport(result, path.join(dir, `${baseName}.html`))
  generateJsonReport(result, path.join(dir, `${baseName}.json`))
  generateCsvReport(result, path.join(dir, `${baseName}.csv`))

  // Also save latest copies
  const latestDir = path.resolve(
    import.meta.dirname ?? __dirname,
    '..',
    'reports',
  )
  generateHtmlReport(result, path.join(latestDir, 'html', 'latest.html'))
  generateJsonReport(result, path.join(latestDir, 'json', 'latest.json'))
  generateCsvReport(result, path.join(latestDir, 'csv', 'latest.csv'))

  // 4. Save baseline & compare
  saveBaseline(result)
  const comparison = compareWithBaseline(result)
  if (comparison.deltas) {
    console.log('[runner] Baseline comparison:')
    for (const [key, val] of Object.entries(comparison.deltas)) {
      const sign = typeof val === 'number' && val > 0 ? '+' : ''
      console.log(`  ${key}: ${sign}${val}%`)
    }
    if (comparison.regression) {
      console.log('  ⚠ REGRESSION DETECTED — one or more metrics degraded by >10%')
    }
  }

  // 5. Print summary to console
  printSummary(result)

  console.log(`[runner] Reports saved to ${dir}/`)
}

// Allow running directly
const isEntryPoint = import.meta.url.endsWith(process.argv[1]?.split('/').pop() || '')
if (isEntryPoint) {
  main().catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
}

export { main }
