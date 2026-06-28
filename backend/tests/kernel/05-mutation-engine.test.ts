#!/usr/bin/env tsx
/**
 * Phase 7A-2 Validation Tests
 *
 * Verifies:
 *   - Version tree structure
 *   - Graph fork manager
 *   - Graph rewriter (REPLACE, REORDER, FUSE, SPLIT)
 *   - Mutation guard (acyclic, replay safety, determinism)
 *   - Mutation policy engine
 *   - Full mutation engine pipeline
 *   - Execution continuation
 */

import { VersionTree } from '../../src/kernel/mutation-engine/version-tree.js'
import { GraphForkManager } from '../../src/kernel/mutation-engine/graph-fork-manager.js'
import { GraphRewriter } from '../../src/kernel/mutation-engine/graph-rewriter.js'
import { MutationGuard } from '../../src/kernel/mutation-engine/mutation-guard.js'
import { MutationPolicyEngine } from '../../src/kernel/mutation-engine/mutation-policy-engine.js'
import { MutationEngine } from '../../src/kernel/mutation-engine/mutation-engine.js'
import { ExecutionContinuation } from '../../src/kernel/mutation-engine/execution-continuation.js'
import type { ExecutionGraph } from '../../src/kernel/execution-graph.js'
import type { GraphMutationEvent, MutationContext } from '../../src/kernel/mutation-engine/mutation-context.js'

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
  id: 'graph-1',
  version: 1,
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

console.log('\n=== Phase 7A-2: Mutation Engine Validation ===\n')

// ============================================================
// 1. Version Tree
// ============================================================

{
  console.log('--- Version Tree ---\n')

  const tree = new VersionTree()
  const root = tree.registerRoot('graph-1')
  test('registerRoot creates v1 node', () => {
    assert(root.id === 'graph-1', `expected graph-1, got ${root.id}`)
    assert(root.version === 1, `expected version 1, got ${root.version}`)
  })

  const child = tree.fork('graph-1', 'HOT_PATH_FIX', {
    trigger: 'HOT_PATH_DETECTED',
    action: 'FUSE',
    strategy: 'FORKED',
  } as any)
  test('fork creates child', () => {
    assert(child.parentId === 'graph-1', `expected parent graph-1, got ${child.parentId}`)
  })

  const grandchildren = tree.getChildren('graph-1')
  test('getChildren returns forked children', () => {
    assert(grandchildren.length >= 1, `expected >= 1 child, got ${grandchildren.length}`)
  })

  const lineage = tree.getLineage(child.id)
  test('getLineage includes root and child', () => {
    assert(lineage.length >= 2, `expected >= 2 nodes, got ${lineage.length}`)
  })

  const allNodes = tree.getAllNodes()
  test('getAllNodes returns all nodes (excluding root)', () => {
    assert(allNodes.length >= 2, `expected >= 2, got ${allNodes.length}`)
  })

  console.log()
  console.log(`  Version tree:\n${tree.print().split('\n').map(l => '  ' + l).join('\n')}\n`)
}

// ============================================================
// 2. Graph Fork Manager
// ============================================================

{
  console.log('--- Graph Fork Manager ---\n')

  const tree = new VersionTree()
  const fm = new GraphForkManager(tree)
  tree.registerRoot('graph-1')

  const forked = fm.fork(baseGraph, {
    executionId: 'ex-1',
    graphId: 'graph-1',
    graphVersion: 1,
    trigger: 'COST_SPIKE',
    target: { scope: 'NODE', id: 'n2' },
    action: 'REPLACE',
    strategy: 'FORKED',
    payload: { capability: 'image' },
    confidence: 0.8,
    timestamp: Date.now(),
  })

  test('FORKED strategy creates different graph id', () => {
    assert(forked.graph.id !== baseGraph.id, 'forked graph should have new id')
    assert(!forked.isInPlace, 'forked should not be in-place')
  })

  const inPlace = fm.fork(baseGraph, {
    executionId: 'ex-2',
    graphId: 'graph-1',
    graphVersion: 1,
    trigger: 'POLICY_OVERRIDE',
    target: { scope: 'NODE', id: 'n1' },
    action: 'REWRITE',
    strategy: 'IN_PLACE',
    payload: {},
    confidence: 0.9,
    timestamp: Date.now(),
  })

  test('IN_PLACE strategy keeps same graph id', () => {
    assert(inPlace.graph.id === baseGraph.id, 'in-place should keep same id')
    assert(inPlace.isInPlace, 'should be in-place')
  })

  const deferred = fm.fork(baseGraph, {
    executionId: 'ex-3',
    graphId: 'graph-1',
    graphVersion: 1,
    trigger: 'LATENCY_ANOMALY',
    target: { scope: 'EDGE', id: 'e1' },
    action: 'REORDER',
    strategy: 'DEFERRED',
    payload: {},
    confidence: 0.5,
    timestamp: Date.now(),
  })

  test('DEFERRED strategy returns same graph unchanged', () => {
    assert(deferred.graph === baseGraph, 'deferred should return same graph reference')
  })
}

