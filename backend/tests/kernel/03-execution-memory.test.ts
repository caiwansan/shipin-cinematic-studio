#!/usr/bin/env tsx
/**
 * System Validation: ExecutionMemory + FeedbackLoop
 *
 * Tests:
 *   - record and query traces
 *   - getStats (avgLatency, successRate)
 *   - getPatterns frequency
 *   - FeedbackLoop ingest and analyze
 *
 * Run: npx tsx tests/kernel/03-execution-memory.test.ts
 */

import { ExecutionMemory } from '../../src/kernel/execution-memory.js'
import { FeedbackLoop } from '../../src/kernel/feedback-loop.js'
import type { StreamResult } from '../../src/core/stream-plane/stream-chunk.js'

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

console.log('\n=== 03: ExecutionMemory + FeedbackLoop ===\n')

// Test 1: Record and query
{
  const mem = new ExecutionMemory()
  mem.record({
    traceId: 't1', capability: 'llm', provider: 'deepseek',
    latencyMs: 100, cost: 10, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'balanced',
    timestamp: Date.now(),
  })
  mem.record({
    traceId: 't2', capability: 'image', provider: 'siliconflow',
    latencyMs: 2000, cost: 5, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'safe',
    timestamp: Date.now(),
  })
  mem.record({
    traceId: 't3', capability: 'llm', provider: 'deepseek',
    latencyMs: 300, cost: 10, success: false,
    nodeCount: 1, concurrency: 1, policyMode: 'balanced',
    timestamp: Date.now(),
  })

  test('size after 3 records', () => {
    assert(mem.size === 3, `expected 3, got ${mem.size}`)
  })

  test('query by capability', () => {
    const results = mem.query('llm')
    assert(results.length === 2, `expected 2, got ${results.length}`)
  })

  test('query all returns most recent first', () => {
    const all = mem.query()
    assert(all.length === 3, `expected 3, got ${all.length}`)
    // t3 should be first (most recent)
    assert(all[0].traceId === 't3', `expected t3 first, got ${all[0].traceId}`)
  })

  test('query with limit', () => {
    const results = mem.query(undefined, 1)
    assert(results.length === 1, `expected 1, got ${results.length}`)
  })
}

// Test 2: getStats
{
  const mem = new ExecutionMemory()
  mem.record({
    traceId: 's1', capability: 'llm', provider: 'openai',
    latencyMs: 100, cost: 10, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'balanced',
    timestamp: Date.now(),
  })
  mem.record({
    traceId: 's2', capability: 'llm', provider: 'openai',
    latencyMs: 200, cost: 10, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'balanced',
    timestamp: Date.now(),
  })

  const stats = mem.getStats('llm')
  test('getStats totalExecutions', () => {
    assert(stats.totalExecutions === 2, `expected 2, got ${stats.totalExecutions}`)
  })
  test('getStats avgLatencyMs', () => {
    assert(stats.avgLatencyMs === 150, `expected 150, got ${stats.avgLatencyMs}`)
  })
  test('getStats successRate', () => {
    assert(stats.successRate === 1, `expected 1, got ${stats.successRate}`)
  })

  const emptyStats = mem.getStats('video')
  test('getStats for empty capability returns zeros', () => {
    assert(emptyStats.totalExecutions === 0, `expected 0, got ${emptyStats.totalExecutions}`)
  })
}

// Test 3: getPatterns
{
  const mem = new ExecutionMemory()
  mem.record({
    traceId: 'p1', capability: 'llm', provider: 'deepseek',
    latencyMs: 100, cost: 10, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'balanced',
    timestamp: Date.now(),
  })
  mem.record({
    traceId: 'p2', capability: 'llm', provider: 'deepseek',
    latencyMs: 100, cost: 10, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'balanced',
    timestamp: Date.now(),
  })
  mem.record({
    traceId: 'p3', capability: 'image', provider: 'aliyun',
    latencyMs: 1000, cost: 5, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'safe',
    timestamp: Date.now(),
  })

  const patterns = mem.getPatterns()
  test('getPatterns llm count', () => {
    assert(patterns.get('llm') === 2, `expected 2, got ${patterns.get('llm')}`)
  })
  test('getPatterns image count', () => {
    assert(patterns.get('image') === 1, `expected 1, got ${patterns.get('image')}`)
  })
}

// Test 4: FeedbackLoop
{
  const mem = new ExecutionMemory()
  const loop = new FeedbackLoop(mem)

  loop.ingestStreamResult({
    sessionId: 'f1',
    content: 'hello',
    chunkCount: 1,
    latencyMs: 50,
    provider: 'deepseek',
    model: 'deepseek-chat',
  }, {
    capability: 'llm',
    provider: 'deepseek',
    nodeCount: 1,
    concurrency: 1,
    policyMode: 'balanced',
  })

  test('FeedbackLoop ingest → size 1', () => {
    assert(mem.size === 1, `expected 1, got ${mem.size}`)
  })

  const analysis = loop.analyze()
  test('FeedbackLoop analyze returns hotPaths', () => {
    assert(analysis.hotPaths.length >= 1, 'expected at least 1 hot path')
    assert(analysis.hotPaths[0][0] === 'llm', `expected llm first, got ${analysis.hotPaths[0][0]}`)
  })
}

// Test 5: clear
{
  const mem = new ExecutionMemory()
  mem.record({
    traceId: 'c1', capability: 'llm', provider: 'deepseek',
    latencyMs: 100, cost: 10, success: true,
    nodeCount: 1, concurrency: 1, policyMode: 'balanced',
    timestamp: Date.now(),
  })
  mem.clear()
  test('clear removes all traces', () => {
    assert(mem.size === 0, `expected 0, got ${mem.size}`)
  })
}

console.log('\n=== 03 Complete ===\n')
