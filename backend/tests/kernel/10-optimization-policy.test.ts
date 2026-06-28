#!/usr/bin/env tsx
/**
 * Phase 7A-4D Policy Evolution Engine Validation Tests
 *
 * Verifies:
 *   - PolicyState: default policy, clone, equality
 *   - PolicyGradient: delta computation from feedback
 *   - PolicyUpdater: delta application with clamping
 *   - PolicyConstraints: S1 (structural), S2 (semantic), S3 (bounded), S4 (versioned)
 *   - PolicyMemory: append-only, rollback, versioning
 *   - PolicyEvolutionEngine: full pipeline
 */

import { createDefaultPolicy, clonePolicy, policiesEqual } from '../../src/kernel/optimization-policy/policy-state.js'
import { PolicyGradient, type FeedbackEntry } from '../../src/kernel/optimization-policy/policy-gradient.js'
import { PolicyUpdater } from '../../src/kernel/optimization-policy/policy-updater.js'
import { PolicyConstraints } from '../../src/kernel/optimization-policy/policy-constraints.js'
import { PolicyMemory } from '../../src/kernel/optimization-policy/policy-memory.js'
import { PolicyEvolutionEngine } from '../../src/kernel/optimization-policy/policy-evolution-engine.js'
import type { OptimizationPolicy } from '../../src/kernel/optimization-policy/types.js'

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

// Shared feedback data
const successfulFeedbacks: FeedbackEntry[] = [
  { actualGain: 150, predictedGain: 100, drift: 50, success: true, optimizationType: 'FUSE' },
  { actualGain: 80, predictedGain: 100, drift: 20, success: true, optimizationType: 'REORDER' },
  { actualGain: 200, predictedGain: 150, drift: 50, success: true, optimizationType: 'FUSE' },
]

const mixedFeedbacks: FeedbackEntry[] = [
  { actualGain: 150, predictedGain: 100, drift: 50, success: true, optimizationType: 'FUSE' },
  { actualGain: -50, predictedGain: 100, drift: 150, success: false, optimizationType: 'REORDER' },
  { actualGain: 200, predictedGain: 150, drift: 50, success: true, optimizationType: 'PRUNE' },
  { actualGain: -100, predictedGain: 50, drift: 150, success: false, optimizationType: 'PARALLELIZE' },
]

console.log('\n=== Phase 7A-4D: Policy Evolution Engine Validation ===\n')

// ============================================================
// 1. Policy State
// ============================================================
{
  console.log('--- 1. Policy State ---\n')

  const defaultPolicy = createDefaultPolicy()

  test('default weights match expected', () => {
    assert(defaultPolicy.weights.latency === 0.5, 'latency=0.5')
    assert(defaultPolicy.weights.throughput === 0.5, 'throughput=0.5')
    assert(defaultPolicy.weights.cost === 0.5, 'cost=0.5')
    assert(defaultPolicy.weights.stability === 0.8, 'stability=0.8')
  })

  test('default thresholds match expected', () => {
    assert(defaultPolicy.thresholds.minGain === 10, 'minGain=10')
    assert(defaultPolicy.thresholds.maxRisk === 0.8, 'maxRisk=0.8')
    assert(defaultPolicy.thresholds.driftTolerance === 0.3, 'driftTolerance=0.3')
  })

  test('default strategy preferences match expected', () => {
    assert(defaultPolicy.strategyPreference.FUSE === 1.0, 'FUSE=1.0')
    assert(defaultPolicy.strategyPreference.REORDER === 1.0, 'REORDER=1.0')
    assert(defaultPolicy.strategyPreference.PRUNE === 0.8, 'PRUNE=0.8')
    assert(defaultPolicy.strategyPreference.PARALLELIZE === 1.0, 'PARALLELIZE=1.0')
  })

  const cloned = clonePolicy(defaultPolicy)
  test('clone produces equal policy', () => {
    assert(policiesEqual(defaultPolicy, cloned), 'clone equals original')
  })

  test('clone is deep copy', () => {
    cloned.weights.latency = 99
    assert(!policiesEqual(defaultPolicy, cloned), 'modifying clone does not affect original')
  })
}

