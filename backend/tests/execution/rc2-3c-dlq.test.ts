// ============================================================
// RC2-3c — Dead Letter Queue Tests
// 12 个 spec 场景
// ============================================================

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

import { DLQService } from '../../src/services/geo/execution/dlq/dlq.service'
import { InMemoryDLQRepository } from '../../src/services/geo/execution/repository/dlq.repository.impl'
import type { ExecutionNode } from '../../src/services/geo/execution/types'
import type { FallbackGraph, FallbackNode } from '../../src/services/geo/execution/fallback/fallback.types'
import type { DLQRecord } from '../../src/services/geo/execution/dlq/dlq.types'

// ─── Helpers ───

function createMockNode(id: string, provider?: string): ExecutionNode {
  return {
    id,
    label: `node-${id}`,
    type: 'discovery',
    capability: 'search',
    providerPolicy: 'FASTEST',
    config: { query: 'test' },
    status: 'failed',
    retryConfig: {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitter: true,
      useExponentialBackoff: true,
    },
    timeout: 30000,
    dependencies: [],
    artifact: provider
      ? {
          id: `art-${id}`,
          type: 'signal',
          payload: { result: 'data' },
          metadata: {
            nodeId: id,
            graphId: 'test-graph',
            provider,
            duration: 100,
            cost: 50,
            retryCount: 2,
          },
          createdAt: new Date().toISOString(),
        }
      : undefined,
  }
}

function createMockFallbackGraph(selectedProvider?: string): FallbackGraph {
  const fallbackNodes: FallbackNode[] = [
    { id: 'fb-1', originalNodeId: 'node-1', provider: 'provider-b', capability: 'search', fallbackLevel: 1, priority: 1 },
    { id: 'fb-2', originalNodeId: 'node-1', provider: 'provider-c', capability: 'search', fallbackLevel: 2, priority: 2 },
  ]
  return {
    id: 'fb-graph-1',
    originalNodeId: 'node-1',
    fallbackNodes,
    selectedNodeId: selectedProvider ? 'fb-1' : null,
    status: 'exhausted',
    createdAt: new Date().toISOString(),
  }
}

// ─── Tests ───

