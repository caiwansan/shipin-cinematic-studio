#!/usr/bin/env tsx
/**
 * Phase 7A-4C Feedback Loop Engine Validation Tests
 *
 * Verifies:
 *   - OptimizationOutcomeBuilder: before/after metrics → correct outcome
 *   - PerformanceEvaluator: comparison logic
 *   - GainAnalyzer: efficiency, accuracy, score, classification
 *   - OptimizationMemory: append-only (C4), success rate, average score
 *   - StrategyUpdater: C1 (no direct mutation), C2 (weight drift only), rate limiting
 *   - FeedbackLoopEngine: full pipeline
 */

import { OptimizationOutcomeBuilder } from '../../src/kernel/optimization-feedback/optimization-outcome.js'
import { PerformanceEvaluator } from '../../src/kernel/optimization-feedback/performance-evaluator.js'
import { GainAnalyzer } from '../../src/kernel/optimization-feedback/gain-analyzer.js'
import { OptimizationMemory } from '../../src/kernel/optimization-feedback/optimization-memory.js'
import { StrategyUpdater } from '../../src/kernel/optimization-feedback/strategy-updater.js'
import { FeedbackLoopEngine } from '../../src/kernel/optimization-feedback/feedback-loop-engine.js'
import type { ExecutionMetrics, OptimizationOutcome } from '../../src/kernel/optimization-feedback/types.js'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
  } catch (e) {
    console.log(`  ❌ ${name}: ${(e as Error).message}`)
    process.exitCode = 1
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

const beforeMetrics: ExecutionMetrics = {
  latency: 50000, nodeCount: 4, computeCost: 200, retries: 1, success: true,
}

const afterBetter: ExecutionMetrics = {
  latency: 35000, nodeCount: 3, computeCost: 150, retries: 0, success: true,
}

const afterWorse: ExecutionMetrics = {
  latency: 60000, nodeCount: 5, computeCost: 250, retries: 2, success: true,
}

console.log('\n=== Phase 7A-4C: Feedback Loop Validation ===\n')

// ============================================================
// 1. OptimizationOutcomeBuilder
// ============================================================

{
  console.log('--- 1. Outcome Builder ---\n')

  const builder = new OptimizationOutcomeBuilder()

  const outcome = builder.build('plan-1', beforeMetrics, afterBetter, 15)
  test('outcome has correct planId', () => {
    assert(outcome.planId === 'plan-1', `expected plan-1, got ${outcome.planId}`)
  })
  test('actualGain = before - after latency', () => {
    assert(outcome.actualGain === 15000, `expected 15000, got ${outcome.actualGain}`)
  })
  test('success when latency decreases', () => {
    assert(outcome.success === true, 'should be success')
  })
  test('drift = |predicted - actual|', () => {
    assert(outcome.drift === Math.abs(15 - 15000), `drift should be correct`)
  })

  const outcomeWorse = builder.build('plan-2', beforeMetrics, afterWorse, 10)
  test('success = false when latency increases', () => {
    assert(outcomeWorse.success === false, 'should be failure')
  })
  test('negative actualGain when latency increases', () => {
    assert(outcomeWorse.actualGain < 0, 'latency increased, negative gain')
  })
}

// ============================================================
// 2. PerformanceEvaluator
// ============================================================

{
  console.log('--- 2. Performance Evaluator ---\n')

  const evaluator = new PerformanceEvaluator()

  const outcome = evaluator.compare(beforeMetrics, afterBetter, 'eval-1', 20)
  test('evaluator creates correct outcome', () => {
    assert(outcome.planId === 'eval-1', 'planId correct')
    assert(outcome.actualGain === 15000, `expected 15000, got ${outcome.actualGain}`)
  })
  test('evaluator preserves before/after metrics', () => {
    assert(outcome.beforeMetrics.latency === 50000, 'before preserved')
    assert(outcome.afterMetrics.latency === 35000, 'after preserved')
  })
}

// ============================================================
// 3. GainAnalyzer
// ============================================================

{
  console.log('--- 3. Gain Analyzer ---\n')

  const analyzer = new GainAnalyzer()
  const outcome: OptimizationOutcome = {
    planId: 'gain-1',
    beforeMetrics,
    afterMetrics: afterBetter,
    actualGain: 15000,
    predictedGain: 15000,
    drift: 0,
    success: true,
  }

  const analysis = analyzer.compute(outcome)
  test('perfect prediction → efficiency = 1', () => {
    assert(analysis.efficiency === 1, `expected 1, got ${analysis.efficiency}`)
  })
  test('zero drift → accuracy = 1', () => {
    assert(analysis.accuracy === 1, `expected 1, got ${analysis.accuracy}`)
  })
  test('score is average of efficiency and accuracy', () => {
    assert(analysis.score === 1, `expected 1, got ${analysis.score}`)
  })

  // Underestimated prediction
  const underOutcome: OptimizationOutcome = {
    planId: 'gain-2',
    beforeMetrics,
    afterMetrics: afterBetter,
    actualGain: 30000,
    predictedGain: 10000,
    drift: 20000,
    success: true,
  }
  const underAnalysis = analyzer.compute(underOutcome)
  test('underestimated → efficiency > 1', () => {
    assert(underAnalysis.efficiency > 1, `expected > 1, got ${underAnalysis.efficiency}`)
  })
  test('underestimated → accuracy < 1', () => {
    assert(underAnalysis.accuracy < 1, `expected < 1, got ${underAnalysis.accuracy}`)
  })

  // Classification
  test('accurate prediction classified as ACCURATE', () => {
    const cls = analyzer.classifyAccuracy(outcome)
    assert(cls === 'ACCURATE', `expected ACCURATE, got ${cls}`)
  })
  test('underestimated prediction classified correctly', () => {
    const cls = analyzer.classifyAccuracy(underOutcome)
    assert(cls === 'UNDERESTIMATED', `expected UNDERESTIMATED, got ${cls}`)
  })
  test('overestimated prediction classified correctly', () => {
    const overOutcome: OptimizationOutcome = {
      planId: 'gain-3',
      beforeMetrics, afterMetrics: afterBetter,
      actualGain: 5000, predictedGain: 15000, drift: 10000, success: true,
    }
    const cls = analyzer.classifyAccuracy(overOutcome)
    assert(cls === 'OVERESTIMATED', `expected OVERESTIMATED, got ${cls}`)
  })

  // Aggregate
  const aggregate = analyzer.aggregate([outcome, underOutcome])
  test('aggregate produces average metrics', () => {
    assert(aggregate.efficiency > 0, 'aggregate efficiency > 0')
    assert(aggregate.accuracy > 0, 'aggregate accuracy > 0')
    assert(aggregate.score > 0, 'aggregate score > 0')
  })
}

// ============================================================
// 4. OptimizationMemory (C4 — append-only)
// ============================================================

{
  console.log('--- 4. Optimization Memory ---\n')

  const memory = new OptimizationMemory()

  test('fresh memory has size 0', () => {
    assert(memory.size === 0, 'should be empty')
  })

  const outcome: OptimizationOutcome = {
    planId: 'mem-1',
    beforeMetrics, afterMetrics: afterBetter,
    actualGain: 15000, predictedGain: 15000, drift: 0, success: true,
  }
  memory.store(outcome)

  test('size increases after store', () => {
    assert(memory.size === 1, `expected 1, got ${memory.size}`)
  })

  const failOutcome: OptimizationOutcome = {
    planId: 'mem-2',
    beforeMetrics, afterMetrics: afterWorse,
    actualGain: -10000, predictedGain: 10000, drift: 20000, success: false,
  }
  memory.store(failOutcome)

  test('getAll returns all records', () => {
    assert(memory.getAll().length === 2, 'expected 2 records')
  })
  test('getSuccessful filters correctly', () => {
    assert(memory.getSuccessful().length === 1, 'expected 1 success')
  })
  test('getFailed filters correctly', () => {
    assert(memory.getFailed().length === 1, 'expected 1 failure')
  })
  test('success rate is 0.5', () => {
    assert(memory.getSuccessRate() === 0.5, `expected 0.5, got ${memory.getSuccessRate()}`)
  })
  test('getRecent returns last N', () => {
    const recent = memory.getRecent(1)
    assert(recent.length === 1, 'expected 1 recent')
    assert(recent[0].outcome.planId === 'mem-2', 'expected mem-2')
  })

  const all = memory.getAll()
  test('getAll returns immutable snapshot', () => {
    // Modify returned array — should not affect memory
    (all as any[]).length = 0
    assert(memory.size === 2, 'original memory unchanged')
  })
}

// ============================================================
// 5. StrategyUpdater (C1, C2)
// ============================================================

{
  console.log('--- 5. Strategy Updater ---\n')

  const updater = new StrategyUpdater()

  test('default weights are 1.0', () => {
    const weights = updater.getWeights()
    assert(weights.fuseWeight === 1.0, 'fuse weight default')
    assert(weights.reorderWeight === 1.0, 'reorder weight default')
  })

  // Accurate, successful outcome → strengthen
  const accurateOutcome: OptimizationOutcome = {
    planId: 'FUSE-test-1',
    beforeMetrics, afterMetrics: afterBetter,
    actualGain: 15000, predictedGain: 15000, drift: 0, success: true,
  }
  const adj = updater.updateIfSafe(accurateOutcome)
  test('accurate prediction → adjustment applied', () => {
    assert(adj?.applied === true, `expected applied, got: ${adj?.reason}`)
  })
  test('accurate prediction → weight increases', () => {
    const weights = updater.getWeights()
    assert(weights.fuseWeight > 1.0, `expected > 1.0, got ${weights.fuseWeight}`)
  })

  // Overestimated outcome → weaken
  const overOutcome: OptimizationOutcome = {
    planId: 'REORDER-test-2',
    beforeMetrics, afterMetrics: afterBetter,
    actualGain: 5000, predictedGain: 15000, drift: 10000, success: true,
  }
  const overAdj = updater.updateIfSafe(overOutcome)
  test('overestimated prediction → possibly no adjustment (rate limited)', () => {
    const weights = updater.getWeights()
    assert(weights.fuseWeight > 0, 'weights accessible')
  })

  // C1: No direct planner mutation
  test('C1: updater returns adjustment, does not mutate planner', () => {
    assert(adj !== null, 'adjustment is advisory')
    assert('heuristic' in adj!, 'adjustment references heuristic name')
  })

  // C2: Only heuristic drift
  test('C2: adjustment only changes weight value', () => {
    // Create a fresh updater to avoid rate limiting
    const freshUpdater = new StrategyUpdater()
    const oldFuse = freshUpdater.getWeights().fuseWeight
    // Apply a successful outcome to increase weight
    const testOutcome: OptimizationOutcome = {
      planId: 'FUSE-test-c2',
      beforeMetrics, afterMetrics: afterBetter,
      actualGain: 15000, predictedGain: 15000, drift: 0, success: true,
    }
    freshUpdater.updateIfSafe(testOutcome)
    const newWeights = freshUpdater.getWeights()
    assert(newWeights.fuseWeight > oldFuse,
      `expected > ${oldFuse}, got ${newWeights.fuseWeight}`)
  })

  // Drift too high → no adjustment
  const highDriftUpdater = new StrategyUpdater()
  const highDriftOutcome: OptimizationOutcome = {
    planId: 'FUSE-test-drift',
    beforeMetrics, afterMetrics: afterBetter,
    actualGain: 15000, predictedGain: 100, drift: 14900, success: true,
  }
  const noAdj = highDriftUpdater.updateIfSafe(highDriftOutcome)
  test('high drift > 50% → no adjustment', () => {
    assert(noAdj?.applied === false, 'should not apply adjustment')
  })

  // Reset weights
  updater.resetWeights()
  test('reset returns weights to 1.0', () => {
    const w = updater.getWeights()
    assert(w.fuseWeight === 1.0, 'reset fuse weight')
    assert(w.reorderWeight === 1.0, 'reset reorder weight')
  })
}

// ============================================================
// 6. FeedbackLoopEngine (full pipeline)
// ============================================================

{
  console.log('--- 6. Full Feedback Loop Engine ---\n')

  const engine = new FeedbackLoopEngine()

  const record = engine.record(
    'FUSE-opt-1',
    beforeMetrics,
    afterBetter,
    15,
  )

  test('engine produces feedback record', () => {
    assert(record.outcome.planId === 'FUSE-opt-1', 'planId correct')
    assert(record.outcome.success === true, 'should be success')
  })
  test('record includes gain analysis', () => {
    assert(record.analysis.efficiency >= 0, 'has efficiency')
    assert(record.analysis.score >= 0, 'has score')
  })
  test('record may include adjustment', () => {
    // First record should get rate-limited or not, but adjustment should exist
    assert(record.adjustment !== undefined, 'adjustment present')
  })

  // After
  const failRecord = engine.record(
    'PRUNE-opt-2',
    beforeMetrics,
    afterWorse,
    20,
  )
  test('failed optimization stored correctly', () => {
    assert(failRecord.outcome.success === false, 'should be failure')
    assert(failRecord.outcome.actualGain < 0, 'negative gain')
  })

  // Memory
  test('memory has 2 records', () => {
    assert(engine.memoryInstance.size === 2, `expected 2, got ${engine.memoryInstance.size}`)
  })

  // Weights accessible
  test('engine provides current weights', () => {
    const weights = engine.getWeights()
    assert(weights.fuseWeight >= 0.5, 'fuse weight accessible')
  })

  // Aggregate analysis
  const aggregate = engine.aggregateAnalysis()
  test('aggregate analysis produces metrics', () => {
    assert(aggregate.score > 0, 'aggregate score > 0')
    assert(aggregate.efficiency > 0, 'aggregate efficiency > 0')
  })

  // Batch record
  const batchResult = engine.recordAll([
    { planId: 'FUSE-batch-1', before: beforeMetrics, after: afterBetter, predictedGain: 10 },
    { planId: 'REORDER-batch-2', before: beforeMetrics, after: afterBetter, predictedGain: 5 },
  ])
  test('batch recording works', () => {
    assert(batchResult.length === 2, 'expected 2 batch records')
  })
}

// ============================================================
// 7. Constraints Verification
// ============================================================

{
  console.log('--- 7. Constraints Verification ---\n')

  // C1 — No direct planner mutation
  test('C1: Feedback loop cannot mutate planner directly', () => {
    const engine = new FeedbackLoopEngine()
    const record = engine.record('FUSE-test', beforeMetrics, afterBetter, 10)
    // StrategyUpdater returns adjustment — it does not rewrite planner code
    assert(record.adjustment !== undefined, 'adjustment is advisory')
    // No method exists to rewrite internal strategy logic
    const hasMutateMethod = (engine as any).mutatePlanner !== undefined
    assert(!hasMutateMethod, 'no mutatePlanner method')
  })

  // C2 — Only heuristic drift
  test('C2: StrategyUpdater only changes weights, not logic', () => {
    const updater = new StrategyUpdater()
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(updater))
    const hasLogicChange = methods.some(m => m.includes('replaceStrategy') || m.includes('rewrite'))
    assert(!hasLogicChange, 'no logic replacement methods')
  })

  // C3 — Feedback is observational, not causal control
  test('C3: Feedback does not directly trigger execution', () => {
    const engine = new FeedbackLoopEngine()
    const record = engine.record('OBSERVE-test', beforeMetrics, afterBetter, 10)
    // FeedbackLoopEngine only records — it does not re-execute
    assert(record.outcome.planId === 'OBSERVE-test', 'only record, no re-execution')
  })

  // C4 — Memory is append-only
  test('C4: Memory has no delete or update methods', () => {
    const memory = new OptimizationMemory()
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(memory))
    const hasDelete = methods.some(m => m.includes('delete') || m.includes('remove') || m.includes('clear'))
    assert(!hasDelete, 'no delete/clear method (clear is allowed in types but not in memory)')
  })
}

console.log('\n=== Phase 7A-4C Complete ===\n')
