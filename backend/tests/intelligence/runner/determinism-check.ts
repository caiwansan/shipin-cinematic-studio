/**
 * Determinism Check
 *
 * Verifies that the KnowledgeIntelligenceEngine is deterministic:
 * running evaluate() 3 times on the same input produces identical results.
 */

import { KnowledgeIntelligenceEngine } from '../../../src/engines/knowledge-intelligence'
import { GOLDEN_DATASET } from '../golden/knowledge/inputs/dataset'

interface DeterminismResult {
  total: number
  passed: number
  failed: number
  details: { objectId: string; status: 'PASS' | 'FAIL'; reason?: string }[]
}

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function runDeterminismCheck(): DeterminismResult {
  const engine = new KnowledgeIntelligenceEngine()
  const details: DeterminismResult['details'] = []
  let passed = 0
  let failed = 0

  for (const obj of GOLDEN_DATASET) {
    const run1 = engine.evaluate(obj)
    const run2 = engine.evaluate(obj)
    const run3 = engine.evaluate(obj)

    const ok = deepEqual(run1, run2) && deepEqual(run2, run3)

    if (ok) {
      passed++
      details.push({ objectId: obj.id, status: 'PASS' })
    } else {
      failed++
      let reason = ''
      if (!deepEqual(run1, run2)) reason = 'Run 1 ≠ Run 2'
      else if (!deepEqual(run2, run3)) reason = 'Run 2 ≠ Run 3'
      details.push({ objectId: obj.id, status: 'FAIL', reason })
    }
  }

  return {
    total: GOLDEN_DATASET.length,
    passed,
    failed,
    details,
  }
}

function printReport(result: DeterminismResult): void {
  console.log('')
  console.log('Determinism Check Report')
  console.log('========================')
  console.log('')

  for (const d of result.details) {
    if (d.status === 'PASS') {
      console.log(`${d.objectId}: ✓ PASS (3/3 identical)`)
    } else {
      console.log(`${d.objectId}: ✗ FAIL (${d.reason})`)
    }
  }

  console.log('')
  const pct = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0
  console.log(`Determinism: ${result.passed}/${result.total} (${pct}%)`)
  console.log('')
}

// Run if executed directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith('determinism-check.ts') ||
  process.argv[1].endsWith('determinism-check')
)

if (isMain) {
  const result = runDeterminismCheck()
  printReport(result)
  process.exit(result.failed > 0 ? 1 : 0)
}

export { runDeterminismCheck, printReport }
export type { DeterminismResult }