describe('RC2-3c — Dead Letter Queue', () => {
  let service: DLQService
  let repository: InMemoryDLQRepository

  before(() => {
    repository = new InMemoryDLQRepository()
    service = new DLQService(repository)
  })

  // 1. enqueue — 失败节点入 DLQ，验证 record 结构正确
  it('1. enqueue — should store a DLQ record with correct structure', async () => {
    const node = createMockNode('node-1', 'provider-a')
    const result = await service.enqueue({
      executionId: 'exec-1',
      graphId: 'graph-1',
      node,
      reason: 'retry_exhausted',
      errorMessage: 'All retries exhausted',
    })

    assert.ok(result.record, 'record should exist')
    assert.ok(result.record.id, 'record should have id')
    assert.equal(result.record.executionId, 'exec-1')
    assert.equal(result.record.graphId, 'graph-1')
    assert.equal(result.record.nodeId, 'node-1')
    assert.equal(result.record.provider, 'provider-a')
    assert.equal(result.record.capability, 'search')
    assert.equal(result.record.reason, 'retry_exhausted')
    assert.equal(result.record.errorMessage, 'All retries exhausted')
    assert.equal(result.record.status, 'pending')
    assert.equal(result.record.retryCount, 3)
    assert.equal(result.record.fallbackAttempts, 0)
    assert.ok(result.record.createdAt)
    assert.equal(result.record.replayedAt, undefined)
    assert.equal(result.record.archivedAt, undefined)
    assert.equal(result.record.replayedExecutionId, undefined)
  })

  // 2. enqueue 事件 — 产生 node_dead_lettered ExecutionEvent
  it('2. enqueue — should emit node_dead_lettered event', async () => {
    const node = createMockNode('node-2', 'provider-a')
    const result = await service.enqueue({
      executionId: 'exec-2',
      graphId: 'graph-2',
      node,
      reason: 'circuit_breaker_open',
      errorMessage: 'Circuit breaker is open',
    })

    assert.ok(result.events, 'events should exist')
    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'node_dead_lettered')
    assert.equal(result.events[0].executionId, 'exec-2')
    assert.equal(result.events[0].graphId, 'graph-2')
    assert.equal(result.events[0].nodeId, 'node-2')
    assert.ok(result.events[0].data)
    assert.equal(result.events[0].data?.dlqId, result.record.id)
    assert.equal(result.events[0].data?.reason, 'circuit_breaker_open')
    assert.equal(result.events[0].data?.errorMessage, 'Circuit breaker is open')
  })

  // 3. findPending — 只返回 pending 记录
  it('3. findPending — should return only pending records', async () => {
    // enqueue a few records
    await service.enqueue({
      executionId: 'exec-3',
      graphId: 'graph-3',
      node: createMockNode('node-3a', 'provider-a'),
      reason: 'retry_exhausted',
      errorMessage: 'fail',
    })

    const node3b = createMockNode('node-3b', 'provider-b')
    const { record: recordToReplay } = await service.enqueue({
      executionId: 'exec-3',
      graphId: 'graph-3',
      node: node3b,
      reason: 'circuit_breaker_open',
      errorMessage: 'CB open',
    })

    // replay one to change its status
    await service.replay(recordToReplay.id, 'replay-exec-3')

    const pending = await service.findPending()
    assert.ok(pending.length >= 1)
    for (const r of pending) {
      assert.equal(r.status, 'pending')
    }
  })

  // 4. findByExecution — 按 execution 查询
  it('4. findByExecution — should filter by execution ID', async () => {
    const records = await service.findByExecution('exec-3')
    assert.ok(records.length > 0)
    for (const r of records) {
      assert.equal(r.executionId, 'exec-3')
    }
  })

  // 5. replay — 标记为 replayed
  it('5. replay — should mark pending record as replayed', async () => {
    const node = createMockNode('node-5', 'provider-a')
    const { record } = await service.enqueue({
      executionId: 'exec-5',
      graphId: 'graph-5',
      node,
      reason: 'retry_exhausted',
      errorMessage: 'All retries exhausted for replay test',
    })

    const replayResult = await service.replay(record.id, 'replay-exec-5')
    assert.ok(replayResult.events)

    const updated = await service.findById(record.id)
    assert.ok(updated)
    assert.equal(updated.status, 'replayed')
    assert.equal(updated.replayedExecutionId, 'replay-exec-5')
    assert.ok(updated.replayedAt)
  })

  // 6. replay 事件 — 产生 dlq_replayed ExecutionEvent
  it('6. replay — should emit dlq_replayed event', async () => {
    const node = createMockNode('node-6', 'provider-b')
    const { record } = await service.enqueue({
      executionId: 'exec-6',
      graphId: 'graph-6',
      node,
      reason: 'fallback_exhausted',
      errorMessage: 'All fallbacks exhausted',
    })

    const result = await service.replay(record.id, 'replay-exec-6')

    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'dlq_replayed')
    assert.equal(result.events[0].executionId, 'exec-6')
    assert.equal(result.events[0].data?.dlqId, record.id)
    assert.equal(result.events[0].data?.replayedExecutionId, 'replay-exec-6')
    assert.equal(result.events[0].data?.provider, 'provider-b')
  })

  // 7. replay 重复 — 不可重放已重放或已归档的记录
  it('7. replay — should reject already replayed or archived records', async () => {
    // Try re-replaying the already replayed record from test 5
    const replayedRecord = await service.findByExecution('exec-5')
    const replayed = replayedRecord[0]
    assert.equal(replayed.status, 'replayed')

    await assert.rejects(
      () => service.replay(replayed.id, 'another-replay'),
      (err: Error) => {
        assert.ok(err.message.includes('Cannot replay'))
        assert.ok(err.message.includes('replayed'))
        return true
      }
    )

    // Archive a record then try to replay it
    const node = createMockNode('node-7', 'provider-c')
    const { record } = await service.enqueue({
      executionId: 'exec-7',
      graphId: 'graph-7',
      node,
      reason: 'deadlock',
      errorMessage: 'Deadlock detected',
    })

    await service.archive(record.id)

    await assert.rejects(
      () => service.replay(record.id, 'replay-after-archive'),
      (err: Error) => {
        assert.ok(err.message.includes('Cannot replay'))
        assert.ok(err.message.includes('archived'))
        return true
      }
    )
  })

  // 8. archive — 标记为 archived
  it('8. archive — should mark pending record as archived', async () => {
    const node = createMockNode('node-8', 'provider-a')
    const { record } = await service.enqueue({
      executionId: 'exec-8',
      graphId: 'graph-8',
      node,
      reason: 'unknown',
      errorMessage: 'Unknown error',
    })

    await service.archive(record.id)

    const updated = await service.findById(record.id)
    assert.ok(updated)
    assert.equal(updated.status, 'archived')
    assert.ok(updated.archivedAt)
  })

  // 9. archive 事件 — 产生 dlq_archived ExecutionEvent
  it('9. archive — should emit dlq_archived event', async () => {
    const node = createMockNode('node-9', 'provider-b')
    const { record } = await service.enqueue({
      executionId: 'exec-9',
      graphId: 'graph-9',
      node,
      reason: 'retry_exhausted',
      errorMessage: 'fail',
    })

    const result = await service.archive(record.id)

    assert.equal(result.events.length, 1)
    assert.equal(result.events[0].type, 'dlq_archived')
    assert.equal(result.events[0].executionId, 'exec-9')
    assert.equal(result.events[0].data?.dlqId, record.id)
  })

  // 10. query — 按 status/provider 筛选
  it('10. query — should filter by status and provider', async () => {
    // Query by status
    const pendingResult = await service.query({ status: 'pending' })
    for (const r of pendingResult.records) {
      assert.equal(r.status, 'pending')
    }
    assert.equal(pendingResult.total, pendingResult.records.length)

    // Query by provider
    const providerResult = await service.query({ provider: 'provider-a' })
    for (const r of providerResult.records) {
      assert.equal(r.provider, 'provider-a')
    }

    // Query with limit/offset
    const limitedResult = await service.query({ limit: 1, offset: 0 })
    assert.ok(limitedResult.records.length <= 1)
    assert.ok(limitedResult.total >= 1)
  })

  // 11. count — 总数查询
  it('11. count — should return total number of DLQ records', async () => {
    const count = await service.count()
    assert.equal(typeof count, 'number')
    assert.ok(count > 0)
  })

  // 12. enqueue with fallbackGraph — 传入 fallback 信息
  it('12. enqueue — should include fallback graph info in payload', async () => {
    const node = createMockNode('node-12', 'provider-a')
    const fallbackGraph = createMockFallbackGraph()

    const result = await service.enqueue({
      executionId: 'exec-12',
      graphId: 'graph-12',
      node,
      reason: 'fallback_exhausted',
      errorMessage: 'All fallbacks failed',
      fallbackGraph,
    })

    assert.equal(result.record.reason, 'fallback_exhausted')
    assert.equal(result.record.fallbackAttempts, 2)

    const payload = result.record.payload as any
    assert.ok(payload)
    assert.ok(payload.fallbackGraph)
    assert.equal(payload.fallbackGraph.id, 'fb-graph-1')
    assert.equal(payload.fallbackGraph.totalFallbacks, 2)
    assert.equal(payload.fallbackGraph.selectedNodeId, null)
  })
})