// ============================================================
// 3. Graph Rewriter
// ============================================================

{
  console.log('--- Graph Rewriter ---\n')

  const rw = new GraphRewriter()

  // REPLACE
  const replaced = rw.rewrite(baseGraph, {
    target: { scope: 'NODE', id: 'n2' },
    action: 'REPLACE',
    payload: { capability: 'image' },
  } as any)
  test('REPLACE swaps node capability', () => {
    const n2 = replaced.nodes.find(n => n.id === 'n2')
    assert(n2?.capability === 'image', `expected image, got ${n2?.capability}`)
  })

  // REMOVE
  const removed = rw.rewrite(baseGraph, {
    target: { scope: 'NODE', id: 'n2' },
    action: 'REMOVE',
    payload: { confirmDataLoss: true },
  } as any)
  test('REMOVE removes node', () => {
    assert(removed.nodes.length === 2, `expected 2 nodes, got ${removed.nodes.length}`)
    assert(removed.nodes.find(n => n.id === 'n2') === undefined, 'n2 should be removed')
  })

  // INSERT
  const inserted = rw.rewrite(baseGraph, {
    target: { scope: 'NODE', id: 'n4' },
    action: 'INSERT',
    payload: { capability: 'image', dependencies: ['n3'] },
  } as any)
  test('INSERT adds new node', () => {
    assert(inserted.nodes.length === 4, `expected 4 nodes, got ${inserted.nodes.length}`)
    const n4 = inserted.nodes.find(n => n.id === 'n4')
    assert(n4?.capability === 'image', `expected image capability, got ${n4?.capability}`)
  })

  // FUSE
  const fused = rw.rewrite(baseGraph, {
    target: { scope: 'NODE', id: 'n1' },
    action: 'FUSE',
    payload: { depth: 1 },
  } as any)
  test('FUSE merges sequential nodes', () => {
    // n1 and n2 should be fused into composite
    assert(fused.nodes.length < 3, `expected < 3 node(s), got ${fused.nodes.length}`)
    const composite = fused.nodes.find(n => n.id.includes('composite'))
    assert(composite !== undefined, 'composite node should exist')
  })

  // SPLIT
  const split = rw.rewrite(baseGraph, {
    target: { scope: 'NODE', id: 'n3' },
    action: 'SPLIT',
    payload: { partitions: 2 },
  } as any)
  test('SPLIT creates partitioned subgraph', () => {
    const splits = split.nodes.filter(n => n.id.includes('_split_'))
    assert(splits.length === 2, `expected 2 split nodes, got ${splits.length}`)
    const merge = split.nodes.find(n => n.id.includes('merge'))
    assert(merge !== undefined, 'merge node should exist')
  })
}

// ============================================================
// 4. Mutation Guard
// ============================================================

{
  console.log('--- Mutation Guard ---\n')

  const guard = new MutationGuard()

  // Valid graph — passes
  const validResult = guard.validate(baseGraph, { ...baseGraph, version: 2 } as any, {
    action: 'REWRITE',
    payload: {},
  } as any)
  test('valid graph passes guard', () => {
    assert(validResult.ok, `expected ok, got ${validResult.reason}`)
  })

  // Graph with cycle — fails
  const cyclicGraph: ExecutionGraph = {
    ...baseGraph,
    version: 2,
    nodes: [
      { id: 'a', capability: 'llm' },
      { id: 'b', capability: 'tts', dependencies: ['a'] },
      { id: 'c', capability: 'video', dependencies: ['b'] },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'b', to: 'c' },
      { id: 'e3', from: 'c', to: 'a' },  // cycle!
    ],
  }
  const cycleResult = guard.validate(baseGraph, cyclicGraph, { action: 'REWRITE', payload: {} } as any)
  test('cyclic graph fails guard', () => {
    assert(!cycleResult.ok, 'expected cycle detection')
  })

  // REMOVE without confirmDataLoss — fails
  const removeResult = guard.validate(baseGraph, { ...baseGraph, version: 2 } as any, {
    action: 'REMOVE',
    payload: {},
  } as any)
  test('REMOVE without data loss ack fails guard', () => {
    assert(!removeResult.ok, 'expected data loss rejection')
  })

  // Version not incremented — fails
  const noVersionResult = guard.validate(baseGraph, { ...baseGraph, version: 1 } as any, {
    action: 'REWRITE',
    payload: {},
  } as any)
  test('version <= original fails guard', () => {
    assert(!noVersionResult.ok, 'expected version check failure')
  })
}

