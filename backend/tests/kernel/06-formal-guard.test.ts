#!/usr/bin/env tsx
/**
 * Phase 7A-3 Formal Guard Validation Tests
 *
 * Verifies:
 *   - DeterminismSpec + simpleHash
 *   - MutationInvariants (I1-I4)
 *   - GraphEquivalence
 *   - MutationProofEngine
 *   - ReplayVerifier
 *   - FormalGuard (full pipeline)
 */

import { simpleHash, INVARIANTS } from '../../src/kernel/mutation-formal/determinism-spec.js'
import type { DeterminismSpec } from '../../src/kernel/mutation-formal/determinism-spec.js'
import { MutationInvariants } from '../../src/kernel/mutation-formal/mutation-invariant.js'
import { GraphEquivalence } from '../../src/kernel/mutation-formal/graph-equivalence.js'
import { MutationProofEngine } from '../../src/kernel/mutation-formal/mutation-proof-engine.js'
import { ReplayVerifier } from '../../src/kernel/mutation-formal/replay-verifier.js'
import { FormalGuard } from '../../src/kernel/mutation-formal/formal-guard.js'
import type { ExecutionGraph } from '../../src/kernel/execution-graph.js'
import type { GraphMutationEvent } from '../../src/kernel/mutation-engine/mutation-context.js'

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

const baseGraph: ExecutionGraph = {
  id: 'g1', version: 1,
  nodes: [
    { id: 'n1', capability: 'llm' },
    { id: 'n2', capability: 'tts', dependencies: ['n1'] },
    { id: 'n3', capability: 'video', dependencies: ['n2'] },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2' },
    { id: 'e2', from: 'n2', to: 'n3' },
  ],
  entry: 'n1',
  context: { prompt: 'test' },
}

const baseEvent: GraphMutationEvent = {
  executionId: 'ex-1', graphId: 'g1', graphVersion: 1,
  trigger: 'COST_SPIKE', target: { scope: 'NODE', id: 'n2' },
  action: 'REPLACE', strategy: 'FORKED',
  payload: { capability: 'image' },
  confidence: 0.85, timestamp: Date.now(),
}

console.log('\n=== Phase 7A-3: Formal Guard Validation ===\n')

// ============================================================
// 1. simpleHash + DeterminsimSpec
// ============================================================

{
  console.log('--- 1. Determinism Spec ---\n')

  const h1 = simpleHash({ a: 1, b: 2 })
  const h2 = simpleHash({ b: 2, a: 1 })  // same content, different key order
  test('simpleHash is order-independent', () => {
    assert(h1 === h2, `expected ${h1} === ${h2}`)
  })

  const h3 = simpleHash({ a: 1, b: 3 })
  test('simpleHash changes with content', () => {
    assert(h1 !== h3, 'hashes should differ')
  })

  const spec: DeterminismSpec = {
    inputGraphHash: simpleHash(baseGraph),
    mutationEventHash: simpleHash(baseEvent),
    expectedOutputHash: 'abcdef01',
    constraints: {
      orderPreservation: true,
      sideEffectFreeNodes: ['n1'],
      deterministicNodes: ['n1', 'n2', 'n3'],
    },
  }
  test('DeterminismSpec is constructable', () => {
    assert(spec.inputGraphHash.length === 8, `expected 8-char hash, got ${spec.inputGraphHash}`)
    assert(spec.constraints.deterministicNodes.length === 3, 'expected 3 nodes')
  })
}

// ============================================================
// 2. MutationInvariants
// ============================================================