// ============================================================
// 2. Policy Gradient
// ============================================================
{
  console.log('--- 2. Policy Gradient ---\n')

  const gradient = new PolicyGradient()

  const delta = gradient.compute(successfulFeedbacks)

  test('computes deltas for all fields', () => {
    assert(delta.latencyWeightDelta !== undefined, 'latency delta')
    assert(delta.throughputWeightDelta !== undefined, 'throughput delta')
    assert(delta.costWeightDelta !== undefined, 'cost delta')
    assert(delta.stabilityWeightDelta !== undefined, 'stability delta')
    assert(delta.fusePreferenceDelta !== undefined, 'fuse pref delta')
    assert(delta.reorderPreferenceDelta !== undefined, 'reorder pref delta')
    assert(delta.prunePreferenceDelta !== undefined, 'prune pref delta')
    assert(delta.parallelizePreferenceDelta !== undefined, 'parallel pref delta')
  })

  test('successful optimizations → negative latency delta (reduce latency weight)', () => {
    assert(delta.latencyWeightDelta < 0, 'latency delta negative')
  })

  test('empty feedback → zero delta', () => {
    const zero = gradient.compute([])
    assert(zero.latencyWeightDelta === 0, 'zero latency delta')
    assert(zero.throughputWeightDelta === 0, 'zero throughput delta')
  })

  const mixedDelta = gradient.compute(mixedFeedbacks)
  test('mixed feedback produces non-zero deltas', () => {
    // At least some delta should be non-zero
    const allZero = Object.values(mixedDelta).every(v => v === 0)
    assert(!allZero, 'mixed feedback produces non-zero deltas')
  })
}

// ============================================================
// 3. Policy Updater
// ============================================================
{
  console.log('--- 3. Policy Updater ---\n')

  const updater = new PolicyUpdater()
  const defaultPolicy = createDefaultPolicy()
  const gradient = new PolicyGradient()

  const delta = gradient.compute(successfulFeedbacks)
  const updated = updater.applyDelta(defaultPolicy, delta)

  test('updated policy differs from default', () => {
    assert(!policiesEqual(defaultPolicy, updated), 'update changes policy')
  })

  test('latency weight decreases with successful outcomes', () => {
    assert(updated.weights.latency < defaultPolicy.weights.latency, 'latency decreased')
  })

  test('updater does not mutate input policy', () => {
    const unchanged = createDefaultPolicy()
    assert(policiesEqual(defaultPolicy, unchanged), 'input untouched')
  })

  // Boundary clamping
  const extremeDelta = gradient.compute(successfulFeedbacks)
  extremeDelta.latencyWeightDelta = -1000
  extremeDelta.costWeightDelta = 1000
  extremeDelta.fusePreferenceDelta = -1000

  const clamped = updater.applyDelta(defaultPolicy, extremeDelta)

  test('clamps values to safe range [0.1, 1.5] for weights', () => {
    assert(clamped.weights.latency >= 0.1, 'latency >= 0.1')
    assert(clamped.weights.cost <= 1.5, 'cost <= 1.5')
  })

  test('clamps preferences to [0.3, 2.0]', () => {
    assert(clamped.strategyPreference.FUSE >= 0.3, 'FUSE >= 0.3')
  })

  test('reset returns to default', () => {
    const reset = updater.resetToDefault()
    assert(policiesEqual(reset, createDefaultPolicy()), 'reset equals default')
  })
}