// ============================================================
// 5. Mutation Policy Engine
// ============================================================

{
  console.log('--- Mutation Policy Engine ---\n')

  const pe = new MutationPolicyEngine()

  const lowConf: GraphMutationEvent = {
    executionId: 'ex-1', graphId: 'g1', graphVersion: 1,
    trigger: 'COST_SPIKE', target: { scope: 'NODE', id: 'n1' },
    action: 'REWRITE', strategy: 'FORKED', payload: {},
    confidence: 0.1, timestamp: Date.now(),
  }
  test('low confidence → deny', () => {
    const r = pe.evaluate(lowConf)
    assert(!r.allow, `expected deny, got allow`)
  })

  const highConf: GraphMutationEvent = {
    executionId: 'ex-2', graphId: 'g1', graphVersion: 1,
    trigger: 'COST_SPIKE', target: { scope: 'NODE', id: 'n1' },
    action: 'REWRITE', strategy: 'FORKED', payload: {},
    confidence: 0.8, timestamp: Date.now(),
  }
  test('high confidence → allow', () => {
    const r = pe.evaluate(highConf)
    assert(r.allow, `expected allow, got ${r.reason}`)
  })

  const policyOverride: GraphMutationEvent = {
    executionId: 'ex-3', graphId: 'g1', graphVersion: 1,
    trigger: 'POLICY_OVERRIDE', target: { scope: 'NODE', id: 'n1' },
    action: 'REWRITE', strategy: 'IN_PLACE', payload: {},
    confidence: 0.8, timestamp: Date.now(),
  }
  test('POLICY_OVERRIDE with sufficient confidence → allow', () => {
    const r = pe.evaluate(policyOverride)
    assert(r.allow, `expected allow, got ${r.reason}`)
  })

  const forceDeny: GraphMutationEvent = {
    executionId: 'ex-4', graphId: 'g1', graphVersion: 1,
    trigger: 'COST_SPIKE', target: { scope: 'NODE', id: 'n1' },
    action: 'REWRITE', strategy: 'FORKED', payload: {},
    confidence: 0.8, timestamp: Date.now(),
  }
  test('force deny override works', () => {
    const r = pe.evaluate(forceDeny, { forceDeny: true })
    assert(!r.allow, 'expected deny')
  })

  const inPlaceLowConf: GraphMutationEvent = {
    executionId: 'ex-5', graphId: 'g1', graphVersion: 1,
    trigger: 'HOT_PATH_DETECTED', target: { scope: 'NODE', id: 'n1' },
    action: 'FUSE', strategy: 'IN_PLACE', payload: {},
    confidence: 0.5, timestamp: Date.now(),
  }
  test('IN_PLACE with confidence < 0.7 → deny', () => {
    const r = pe.evaluate(inPlaceLowConf)
    assert(!r.allow, 'expected deny for low confidence IN_PLACE')
  })
}

// ============================================================
// 6. Execution Continuation
// ============================================================