{
  console.log('--- 2. Mutation Invariants ---\n')

  const inv = new MutationInvariants()

  // I1: Acyclic graph
  test('I1: valid DAG passes', () => {
    assert(inv.checkStructural(baseGraph), 'base graph should be acyclic')
  })

  // I1: Cyclic graph
  const cyclicGraph: ExecutionGraph = {
    ...baseGraph, version: 2,
    nodes: [
      { id: 'a', capability: 'llm' },
      { id: 'b', capability: 'tts', dependencies: ['a'] },
      { id: 'c', capability: 'video', dependencies: ['b'] },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'b', to: 'c' },
      { id: 'e3', from: 'c', to: 'a' },  // cycle
    ],
  }
  test('I1: cyclic graph fails', () => {
    assert(!inv.checkStructural(cyclicGraph), 'cyclic graph should fail')
  })

  // I2: Cursor validity
  test('I2: valid cursor passes', () => {
    assert(inv.checkContinuity(baseGraph, 'n2'), 'n2 should exist')
  })
  test('I2: invalid cursor fails', () => {
    assert(!inv.checkContinuity(baseGraph, 'nonexistent'), 'nonexistent cursor should fail')
  })

  // I3: Replay consistency
  test('I3: REPLACE preserves node count', () => {
    const replaced = { ...baseGraph, version: 2, nodes: [...baseGraph.nodes] }
    replaced.nodes[1] = { ...replaced.nodes[1], capability: 'image' }
    assert(inv.checkReplayConsistency(baseGraph, replaced, { ...baseEvent, action: 'REPLACE' }), 'replace preserves replay')
  })

  test('I3: REMOVE reduces nodes', () => {
    const removed = {
      ...baseGraph, version: 2,
      nodes: baseGraph.nodes.filter(n => n.id !== 'n2'),
      edges: (baseGraph.edges || []).filter(e => e.from !== 'n2' && e.to !== 'n2'),
    }
    assert(inv.checkReplayConsistency(baseGraph, removed, { ...baseEvent, action: 'REMOVE', target: { scope: 'NODE', id: 'n2' } }), 'remove should be consistent')
  })

  // I4: Semantic stability
  test('I4: entry preserved passes', () => {
    const mutated = { ...baseGraph, version: 2 }
    assert(inv.checkSemanticStability(baseGraph, mutated, { ...baseEvent, trigger: 'COST_SPIKE' }), 'entry should be preserved')
  })
  test('I4: POLICY_OVERRIDE bypasses check', () => {
    const mutated = { ...baseGraph, version: 2, entry: 'n2' }
    assert(inv.checkSemanticStability(baseGraph, mutated, { ...baseEvent, trigger: 'POLICY_OVERRIDE' }), 'override should bypass')
  })
  test('I4: different entry fails', () => {
    const mutated = { ...baseGraph, version: 2, entry: 'n2' }
    assert(!inv.checkSemanticStability(baseGraph, mutated, { ...baseEvent }), 'changed entry should fail')
  })

  // Full invariant check
  test('checkAll on valid mutation passes', () => {
    const result = inv.checkAll(baseGraph, { ...baseGraph, version: 2 }, baseEvent, 'n2')
    assert(result.passed, `expected pass, got: ${result.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`)
  })
}

// ============================================================
// 3. GraphEquivalence
// ============================================================

{
  console.log('--- 3. Graph Equivalence ---\n')

  const eq = new GraphEquivalence()

  test('identical graphs are equivalent', () => {
    assert(eq.isEquivalent(baseGraph, baseGraph), 'identical should be equivalent')
  })

  const similarGraph: ExecutionGraph = {
    ...baseGraph, id: 'g2', version: 2,
    nodes: [
      { id: 'n1', capability: 'llm' },
      { id: 'n2', capability: 'tts', dependencies: ['n1'] },
      { id: 'n3', capability: 'video', dependencies: ['n2'] },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2' },
      { id: 'e2', from: 'n2', to: 'n3' },
    ],
    entry: 'n1',
    context: { prompt: 'test' },
  }
  test('structurally identical graphs are topologically equivalent', () => {
    assert(eq.compareTopology(baseGraph, similarGraph), 'same topology')
  })

  const diffGraph: ExecutionGraph = {
    id: 'g3', version: 1,
    nodes: [
      { id: 'x1', capability: 'image' },
      { id: 'x2', capability: 'merge', dependencies: ['x1'] },
    ],
    edges: [{ id: 'ex1', from: 'x1', to: 'x2' }],
    entry: 'x1',
    context: {},
  }
  test('different graphs are not equivalent', () => {
    assert(!eq.isEquivalent(baseGraph, diffGraph), 'different graphs should not be equivalent')
  })

  const check = eq.check(baseGraph, similarGraph)
  test('check returns high similarity for similar graphs', () => {
    assert(check.similarity >= 0.8, `expected >= 0.8, got ${check.similarity}`)
  })

  const hashEq = eq.hashEquivalence(baseGraph, similarGraph)
  test('hashEquivalence works', () => {
    assert(hashEq === false, 'hash should differ (different id/version)')
  })
}

// ============================================================
// 4. MutationProofEngine
// ============================================================

{
  console.log('--- 4. Mutation Proof Engine ---\n')

  const pe = new MutationProofEngine()

  const mutated = {
    ...baseGraph, version: 2,
    nodes: baseGraph.nodes.map(n => n.id === 'n2' ? { ...n, capability: 'image' } : n),
  }

  const { proof, guard } = pe.verify(baseGraph, mutated, baseEvent, 'n2')

  test('proof for valid mutation is valid', () => {
    assert(proof.valid, `expected valid proof, got: ${!proof.proof.invariantCheck.passed ? 'invariant fail' : 'unknown'}`)
  })
  test('guard for valid mutation passes', () => {
    assert(guard.ok, `expected ok, got: ${guard.reason}`)
  })
  test('proof contains invariant check', () => {
    assert(proof.proof.invariantCheck.checks.length >= 4, `expected >=4 invariant checks, got ${proof.proof.invariantCheck.checks.length}`)
  })
  test('proof contains structural check', () => {
    assert(proof.proof.structuralCheck.checks.length >= 3, `expected >=3 structural checks, got ${proof.proof.structuralCheck.checks.length}`)
  })

  // Build spec
  const spec = pe.buildSpec(baseGraph, mutated, baseEvent)
  test('buildSpec produces valid spec', () => {
    assert(spec.inputGraphHash.length === 8, `expected 8-char hash`)
    assert(spec.constraints.deterministicNodes.length >= 2, 'expected >=2 deterministic nodes')
  })
}

// ============================================================
// 5. ReplayVerifier
// ============================================================