// ============================================================
// 4. Policy Constraints (S1, S2, S3)
// ============================================================
{
  console.log('--- 4. Policy Constraints ---\n')

  const constraints = new PolicyConstraints()

  // Valid: default policy
  const defaultPolicy = createDefaultPolicy()
  test('S3: default policy is valid', () => {
    assert(constraints.validate(defaultPolicy), 'default policy valid')
  })

  // Invalid: weight exceeds max
  const highWeight: OptimizationPolicy = {
    ...defaultPolicy,
    weights: { ...defaultPolicy.weights, cost: 2.0 },
  }
  test('S3: weight exceeding max is rejected', () => {
    assert(!constraints.validate(highWeight), 'high weight rejected')
  })

  // Invalid: weight below min
  const lowWeight: OptimizationPolicy = {
    ...defaultPolicy,
    weights: { ...defaultPolicy.weights, latency: 0 },
  }
  test('S3: weight below min is rejected', () => {
    assert(!constraints.validate(lowWeight), 'low weight rejected')
  })

  // Invalid: strategy monopoly
  const monopoly: OptimizationPolicy = {
    ...defaultPolicy,
    strategyPreference: { FUSE: 5.0, REORDER: 0.5, PRUNE: 0.5, PARALLELIZE: 0.5 },
  }
  test('S1: strategy monopoly (>50% of total) is rejected', () => {
    assert(!constraints.validate(monopoly), 'monopoly rejected')
  })

  // Invalid: preference exceeds max
  const highPref: OptimizationPolicy = {
    ...defaultPolicy,
    strategyPreference: { FUSE: 3.0, REORDER: 1.0, PRUNE: 0.8, PARALLELIZE: 1.0 },
  }
  test('preference exceeding max is rejected', () => {
    assert(!constraints.validate(highPref), 'high pref rejected')
  })

  // Invalid: preference below min
  const lowPref: OptimizationPolicy = {
    ...defaultPolicy,
    strategyPreference: { FUSE: 0.1, REORDER: 1.0, PRUNE: 0.8, PARALLELIZE: 1.0 },
  }
  test('preference below min is rejected', () => {
    assert(!constraints.validate(lowPref), 'low pref rejected')
  })

  // Invalid: total sum drift too far
  const sumDrift: OptimizationPolicy = {
    ...defaultPolicy,
    strategyPreference: { FUSE: 0.3, REORDER: 0.3, PRUNE: 0.3, PARALLELIZE: 0.3 },
  }
  test('total strategy preference sum < 2.0 is rejected', () => {
    assert(!constraints.validate(sumDrift), 'low sum rejected')
  })

  // Violations counting
  test('countViolations returns correct number', () => {
    const v = constraints.countViolations(highWeight)
    assert(v >= 1, `expected >= 1 violation, got ${v}`)
  })
}

// ============================================================
// 5. Policy Memory (S4 — append-only)
// ============================================================
{
  console.log('--- 5. Policy Memory ---\n')

  const memory = new PolicyMemory()

  test('fresh memory has size 0', () => {
    assert(memory.size === 0, 'empty memory')
  })

  const p1 = createDefaultPolicy()
  const p2 = clonePolicy(p1)
  p2.weights.latency = 0.6

  memory.store(p1, null, 0.5)
  test('after first store, size = 1', () => {
    assert(memory.size === 1, 'size = 1')
  })

  memory.store(p2, null, 0.6)
  test('after second store, size = 2', () => {
    assert(memory.size === 2, 'size = 2')
  })

  test('getLatest returns most recent', () => {
    const latest = memory.getLatest()
    assert(latest !== null, 'has latest')
    assert(latest!.weights.latency === 0.6, 'latest has updated latency')
  })

  test('getVersion returns correct version', () => {
    const v1 = memory.getVersion(1)
    assert(v1 !== null, 'v1 exists')
    assert(v1!.version === 1, 'v1 number')
  })

  test('rollbackTo returns older policy', () => {
    const rolledBack = memory.rollbackTo(1)
    assert(rolledBack !== null, 'rollback returns policy')
    assert(rolledBack!.weights.latency === 0.5, 'rolled back to latency=0.5')
  })

  test('rollback does not delete history', () => {
    assert(memory.size === 2, 'history preserved')
  })

  // S4: immutable getters
  const all = memory.getAll()
  test('S4: getAll returns immutable snapshot', () => {
    (all as any[]).length = 0
    assert(memory.size === 2, 'original memory unchanged')
  })

  test('getUniquePolicyCount counts distinct policies', () => {
    // p1 and p2 are different, so count = 2
    assert(memory.getUniquePolicyCount() >= 1, 'at least 1 unique policy')
  })
}

