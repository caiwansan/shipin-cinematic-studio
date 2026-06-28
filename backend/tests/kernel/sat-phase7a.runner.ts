#!/usr/bin/env tsx
/**
 * Phase 7A SAT — System Acceptance Test Runner
 *
 * Validates the 6 system-level properties (S1-S6) and produces
 * the exact JSON output format specified in the SAT spec.
 *
 * Usage: tsx tests/kernel/sat-phase7a.runner.ts
 */

import { SystemAcceptanceTest, DEFAULT_SAT_CONFIG } from '../../src/tests/sat/system-acceptance-test.js'

async function main() {
  console.log('')
  console.log('🧪 Phase 7A — System Acceptance Test')
  console.log('   Production Readiness Gate')
  console.log('   ' + '─'.repeat(52))
  console.log('')
  console.log(`   Execution Count:  ${DEFAULT_SAT_CONFIG.executionCount}`)
  console.log(`   Concurrency:      ${DEFAULT_SAT_CONFIG.concurrency}`)
  console.log(`   Mutation:         ${DEFAULT_SAT_CONFIG.mutationEnabled}`)
  console.log(`   Policy Evolution: ${DEFAULT_SAT_CONFIG.policyEvolution}`)
  console.log(`   Formal Guard:     ${DEFAULT_SAT_CONFIG.formalGuard}`)
  console.log('')

  const startMs = Date.now()

  const sat = new SystemAcceptanceTest(DEFAULT_SAT_CONFIG)
  const result = await sat.run()

  const elapsed = Date.now() - startMs

  // ── Plain-text report ──────────────────────────────────
  console.log(sat.formatReport(result))
  console.log(`\n   ⏱  ${(elapsed / 1000).toFixed(1)}s`)

  // ── JSON output (machine-readable — matches spec exactly) ──
  const jsonOutput = {
    system_status: result.system_status,
    execution_integrity: result.execution_integrity,
    determinism_score: result.determinism_score,
    cross_plane_leakage: result.cross_plane_leakage,
    mutation_safety: result.mutation_safety,
    benchmark: result.benchmark,
    long_run: result.long_run,
    final_verdict: result.final_verdict,
  }

  console.log('\n' + '─'.repeat(56))
  console.log('📋 Machine-readable output:')
  console.log(JSON.stringify(jsonOutput, null, 2))

  // ── Exit code ─────────────────────────────────────────
  if (result.final_verdict === 'PASS') {
    console.log('\n✅ SAT GATE: PASSED')
    process.exit(0)
  } else {
    console.log('\n❌ SAT GATE: FAILED')
    process.exit(1)
  }
}

main().catch(e => {
  console.error('SAT runner crashed:', e)
  process.exit(2)
})
