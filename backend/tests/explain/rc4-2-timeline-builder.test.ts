// ============================================================
// RC4-2 — TimelineBuilder 单元测试
//
// 覆盖场景：
//   1. 事件排序 — 按 timestamp 升序排列
//   2. 状态映射 — 验证 status 推断正确
//   3. 标签映射 — event type → 可读标签
//   4. 事件过滤 — filterRelevantEvents 只保留相关事件
//   5. 空事件 — 空数组处理
//   6. 单一事件 — 只有一个事件时的行为
//   7. 多种事件类型 — 验证所有 15+ 种事件类型
//   8. Provider 集成 — ExecutionExplainProvider 使用 TimelineBuilder
// ============================================================

import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import { TimelineBuilder } from '../../src/services/geo/explain/builders/timeline-builder'
import { ExecutionExplainProvider } from '../../src/services/geo/explain/providers/execution-explain-provider'
import { InMemoryExecutionTraceRepository } from '../../src/services/geo/execution/repository/execution-trace.repository.impl'
import {
  createExecutionContext,
  createExecutionGraph,
  createExecutionNode,
  createExecutionEvent,
} from '../../src/services/geo/execution/index'

import type { ExecutionEvent, ExecutionEventType } from '../../src/services/geo/execution/types'

// ─── Helpers ───

/**
 * 创建 ExecutionEvent，允许覆盖每个字段
 */
function makeEvent(overrides: Partial<ExecutionEvent> & { type: string }): ExecutionEvent {
  const base = createExecutionEvent({
    executionId: overrides.executionId || 'test-exec',
    graphId: overrides.graphId || 'test-graph',
    type: overrides.type as ExecutionEventType,
    nodeId: overrides.nodeId,
    data: overrides.data as Record<string, unknown> | undefined,
  })
  return {
    ...base,
    ...overrides,
    id: overrides.id || base.id,
    timestamp: overrides.timestamp || new Date().toISOString(),
  } as ExecutionEvent
}

const builder = new TimelineBuilder()

// ─── 1. 事件排序 ───