{
  console.log('--- 5. Replay Verifier ---\n')

  const rv = new ReplayVerifier()

  const mutated = {
    ...baseGraph, version: 2,
    nodes: baseGraph.nodes.map(n => n.id === 'n2' ? { ...n, capability: 'image' } : n),
  }
  const result = rv.verify(baseGraph, mutated, baseEvent)

  test('valid mutation passes replay verification', () => {
    assert(result.consistent, `expected consistent, got: ${result.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`)
  })
  test('replay safety score is 1.0 for valid', () => {
    assert(result.safetyScore === 1.0, `expected 1.0, got ${result.safetyScore}`)
  })

  // Broken dependency
  const brokenGraph: ExecutionGraph = {
    ...baseGraph, version: 2,
    nodes: [{ id: 'n1', capability: 'llm' }],  // missing n2, n3
    edges: [],
    entry: 'n1',
    context: {},
  }
  const brokenResult = rv.verify(baseGraph, brokenGraph, { ...baseEvent, action: 'REMOVE', target: { scope: 'NODE', id: 'n2' } })
  test('REMOVE without node count check passes (intentional)', () => {
    // REMOVE intentionally drops a node, but dependencies in edges reference removed node
    assert(!brokenResult.consistent || brokenResult.safetyScore < 1.0, 'broken graph should have lower safety')
  })

  // FORKED graph references only its own nodes
  const forkedResult = rv.verify(baseGraph, mutated, { ...baseEvent, strategy: 'FORKED' })
  test('FORKED graph with all nodes is replayable', () => {
    assert(forkedResult.consistent, 'forked should be self-contained')
  })
}

// ============================================================
// 6. FormalGuard (full pipeline)
// ============================================================

{
  console.log('--- 6. Formal Guard ---\n')

  const guard = new FormalGuard()

  // Valid mutation
  const mutated = {
    ...baseGraph, version: 2,
    nodes: baseGraph.nodes.map(n => n.id === 'n2' ? { ...n, capability: 'image' } : n),
  }
  const validResult = guard.validate(baseGraph, mutated, baseEvent, 'n2')
  test('formal guard passes valid mutation', () => {
    assert(validResult.ok, `expected ok, got: ${validResult.reason}`)
  })

  // Cyclic (broken) mutation — inject a cycle
  const cyclicMutated: ExecutionGraph = {
    ...baseGraph, id: 'g2', version: 2,
    nodes: [
      ...baseGraph.nodes,
    ],
    edges: [
      ...(baseGraph.edges || []),
      { id: 'e3', from: 'n3', to: 'n1' },  // back-edge = cycle
    ],
    entry: 'n1',
    context: {},
  }
  const cyclicResult = guard.validate(baseGraph, cyclicMutated, {
    ...baseEvent,
    action: 'REWRITE',
    payload: { capability: 'image' },
  }, 'n2')
  test('formal guard rejects cyclic mutation', () => {
    assert(!cyclicResult.ok, 'cyclic mutation should be rejected')
  })

  // DEFERRED always passes
  const deferredResult = guard.validate(baseGraph, baseGraph, {
    ...baseEvent,
    strategy: 'DEFERRED',
  })
  test('DEFERRED always passes formal guard', () => {
    assert(deferredResult.ok, 'DEFERRED should always pass')
  })

  // Quick check
  const quickPass = guard.quickCheck(baseGraph, baseEvent, 'n1')
  test('quick check passes for valid graph', () => {
    assert(quickPass.ok, 'quick check should pass')
  })

  const quickFail = guard.quickCheck(cyclicMutated, baseEvent, 'n1')
  test('quick check fails for cyclic graph', () => {
    assert(!quickFail.ok, 'quick check should reject cyclic')
  })
}

// ============================================================
// 7. Edge Cases
// ============================================================

{
  console.log('--- 7. Edge Cases ---\n')

  const inv = new MutationInvariants()
  const eq = new GraphEquivalence()

  // Empty graph edge cases
  const emptyGraph: ExecutionGraph = {
    id: 'empty', version: 1,
    nodes: [],
    edges: [],
    entry: '',
    context: {},
  }
  test('empty graph fails I1 structural check', () => {
    assert(!inv.checkStructural(emptyGraph), 'empty graph should fail structural')
  })

  const singleNodeGraph: ExecutionGraph = {
    id: 'single', version: 1,
    nodes: [{ id: 'n1', capability: 'llm' }],
    edges: [],
    entry: 'n1',
    context: {},
  }
  test('single-node DAG passes I1', () => {
    assert(inv.checkStructural(singleNodeGraph), 'single node DAG should pass')
  })

  test('disconnected graphs are not equivalent', () => {
    const g1: ExecutionGraph = { ...baseGraph }
    const g2: ExecutionGraph = {
      ...baseGraph, id: 'g2',
      nodes: [{ id: 'a', capability: 'image' }, { id: 'b', capability: 'tts' }],
      edges: [],
      entry: 'a',
      context: {},
    }
    assert(!eq.isEquivalent(g1, g2), 'disconnected graphs should not be equivalent')
  })
}

console.log('\n=== Phase 7A-3 Complete ===\n')