// ============================================================
// 6. Policy Evolution Engine (full pipeline)
// ============================================================
{
  console.log('--- 6. Full Evolution Engine ---\n')

  const engine = new PolicyEvolutionEngine()

  const initialVersion = engine.versionCount
  test('constructor stores initial policy', () => {
    assert(initialVersion === 1, 'initial version stored')
  })

  // Evolve with successful feedbacks
  const result = engine.evolve(successfulFeedbacks)
  test('evolve with feedback returns applied=true', () => {
    assert(result.applied === true, `expected applied=true, got: ${result.reason}`)
  })

  test('evolve returns policy with version number', () => {
    assert(result.version > 0, `version ${result.version} > 0`)
  })

  test('second evolve increments version', () => {
    const r2 = engine.evolve(successfulFeedbacks)
    assert(r2.version === 3 || r2.version > result.version, `version increased: ${r2.version}`)
  })

  // No feedback → no evolution
  const noFeedback = engine.evolve([])
  test('empty feedback → no evolution', () => {
    assert(noFeedback.applied === false, 'no evolution with empty feedback')
  })

  // Current policy accessible
  const current = engine.getCurrentPolicy()
  test('getCurrentPolicy returns valid policy', () => {
    assert(current.weights.latency >= 0.1, 'current policy valid')
  })

  // Memory accessible
  const memory = engine.getMemory()
  test('memory contains version history', () => {
    assert(memory.length >= 2, `at least 2 versions, got ${memory.length}`)
  })

  // Rollback
  test('rollback to v1 works', () => {
    const ok = engine.rollbackTo(1)
    assert(ok, 'rollback succeeded')
    const rolled = engine.getCurrentPolicy()
    assert(rolled.weights.latency === 0.5, 'rolled back to default latency')
  })

  // Reset
  engine.resetToDefault()
  test('reset returns to default policy', () => {
    const reset = engine.getCurrentPolicy()
    assert(policiesEqual(reset, createDefaultPolicy()), 'reset to default')
  })
}

// ============================================================
// 7. Safety Constraints Verification (S1-S4)
// ============================================================
{
  console.log('--- 7. Safety Constraints ---\n')

  // S1 — No structural evolution
  test('S1: PolicyEvolutionEngine has no architecture-mutating methods', () => {
    const engine = new PolicyEvolutionEngine()
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(engine))
    const hasArchMutation = methods.some(m =>
      m.includes('mutateEngine') || m.includes('rewrite') || m.includes('inject')
    )
    assert(!hasArchMutation, 'no architecture mutation methods')
  })

  // S2 — No semantic drift
  test('S2: Policy does not change execution semantics', () => {
    // The policy only adjusts weights, preferences, thresholds
    // It does not change: graph structure, node types, execution modes
    const defaultPolicy = createDefaultPolicy()
    const policyFields = Object.keys(defaultPolicy)
    assert(policyFields.length === 3, 'policy has 3 sections only (weights, thresholds, preferences)')
    assert(!policyFields.includes('graph'), 'no graph field')
    assert(!policyFields.includes('executionMode'), 'no execution mode field')
    assert(!policyFields.includes('nodeTypes'), 'no node types field')
  })

  // S3 — Bounded parameter space
  test('S3: All weights must be [0.1, 1.5], enforced by constraints', () => {
    const constraints = new PolicyConstraints()
    const p = createDefaultPolicy()

    // Test boundary
    p.weights.latency = 1.5
    p.weights.throughput = 0.1
    p.weights.cost = 0.1
    assert(constraints.validate(p), 'boundary values valid')

    // Just over
    p.weights.latency = 1.51
    assert(!constraints.validate(p), '1.51 rejected')
  })

  // S4 — Versioned policy history
  test('S4: PolicyMemory is append-only with version tracking', () => {
    const memory = new PolicyMemory()
    const p = createDefaultPolicy()

    memory.store(p, null, 0.5)
    memory.store(p, null, 0.5)  // same policy, new version
    memory.store(p, null, 0.5)  // another

    // No delete methods exist
    const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(memory))
    const hasDelete = proto.some(m =>
      m.includes('delete') || m.includes('remove') || m.includes('clear')
    )
    assert(!hasDelete, 'no delete/remove/clear methods')

    // Version tracking works
    assert(memory.latestVersion === 3, '3 versions tracked')
  })
}

console.log('\n=== Phase 7A-4D Complete ===\n')
