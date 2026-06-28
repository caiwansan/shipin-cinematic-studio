/**
 * rfvl/rfvl-run.ts — RFVL 总入口脚本
 *
 * 用法:
 *   npx tsx backend/src/rfvl/rfvl-run.ts run
 *   npx tsx backend/src/rfvl/rfvl-run.ts verify --sample=100
 *   npx tsx backend/src/rfvl/rfvl-run.ts scan  (静态扫描 only)
 *
 * 输出:
 *   格式化为 RFVL 证明报告，控制台 + 文件
 */

import { RFVLScanner } from './scanner.js'
import { RFVLRuntimeVerifier } from './runtime-verifier.js'
import { RFVLReporter } from './reporter.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash, randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function run() {
  console.log('🧠 RFVL START — Runtime Formal Verification Layer\n')

  const args = process.argv.slice(2)
  const mode = args[0] || 'run'

  // Parse --sample=N
  const sampleArg = args.find(a => a.startsWith('--sample='))
  const sampleSize = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : 50

  // ─── Static Scan ──────────────────────────────────
  console.log('🔍 1/3 Static Scan (AIPS + ETFL residual)...')
  const scanResult = await RFVLScanner.scanSystem()

  if (mode === 'scan') {
    console.log(`\nFiles scanned: ${scanResult.stats.filesScanned}`)
    console.log(`Violations: ${scanResult.stats.violations}`)
    if (scanResult.violations.length > 0) {
      console.log('\n⚠️ Violations:')
      scanResult.violations.forEach(v => {
        console.log(`  [${v.type}] ${v.file}:${v.line}`)
      })
    }
    console.log(`\nStatus: ${scanResult.passed ? '🟢 PASS' : '🔴 FAIL'}`)
    process.exit(scanResult.passed ? 0 : 1)
  }

  // ─── Runtime Verification ──────────────────────────
  console.log('⏱ 2/3 Runtime Verification (SEEL + Queue + MSAL + Adapter + Hash)...')
  const runtimeResult = await RFVLRuntimeVerifier.verifyRecentTraces({
    sampleSize,
  })

  // ─── Report Generation ────────────────────────────
  console.log('📊 3/3 Generating RFVL Report...\n')
  const report = RFVLReporter.generate({
    scanResult,
    runtimeResult,
  })

  console.log(report.summary)

  // ─── Write report file ────────────────────────────
  const reportsDir = path.resolve(__dirname, '..', 'reports')
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

  const reportPath = path.join(reportsDir, `rfvl-run-${Date.now()}.md`)
  fs.writeFileSync(reportPath, `# RFVL Run Report\n\n${report.summary}\n\n## Details\n\`\`\`json\n${JSON.stringify({ scan: scanResult.stats, runtime: { total: runtimeResult.total, violations: runtimeResult.runtimeViolations, rate: runtimeResult.rate }, violations: report.violations }, null, 2)}\n\`\`\`\n`)
  console.log(`📝 Report written: ${reportPath}`)

  // ─── Exit code ────────────────────────────────────
  if (report.status === 'VIOLATIONS') {
    console.log('\n❌ RFVL FAILED — Architecture invariants violated')
    process.exit(1)
  }

  console.log('\n✅ RFVL PASSED — All invariants hold')
  process.exit(0)
}

run().catch(err => {
  console.error('❌ RFVL error:', err)
  process.exit(1)
})
