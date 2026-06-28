/**
 * rfvl/reporter.ts — RFVL 报告生成器
 *
 * 合并静态扫描 + 运行时验证结果，生成最终报告。
 * 在 CI/部署前作为 gate 使用。
 */

import type { ScanResult } from './scanner.js'
import type { RuntimeResult } from './runtime-verifier.js'

export interface RFVLReport {
  summary: string
  timestamp: string
  scanResult: ScanResult
  runtimeResult: RuntimeResult
  violations: {
    total: number
    staticViolations: number
    runtimeViolations: number
  }
  status: 'PASS' | 'VIOLATIONS'
}

export class RFVLReporter {

  static generate(input: {
    scanResult: ScanResult
    runtimeResult: RuntimeResult
  }): RFVLReport {
    const { scanResult, runtimeResult } = input

    const staticTotal =
      scanResult.stats.directProviderCalls +
      scanResult.stats.envLeaks +
      scanResult.stats.adapterBypass +
      scanResult.stats.queueBypass

    const runtimeTotal = runtimeResult.runtimeViolations

    const totalViolations = staticTotal + runtimeTotal

    const status = totalViolations === 0 ? 'PASS' : 'VIOLATIONS'

    let summary = `
🧠 RFVL REPORT — ${new Date().toISOString()}
${'─'.repeat(50)}
STATIC SCAN:
  filesScanned:       ${scanResult.stats.filesScanned}
  directProviderCalls: ${scanResult.stats.directProviderCalls}
  envLeaks:           ${scanResult.stats.envLeaks}
  adapterBypass:      ${scanResult.stats.adapterBypass}
  queueBypass:        ${scanResult.stats.queueBypass}
  ─────────────────────
  staticViolations:   ${staticTotal}

RUNTIME VERIFY:
  sampleSize:         ${runtimeResult.total}
  runtimeViolations:  ${runtimeResult.runtimeViolations}
  violationRate:      ${(runtimeResult.rate * 100).toFixed(2)}%
  ─────────────────────
  runtimeViolations:  ${runtimeTotal}

OVERALL:
  totalViolations:    ${totalViolations}
  status:             ${status === 'PASS' ? '🟢 PASS' : '🔴 VIOLATIONS'}
  systemAssertion:    ${status === 'PASS' ? 'RFVL: ALL INVARIANTS HOLD' : 'RFVL: INVARIANT VIOLATION DETECTED'}
${'─'.repeat(50)}
`

    if (scanResult.violations.length > 0) {
      summary += '\n\n⚠️  STATIC VIOLATIONS:\n'
      for (const v of scanResult.violations.slice(0, 10)) {
        summary += `  [${v.type}] ${v.file}:${v.line} — ${v.snippet}\n`
      }
    }

    if (runtimeResult.details.length > 0) {
      const runtimeFails = runtimeResult.details.filter(d => !d.passed)
      if (runtimeFails.length > 0) {
        summary += '\n\n⚠️  RUNTIME VIOLATIONS (recent):\n'
        for (const d of runtimeFails.slice(0, 5)) {
          summary += `  trace=${d.requestId} steps=[${d.failedSteps.join(', ')}]\n`
        }
      }
    }

    return {
      summary,
      timestamp: new Date().toISOString(),
      scanResult,
      runtimeResult,
      violations: {
        total: totalViolations,
        staticViolations: staticTotal,
        runtimeViolations: runtimeTotal,
      },
      status,
    }
  }
}