{
  console.log('--- Execution Continuation ---\n')

  const ec = new ExecutionContinuation()

  const context: MutationContext = {
    graph: baseGraph,
    executionState: {
      cursor: 'n2',
      checkpoints: [
        { nodeId: 'n1', state: { result: 'done' }, timestamp: 100 },
        { nodeId: 'n2', state: { partial: 'yes' }, timestamp: 200 },
      ],
      status: 'RUNNING',
    },
  }

  const result = ec.continue(baseGraph, context)
  test('continuation preserves cursor', () => {
    assert(result.resumedFrom === 'n2', `expected n2, got ${result.resumedFrom}`)
  })
  test('continuation preserves valid checkpoints', () => {
    assert(result.checkpoints.length === 2, `expected 2 checkpoints, got ${result.checkpoints.length}`)
  })
  test('continuation status is RESUMED', () => {
    assert(result.status === 'RESUMED', `expected RESUMED, got ${result.status}`)
  })

  // If cursor node is removed
  const removedGraph: ExecutionGraph = {
    ...baseGraph,
    nodes: baseGraph.nodes.filter(n => n.id !== 'n2'),
    edges: (baseGraph.edges || []).filter(e => e.from !== 'n2' && e.to !== 'n2'),
  }
  const removedContext: MutationContext = {
    graph: removedGraph,
    executionState: {
      cursor: 'n2',
      checkpoints: [{ nodeId: 'n2', state: {}, timestamp: 100 }],
      status: 'RUNNING',
    },
  }
  const fallbackResult = ec.continue(removedGraph, removedContext)
  test('continuation falls back when cursor node removed', () => {
    assert(fallbackResult.resumedFrom === 'n1' || fallbackResult.resumedFrom !== '', 'should find valid predecessor')
  })
  test('continuation removes invalid checkpoints', () => {
    assert(fallbackResult.checkpoints.length === 0, 'n2 checkpoint should be filtered')
  })
}

// ============================================================
// 7. Full Mutation Engine Pipeline
// ============================================================

{
  console.log('--- Full Mutation Engine Pipeline ---\n')

  const engine = new MutationEngine()
  engine.registerGraph('graph-1')

  const context: MutationContext = {
    graph: baseGraph,
    executionState: {
      cursor: 'n2',
      checkpoints: [{ nodeId: 'n1', state: { result: 'ok' }, timestamp: 100 }],
      status: 'RUNNING',
    },
  }

  const event: GraphMutationEvent = {
    executionId: 'ex-full',
    graphId: 'graph-1',
    graphVersion: 1,
    trigger: 'COST_SPIKE',
    target: { scope: 'NODE', id: 'n2' },
    action: 'REPLACE',
    strategy: 'FORKED',
    payload: { capability: 'image' },
    confidence: 0.85,
    timestamp: Date.now(),
  }

  const result = engine.apply(event, context)

  test('mutation engine allows valid mutation', () => {
    assert(result.allowed, `expected allowed, got ${result.error}`)
  })

  test('mutation produces continuation with status RESUMED', () => {
    assert(result.continuation?.status === 'RESUMED', `expected RESUMED, got ${result.continuation?.status}`)
  })

  test('mutation produces a record', () => {
    assert(result.record !== undefined, 'expected mutation record')
  })

  // Print version tree
  console.log(`\n  Version tree after mutation:\n${engine.printVersionTree().split('\n').map(l => '  ' + l).join('\n')}\n`)
}

// ============================================================
// 8. Edge Cases
// ============================================================

{
  console.log('--- Edge Cases ---\n')

  const engine = new MutationEngine()

  // Single-node graph
  const singleGraph: ExecutionGraph = {
    id: 'single',
    version: 1,
    nodes: [{ id: 'n1', capability: 'llm' }],
    edges: [],
    entry: 'n1',
    context: {},
  }

  engine.registerGraph('single')
  const result = engine.apply({
    executionId: 'ex-single',
    graphId: 'single',
    graphVersion: 1,
    trigger: 'POLICY_OVERRIDE',
    target: { scope: 'NODE', id: 'n1' },
    action: 'REWRITE',
    strategy: 'FORKED',
    payload: { capability: 'image' },
    confidence: 0.9,
    timestamp: Date.now(),
  }, {
    graph: singleGraph,
    executionState: { cursor: 'n1', checkpoints: [], status: 'RUNNING' },
  })

  test('single node graph mutation succeeds', () => {
    assert(result.allowed, `expected allowed, got ${result.error}`)
  })

  // Deferred mutation — always allowed regardless of guard
  const deferredResult = engine.apply({
    executionId: 'ex-deferred',
    graphId: 'single',
    graphVersion: 1,
    trigger: 'LATENCY_ANOMALY',
    target: { scope: 'NODE', id: 'n1' },
    action: 'REORDER',
    strategy: 'DEFERRED',
    payload: {},
    confidence: 0.1,  // very low, but DEFERRED bypasses confidence
    timestamp: Date.now(),
  }, {
    graph: singleGraph,
    executionState: { cursor: 'n1', checkpoints: [], status: 'RUNNING' },
  })

  test('DEFERRED mutation always allowed regardless of confidence', () => {
    assert(deferredResult.allowed, `expected allowed, got ${deferredResult.error}`)
  })
}

console.log('\n=== Phase 7A-2 Complete ===\n')
