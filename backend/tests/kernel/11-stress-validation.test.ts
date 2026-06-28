#!/usr/bin/env tsx
/**
 * Phase 7A-5 — Cross-Layer Stress & Stability Validation
 *
 * Runs the full stress suite and produces a stability verdict.
 * This is the main entry point for Phase 7A-5 stress testing.
 */

import { StressRunner, INTENSE_STRESS_CONFIG, DEFAULT_STRESS_CONFIG } from '../../src/tests/stress/index.js'

async function main() {
  let passedTests = 0
  let failedTests = 0
  const failures: string[] = []

  function test(name: string, fn: () => void) {
    try {
      fn()
      passedTests++
      console.log(`  ✅ ${name}`)
    } catch (e) {
      failedTests++
      console.log(`  ❌ ${name}: ${(e as Error).message}`)
      failures.push(name)
      process.exitCode = 1
    }
  }

  async function runTest(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      passedTests++
      console.log(`  ✅ ${name}`)
    } catch (e) {
      failedTests++
      console.log(`  ❌ ${name}: ${(e as Error).message}`)
      failures.push(name)
      process.exitCode = 1
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('  Phase 7A-5 — Cross-Layer Stress & Stability Validation')
  console.log('='.repeat(60) + '\n')

  // ============================================================
  // Stress Runner: construction
  // ============================================================

  const runner = new StressRunner()

  test('StressRunner construction', () => {
    if (!runner) throw new Error('Failed to construct StressRunner')
  })

  // ============================================================
  // Default stress suite
  // ============================================================

  await runTest('Default stress suite completes', async () => {
    const report = await runner.runAll(DEFAULT_STRESS_CONFIG)
    if (!report) throw new Error('No report returned')
    if (report.finalVerdict !== 'STABLE' && report.finalVerdict !== 'DEGRADED') {
      throw new Error(`Expected STABLE or DEGRADED, got ${report.finalVerdict}`)
    }
  })

  await runTest('Intense stress suite completes', async () => {
    const report = await runner.runAll(INTENSE_STRESS_CONFIG)
    if (!report) throw new Error('No report returned')
  })

  // ============================================================
  // Verdict & Score Validation
  // ============================================================

  await runTest('Quick check returns status', async () => {
    const quick = await runner.quickCheck()
    if (typeof quick.stable !== 'boolean') throw new Error('Expected boolean stable')
    if (typeof quick.score !== 'number') throw new Error('Expected numeric score')
  })

  await runTest('Default stress produces detailed report', async () => {
    const report = await runner.runAll(DEFAULT_STRESS_CONFIG)
    if (!report.chaos) throw new Error('Missing chaos phase')
    if (!report.stability) throw new Error('Missing stability phase')
    if (!report.load) throw new Error('Missing load phase')
    if (!report.invariants) throw new Error('Missing invariants phase')
    if (!report.finalVerdict) throw new Error('Missing verdict')
  })

  // ============================================================
  // Summary formatting
  // ============================================================

  await runTest('Summary formatting works', async () => {
    const report = await runner.runAll(DEFAULT_STRESS_CONFIG)
    const summary = runner.summarize(report)
    if (!summary.includes('Phase 7A-5')) throw new Error('Missing title in summary')
    if (!summary.includes(report.finalVerdict)) throw new Error('Missing verdict in summary')
  })

  // ============================================================
  // Print final results
  // ============================================================

  console.log('\n' + '='.repeat(60))

  if (failedTests === 0) {
    console.log(`\n🟢 Phase 7A-5 Stress Validation: ${passedTests}/${passedTests} passed`)
  } else {
    console.log(`   Phase 7A-5: ${passedTests} passed, ${failedTests} failed`)
    console.log('   Failures:', failures.join(', '))
  }

  // Print the full report from default stress
  console.log('\n--- Default Stress Report ---')
  const finalReport = await runner.runAll(DEFAULT_STRESS_CONFIG)
  console.log(runner.summarize(finalReport))

  console.log('\n' + '='.repeat(60) + '\n')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
