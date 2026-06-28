#!/usr/bin/env tsx
/**
 * System Validation: ExecutionStore + RecoveryEngine
 *
 * Tests:
 *   - ExecutionStore CRUD
 *   - Checkpoint append and query
 *   - Event append
 *   - RecoveryEngine analysis
 *   - RecoveryEngine rebuildContext
 *
 * Run: npx tsx tests/kernel/04-execution-store-recovery.test.ts
 */

import { ExecutionStore } from '../../src/kernel/persistence/execution-store.js'
import { RecoveryEngine } from '../../src/kernel/persistence/recovery-engine.js'
import type { ExecutionRecord } from '../../src/kernel/persistence/execution-record.js'

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

console.log('\n=== 04: ExecutionStore + RecoveryEngine ===\n')

// Test 1: Store CRUD
{
  const store = new ExecutionStore()

  const record: ExecutionRecord = {
    id: 'e1',
    graphId: 'g1',
    mode: 'STREAM',
    status: 'RUNNING',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    input: { prompt: 'hello' },
    checkpoints: [],
    events: [],
    summary: { totalNodes: 1, completedNodes: 0, failedNodes: 0, totalLatencyMs: 0 },
  }

  store.create(record)
  test('store size after create', () => {
    assert(store.size === 1, `expected 1, got ${store.size}`)
  })

  const fetched = store.get('e1')
  test('store get returns record', () => {
    assert(fetched !== undefined, 'expected record')
    assert(fetched!.id === 'e1', `expected e1, got ${fetched!.id}`)
  })

  store.updateStatus('e1', 'COMPLETED')
  const updated = store.get('e1')
  test('store updateStatus', () => {
    assert(updated!.status === 'COMPLETED', `expected COMPLETED, got ${updated!.status}`)
  })

  store.update('e1', { output: { result: 'ok' } })
  const withOutput = store.get('e1')
  test('store update with output', () => {
    assert(withOutput!.output?.result === 'ok', `expected ok, got ${withOutput!.output?.result}`)
  })
}

// Test 2: Missing record
{
  const store = new ExecutionStore()
  const fetched = store.get('nonexistent')
  test('get nonexistent returns undefined', () => {
    assert(fetched === undefined, 'expected undefined')
  })
}

// Test 3: Append checkpoint
{
  const store = new ExecutionStore()
  store.create({
    id: 'e2', graphId: 'g1', mode: 'ASYNC', status: 'RUNNING',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: {}, checkpoints: [], events: [],
    summary: { totalNodes: 2, completedNodes: 0, failedNodes: 0, totalLatencyMs: 0 },
  })

  store.appendCheckpoint('e2', {
    nodeId: 'n1', state: { partial: 'data' }, timestamp: Date.now(),
  })

  const record = store.get('e2')
  test('appendCheckpoint adds to checkpoints', () => {
    assert(record!.checkpoints.length === 1, `expected 1, got ${record!.checkpoints.length}`)
    assert(record!.checkpoints[0].nodeId === 'n1', `expected n1, got ${record!.checkpoints[0].nodeId}`)
  })
}

// Test 4: Append event
{
  const store = new ExecutionStore()
  store.create({
    id: 'e3', graphId: 'g1', mode: 'STREAM', status: 'RUNNING',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: {}, checkpoints: [], events: [],
    summary: { totalNodes: 1, completedNodes: 0, failedNodes: 0, totalLatencyMs: 0 },
  })

  store.appendEvent('e3', {
    eventId: 'ev1', nodeId: 'n1', type: 'progress', payload: { p: 0.5 }, timestamp: Date.now(),
  })

  const record = store.get('e3')
  test('appendEvent adds to events', () => {
    assert(record!.events.length === 1, `expected 1, got ${record!.events.length}`)
    assert(record!.events[0].type === 'progress', `expected progress, got ${record!.events[0].type}`)
  })
}

