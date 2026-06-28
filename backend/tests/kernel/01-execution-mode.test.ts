#!/usr/bin/env tsx
/**
 * System Validation: Execution Mode Resolution
 *
 * Tests:
 *   - Single node → SYNC
 *   - Multi-node → STREAM
 *   - Checkpointable hint → ASYNC
 *   - Reactive hint → STREAM
 *   - Explicit mode override → specified mode
 *
 * Run: npx tsx tests/kernel/01-execution-mode.test.ts
 */

import { ExecutionModeResolver } from '../../src/kernel/execution-mode-resolver.js'
import type { ExecutionNode, ExecutionGraph } from '../../src/kernel/execution-graph.js'

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

// Setup
const resolver = new ExecutionModeResolver()

console.log('\n=== 01: Execution Mode Resolution ===\n')

// Test 1: Single node → SYNC
{
  const graph: ExecutionGraph = {
    nodes: [{ id: 'n1', capability: 'image' }],
    edges: [],
  }
  const mode = resolver.resolve(graph)
  test('single node → SYNC', () => {
    assert(mode === 'SYNC', `expected SYNC, got ${mode}`)
  })
}

// Test 2: Multi-node → STREAM
{
  const graph: ExecutionGraph = {
    nodes: [
      { id: 'n1', capability: 'llm', dependencies: [] },
      { id: 'n2', capability: 'tts', dependencies: ['n1'] },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
  }
  const mode = resolver.resolve(graph)
  test('multi-node → STREAM', () => {
    assert(mode === 'STREAM', `expected STREAM, got ${mode}`)
  })
}

// Test 3: Checkpointable hint → ASYNC
{
  const graph: ExecutionGraph = {
    nodes: [{ id: 'n1', capability: 'video' }],
    edges: [],
  }
  const mode = resolver.resolve(graph, {
    n1: { isCheckpointable: true },
  })
  test('checkpointable hint → ASYNC', () => {
    assert(mode === 'ASYNC', `expected ASYNC, got ${mode}`)
  })
}

// Test 4: Reactive hint → STREAM
{
  const graph: ExecutionGraph = {
    nodes: [{ id: 'n1', capability: 'llm' }],
    edges: [],
  }
  const mode = resolver.resolve(graph, {
    n1: { isReactive: true },
  })
  test('reactive hint → STREAM', () => {
    assert(mode === 'STREAM', `expected STREAM, got ${mode}`)
  })
}

// Test 5: Explicit mode override
{
  const graph: ExecutionGraph = {
    nodes: [{ id: 'n1', capability: 'image' }],
    edges: [],
  }
  const mode = resolver.resolve(graph, {
    n1: { mode: 'ASYNC' },
  })
  test('explicit mode override → specified mode', () => {
    assert(mode === 'ASYNC', `expected ASYNC, got ${mode}`)
  })
}

// Test 6: isCapabilityAsync('video') === true
{
  test('isCapabilityAsync("video") → true', () => {
    assert(resolver.isCapabilityAsync('video') === true, 'expected true')
  })
}

// Test 7: isCapabilityAsync('llm') === false
{
  test('isCapabilityAsync("llm") → false', () => {
    assert(resolver.isCapabilityAsync('llm') === false, 'expected false')
  })
}

console.log('\n=== 01 Complete ===\n')