describe('RC4-2 TimelineBuilder', () => {
  it('should sort events by timestamp ascending', () => {
    const events = [
      makeEvent({ type: 'node_completed', timestamp: '2024-01-01T00:00:03Z', id: 'e3' }),
      makeEvent({ type: 'node_started', timestamp: '2024-01-01T00:00:01Z', id: 'e1' }),
      makeEvent({ type: 'node_retry', timestamp: '2024-01-01T00:00:02Z', id: 'e2' }),
    ]

    const section = builder.build(events)

    assert.equal(section.items.length, 3)
    assert.equal(section.items[0].id, 'e1')
    assert.equal(section.items[1].id, 'e2')
    assert.equal(section.items[2].id, 'e3')
  })

  // ─── 2. 状态映射 ───

  it('should map error events to negative status', () => {
    const errorTypes = ['node_failed', 'node_timeout', 'node_dead_lettered', 'graph_failed', 'breaker_open']
    const events = errorTypes.map((type, i) =>
      makeEvent({ type, id: `err-${i}`, timestamp: `2024-01-01T00:00:0${i}Z` }),
    )

    const section = builder.build(events)

    assert.equal(section.items.length, errorTypes.length)
    for (const item of section.items) {
      assert.equal(item.status, 'negative', `expected negative for ${item.label}`)
    }
  })

  it('should map warning events to action_required status', () => {
    const warningTypes = ['node_retry', 'node_fallback', 'breaker_half_open', 'dlq_replayed']
    const events = warningTypes.map((type, i) =>
      makeEvent({ type, id: `warn-${i}`, timestamp: `2024-01-01T00:00:0${i}Z` }),
    )

    const section = builder.build(events)

    assert.equal(section.items.length, warningTypes.length)
    for (const item of section.items) {
      assert.equal(item.status, 'action_required', `expected action_required for ${item.label}`)
    }
  })

  it('should map success events to positive status', () => {
    const successTypes = ['node_completed', 'graph_completed', 'breaker_closed']
    const events = successTypes.map((type, i) =>
      makeEvent({ type, id: `ok-${i}`, timestamp: `2024-01-01T00:00:0${i}Z` }),
    )

    const section = builder.build(events)

    assert.equal(section.items.length, successTypes.length)
    for (const item of section.items) {
      assert.equal(item.status, 'positive', `expected positive for ${item.label}`)
    }
  })

  it('should map remaining events to neutral status', () => {
    const neutralTypes = ['node_queued', 'node_started', 'dlq_archived', 'graph_started']
    const events = neutralTypes.map((type, i) =>
      makeEvent({ type, id: `neut-${i}`, timestamp: `2024-01-01T00:00:0${i}Z` }),
    )

    const section = builder.build(events)

    assert.equal(section.items.length, neutralTypes.length)
    for (const item of section.items) {
      assert.equal(item.status, 'neutral', `expected neutral for ${item.label}`)
    }
  })

  // ─── 3. 标签映射 ───

  it('should map event types to human-readable labels', () => {
    const events = [
      makeEvent({ type: 'node_queued', id: 'l1', timestamp: '2024-01-01T00:00:01Z' }),
      makeEvent({ type: 'node_started', id: 'l2', timestamp: '2024-01-01T00:00:02Z' }),
      makeEvent({ type: 'node_completed', id: 'l3', timestamp: '2024-01-01T00:00:03Z' }),
      makeEvent({ type: 'node_retry', id: 'l4', timestamp: '2024-01-01T00:00:04Z' }),
      makeEvent({ type: 'node_failed', id: 'l5', timestamp: '2024-01-01T00:00:05Z' }),
      makeEvent({ type: 'node_timeout', id: 'l6', timestamp: '2024-01-01T00:00:06Z' }),
      makeEvent({ type: 'node_fallback', id: 'l7', timestamp: '2024-01-01T00:00:07Z' }),
      makeEvent({ type: 'node_dead_lettered', id: 'l8', timestamp: '2024-01-01T00:00:08Z' }),
    ]

    const section = builder.build(events)

    const labelMap = new Map(section.items.map(i => [i.id, i.label]))
    assert.equal(labelMap.get('l1'), 'Node Queued')
    assert.equal(labelMap.get('l2'), 'Node Started')
    assert.equal(labelMap.get('l3'), 'Node Completed')
    assert.equal(labelMap.get('l4'), 'Node Retry')
    assert.equal(labelMap.get('l5'), 'Node Failed')
    assert.equal(labelMap.get('l6'), 'Node Timeout')
    assert.equal(labelMap.get('l7'), 'Fallback Triggered')
    assert.equal(labelMap.get('l8'), 'Dead Lettered')
  })

  it('should map graph/breaker/dlq event types to readable labels', () => {
    const events = [
      makeEvent({ type: 'graph_started', id: 'g1', timestamp: '2024-01-01T00:00:01Z' }),
      makeEvent({ type: 'graph_completed', id: 'g2', timestamp: '2024-01-01T00:00:02Z' }),
      makeEvent({ type: 'graph_failed', id: 'g3', timestamp: '2024-01-01T00:00:03Z' }),
      makeEvent({ type: 'breaker_open', id: 'b1', timestamp: '2024-01-01T00:00:04Z' }),
      makeEvent({ type: 'breaker_half_open', id: 'b2', timestamp: '2024-01-01T00:00:05Z' }),
      makeEvent({ type: 'breaker_closed', id: 'b3', timestamp: '2024-01-01T00:00:06Z' }),
      makeEvent({ type: 'dlq_replayed', id: 'd1', timestamp: '2024-01-01T00:00:07Z' }),
      makeEvent({ type: 'dlq_archived', id: 'd2', timestamp: '2024-01-01T00:00:08Z' }),
    ]

    const section = builder.build(events)

    const labelMap = new Map(section.items.map(i => [i.id, i.label]))
    assert.equal(labelMap.get('g1'), 'Execution Started')
    assert.equal(labelMap.get('g2'), 'Execution Completed')
    assert.equal(labelMap.get('g3'), 'Execution Failed')
    assert.equal(labelMap.get('b1'), 'Circuit Breaker Opened')
    assert.equal(labelMap.get('b2'), 'Circuit Breaker Half-Open')
    assert.equal(labelMap.get('b3'), 'Circuit Breaker Closed')
    assert.equal(labelMap.get('d1'), 'DLQ Replayed')
    assert.equal(labelMap.get('d2'), 'DLQ Archived')
  })

  it('should fallback to event type for unknown types', () => {
    const events = [
      makeEvent({ type: 'custom_event', id: 'u1', timestamp: '2024-01-01T00:00:01Z' }),
    ]

    const section = builder.build(events)

    assert.equal(section.items[0].label, 'custom_event')
  })

  // ─── 4. 事件过滤 ───

  it('should filterRelevantEvents only keep relevant event types', () => {
    const events = [
      makeEvent({ type: 'graph_created', id: 'f1', timestamp: '2024-01-01T00:00:01Z' }),
      makeEvent({ type: 'graph_started', id: 'f2', timestamp: '2024-01-01T00:00:02Z' }),
      makeEvent({ type: 'node_queued', id: 'f3', timestamp: '2024-01-01T00:00:03Z' }),
      makeEvent({ type: 'node_started', id: 'f4', timestamp: '2024-01-01T00:00:04Z' }),
      makeEvent({ type: 'node_completed', id: 'f5', timestamp: '2024-01-01T00:00:05Z' }),
      makeEvent({ type: 'graph_cancelled', id: 'f6', timestamp: '2024-01-01T00:00:06Z' }),
      makeEvent({ type: 'dependency_met', id: 'f7', timestamp: '2024-01-01T00:00:07Z' }),
      makeEvent({ type: 'node_cancelled', id: 'f8', timestamp: '2024-01-01T00:00:08Z' }),
    ]

    const filtered = builder.filterRelevantEvents(events)

    const filteredTypes = filtered.map(e => e.type)
    assert.ok(filteredTypes.includes('graph_started'), 'should include graph_started')
    assert.ok(filteredTypes.includes('node_queued'), 'should include node_queued')
    assert.ok(filteredTypes.includes('node_started'), 'should include node_started')
    assert.ok(filteredTypes.includes('node_completed'), 'should include node_completed')
    assert.ok(!filteredTypes.includes('graph_created'), 'should exclude graph_created')
    assert.ok(!filteredTypes.includes('graph_cancelled'), 'should exclude graph_cancelled')
    assert.ok(!filteredTypes.includes('dependency_met'), 'should exclude dependency_met')
    assert.ok(!filteredTypes.includes('node_cancelled'), 'should exclude node_cancelled')
    assert.equal(filtered.length, 4, 'should keep only 4 of 8 events')
  })

  // ─── 5. 空事件 ───

  it('should handle empty events array', () => {
    const section = builder.build([])

    assert.equal(section.type, 'timeline')
    assert.equal(section.title, 'Execution Timeline')
    assert.equal(section.items.length, 0)
    assert.equal(typeof section.order, 'number')
  })

  it('should return empty from filterRelevantEvents for empty input', () => {
    const filtered = builder.filterRelevantEvents([])
    assert.deepEqual(filtered, [])
  })

  // ─── 6. 单一事件 ───

  it('should handle single event correctly', () => {
    const events = [
      makeEvent({ type: 'node_completed', id: 'single', timestamp: '2024-01-01T00:00:01Z' }),
    ]

    const section = builder.build(events)

    assert.equal(section.items.length, 1)
    assert.equal(section.items[0].id, 'single')
    assert.equal(section.items[0].label, 'Node Completed')
    assert.equal(section.items[0].status, 'positive')
    // source 使用事件的原始 timestamp 字符串
    assert.ok(section.items[0].source!.startsWith('timestamp='), 'source should reference timestamp')
    assert.ok(section.items[0].source!.includes('2024-01-01T00:00:01'), 'source should contain timestamp')
  })

  // ─── 7. 多种事件类型 ───

  it('should handle all 16 relevant event types', () => {
    const allTypes = [
      'node_queued',
      'node_started',
      'node_completed',
      'node_retry',
      'node_failed',
      'node_timeout',
      'node_fallback',
      'node_dead_lettered',
      'graph_started',
      'graph_completed',
      'graph_failed',
      'breaker_open',
      'breaker_half_open',
      'breaker_closed',
      'dlq_replayed',
      'dlq_archived',
    ]

    const events = allTypes.map((type, i) =>
      makeEvent({
        type,
        id: `all-${i}`,
        nodeId: type.startsWith('node_') ? `n${i}` : undefined,
        timestamp: `2024-01-01T00:00:${String(i).padStart(2, '0')}Z`,
      }),
    )

    const section = builder.build(events)

    assert.equal(section.items.length, 16)

    // verify all types are present and labeled
    const labels = section.items.map(i => i.label)
    assert.ok(labels.includes('Node Queued'))
    assert.ok(labels.includes('Node Started'))
    assert.ok(labels.includes('Node Completed'))
    assert.ok(labels.includes('Node Retry'))
    assert.ok(labels.includes('Node Failed'))
    assert.ok(labels.includes('Node Timeout'))
    assert.ok(labels.includes('Fallback Triggered'))
    assert.ok(labels.includes('Dead Lettered'))
    assert.ok(labels.includes('Execution Started'))
    assert.ok(labels.includes('Execution Completed'))
    assert.ok(labels.includes('Execution Failed'))
    assert.ok(labels.includes('Circuit Breaker Opened'))
    assert.ok(labels.includes('Circuit Breaker Half-Open'))
    assert.ok(labels.includes('Circuit Breaker Closed'))
    assert.ok(labels.includes('DLQ Replayed'))
    assert.ok(labels.includes('DLQ Archived'))
  })

  it('should correctly set value field (nodeId or executionId)', () => {
    const events = [
      makeEvent({ executionId: 'test-value', type: 'node_started', nodeId: 'n1', id: 'v1', timestamp: '2024-01-01T00:00:01Z' }),
      makeEvent({ executionId: 'test-value', type: 'graph_started', id: 'v2', timestamp: '2024-01-01T00:00:02Z' }),
    ]

    const section = builder.build(events)

    const valueMap = new Map(section.items.map(i => [i.id, i.value]))
    assert.equal(valueMap.get('v1'), 'n1', 'should use nodeId if available')
    assert.equal(valueMap.get('v2'), 'test-value', 'should use executionId if no nodeId')
  })

  it('should extract detail from event data', () => {
    const events = [
      makeEvent({
        type: 'node_completed',
        id: 'd1',
        timestamp: '2024-01-01T00:00:01Z',
        data: { score: 0.95, summary: 'Completed successfully' },
      }),
      makeEvent({
        type: 'node_failed',
        id: 'd2',
        timestamp: '2024-01-01T00:00:02Z',
        data: { error: 'timeout', retries: 3 },
      }),
      makeEvent({
        type: 'node_queued',
        id: 'd3',
        timestamp: '2024-01-01T00:00:03Z',
      }),
    ]

    const section = builder.build(events)

    const detailMap = new Map(section.items.map(i => [i.id, i.detail]))
    assert.ok(detailMap.get('d1'), 'should have detail from data')
    assert.ok(detailMap.get('d1')!.includes('score'), 'detail should contain data fields')
    assert.ok(detailMap.get('d2'), 'should have detail from error data')
    assert.equal(detailMap.get('d3'), undefined, 'should have no detail without data')
  })

  // ─── 8. Provider 集成 ───

  it('should work correctly when used by ExecutionExplainProvider', async () => {
    const execId = 'test-provider-integration'
    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr)

    const events = [
      makeEvent({ executionId: execId, type: 'graph_started', id: 'p1', timestamp: '2024-01-01T00:00:01Z' }),
      makeEvent({ executionId: execId, type: 'node_started', nodeId: 'n1', id: 'p2', timestamp: '2024-01-01T00:00:02Z' }),
      makeEvent({ executionId: execId, type: 'node_retry', nodeId: 'n1', id: 'p3', timestamp: '2024-01-01T00:00:03Z' }),
      makeEvent({ executionId: execId, type: 'node_completed', nodeId: 'n1', id: 'p4', timestamp: '2024-01-01T00:00:04Z' }),
      makeEvent({ executionId: execId, type: 'node_failed', nodeId: 'n2', id: 'p5', timestamp: '2024-01-01T00:00:05Z' }),
      makeEvent({ executionId: execId, type: 'graph_completed', id: 'p6', timestamp: '2024-01-01T00:00:06Z' }),
    ]
    for (const e of events) {
      await tr.saveEvent(e)
    }

    const doc = await p.getExplain('execution', execId)

    const timelineSection = doc.sections.find(s => s.type === 'timeline')
    assert.ok(timelineSection, 'timeline section should exist')
    assert.equal(timelineSection.title, 'Execution Timeline')
    assert.ok(timelineSection.items.length > 0, 'timeline should have items')

    // Verify labels are human-readable (not raw event types)
    const labels = timelineSection.items.map(i => i.label)
    assert.ok(labels.includes('Execution Started'), 'should have human-readable label')
    assert.ok(labels.includes('Node Started'), 'should have human-readable label')
    assert.ok(labels.includes('Node Retry'), 'should have human-readable label')
    assert.ok(labels.includes('Node Completed'), 'should have human-readable label')
    assert.ok(labels.includes('Node Failed'), 'should have human-readable label')
    assert.ok(labels.includes('Execution Completed'), 'should have human-readable label')

    // Verify status mapping
    const nodeRetryItem = timelineSection.items.find(i => i.label === 'Node Retry')
    assert.equal(nodeRetryItem?.status, 'action_required')
    const nodeFailedItem = timelineSection.items.find(i => i.label === 'Node Failed')
    assert.equal(nodeFailedItem?.status, 'negative')
    const completedItem = timelineSection.items.find(i => i.label === 'Execution Completed')
    assert.equal(completedItem?.status, 'positive')
    const startedItem = timelineSection.items.find(i => i.label === 'Execution Started')
    assert.equal(startedItem?.status, 'neutral')

    // Verify timeline section has order (ExplainSection compatibility)
    assert.equal(typeof timelineSection.order, 'number')
  })

  it('should filter irrelevant events when used through ExecutionExplainProvider', async () => {
    const execId = 'test-filter-integration'
    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr)

    // Mix of relevant and irrelevant events
    const events = [
      makeEvent({ executionId: execId, type: 'graph_created', id: 'ir1', timestamp: '2024-01-01T00:00:01Z' }),
      makeEvent({ executionId: execId, type: 'graph_started', id: 'r1', timestamp: '2024-01-01T00:00:02Z' }),
      makeEvent({ executionId: execId, type: 'graph_completed', id: 'r2', timestamp: '2024-01-01T00:00:03Z' }),
      makeEvent({ executionId: execId, type: 'dependency_met', id: 'ir2', timestamp: '2024-01-01T00:00:04Z' }),
      makeEvent({ executionId: execId, type: 'graph_cancelled', id: 'ir3', timestamp: '2024-01-01T00:00:05Z' }),
    ]
    for (const e of events) {
      await tr.saveEvent(e)
    }

    const doc = await p.getExplain('execution', execId)

    const timelineSection = doc.sections.find(s => s.type === 'timeline')
    assert.ok(timelineSection)
    // graph_created, dependency_met, graph_cancelled should be filtered out
    assert.equal(timelineSection.items.length, 2, 'should only have 2 relevant events')
    assert.equal(timelineSection.items[0].label, 'Execution Started')
    assert.equal(timelineSection.items[1].label, 'Execution Completed')
  })
})