// Test 5: Query by mode
{
  const store = new ExecutionStore()
  store.create({
    id: 'q1', graphId: 'g1', mode: 'SYNC', status: 'COMPLETED',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: {}, checkpoints: [], events: [],
    summary: { totalNodes: 1, completedNodes: 1, failedNodes: 0, totalLatencyMs: 10 },
  })
  store.create({
    id: 'q2', graphId: 'g1', mode: 'ASYNC', status: 'RUNNING',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: {}, checkpoints: [], events: [],
    summary: { totalNodes: 2, completedNodes: 1, failedNodes: 0, totalLatencyMs: 5000 },
  })

  const syncResults = store.queryByMode('SYNC')
  test('queryByMode SYNC', () => {
    assert(syncResults.length === 1, `expected 1, got ${syncResults.length}`)
  })

  const asyncResults = store.queryByMode('ASYNC')
  test('queryByMode ASYNC', () => {
    assert(asyncResults.length === 1, `expected 1, got ${asyncResults.length}`)
  })
}

// Test 6: RecoveryEngine
{
  const store = new ExecutionStore()

  // COMPLETED execution
  store.create({
    id: 'r1', graphId: 'g1', mode: 'SYNC', status: 'COMPLETED',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: { prompt: 'hi' }, output: { result: 'ok' },
    checkpoints: [], events: [],
    summary: { totalNodes: 1, completedNodes: 1, failedNodes: 0, totalLatencyMs: 10 },
  })

  // FAILED execution with checkpoint
  store.create({
    id: 'r2', graphId: 'g1', mode: 'ASYNC', status: 'FAILED',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: {}, checkpoints: [
      { nodeId: 'n1', state: { partial: 'result' }, timestamp: Date.now() },
    ], events: [],
    summary: { totalNodes: 2, completedNodes: 1, failedNodes: 1, totalLatencyMs: 10000 },
  })

  // RUNNING execution without checkpoint
  store.create({
    id: 'r3', graphId: 'g1', mode: 'ASYNC', status: 'RUNNING',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: {}, checkpoints: [], events: [],
    summary: { totalNodes: 2, completedNodes: 0, failedNodes: 0, totalLatencyMs: 0 },
  })

  const engine = new RecoveryEngine(store)

  test('recover COMPLETED → "completed"', async () => {
    const result = await engine.analyze('r1')
    assert(result.recommendation === 'completed', `expected completed, got ${result.recommendation}`)
  })

  test('recover FAILED with checkpoint → "resume"', async () => {
    const result = await engine.analyze('r2')
    assert(result.recommendation === 'resume', `expected resume, got ${result.recommendation}`)
    assert(result.lastCheckpoint !== null, 'expected checkpoint')
    assert(result.lastCheckpoint!.nodeId === 'n1', `expected n1, got ${result.lastCheckpoint!.nodeId}`)
  })

  test('recover RUNNING without checkpoint → "restart"', async () => {
    const result = await engine.analyze('r3')
    assert(result.recommendation === 'restart', `expected restart, got ${result.recommendation}`)
    assert(result.lastCheckpoint === null, 'expected no checkpoint')
  })

  test('recover nonexistent → "not_found"', async () => {
    const result = await engine.analyze('nonexistent')
    assert(result.recommendation === 'not_found', `expected not_found, got ${result.recommendation}`)
  })
}

// Test 7: rebuildContext
{
  const store = new ExecutionStore()
  store.create({
    id: 'ctx1', graphId: 'g1', mode: 'ASYNC', status: 'FAILED',
    createdAt: Date.now(), updatedAt: Date.now(),
    input: {}, checkpoints: [
      { nodeId: 'n1', state: { x: 1 }, timestamp: Date.now() },
    ], events: [
      { eventId: 'e1', nodeId: 'n1', type: 'progress', payload: {}, timestamp: Date.now() },
    ],
    summary: { totalNodes: 2, completedNodes: 1, failedNodes: 1, totalLatencyMs: 5000 },
  })

  const engine = new RecoveryEngine(store)
  test('rebuildContext returns graphId, checkpoint, events', async () => {
    const ctx = await engine.rebuildContext('ctx1')
    assert(ctx !== null, 'expected context')
    assert(ctx!.graphId === 'g1', `expected g1, got ${ctx!.graphId}`)
    assert(ctx!.lastCheckpoint !== null, 'expected checkpoint')
    assert(ctx!.lastCheckpoint!.nodeId === 'n1', `expected n1, got ${ctx!.lastCheckpoint!.nodeId}`)
    assert(ctx!.events.length === 1, `expected 1 event, got ${ctx!.events.length}`)
  })
}

console.log('\n=== 04 Complete ===\n')
