// ============================================================
// RC4-1 — ExecutionExplainProvider 集成测试
// ============================================================
// 覆盖场景:
//   1. Events → Timeline section — items 数量、状态推断
//   2. Nodes → Evidence section — artifact 数据提取
//   3. Metric section — duration/nodes/events 指标
//   4. Resource section — assignment 数据展示
//   5. Retry section — retry/fallback 过滤
//   6. Empty trace — 空 trace 产生合理 explain
//   7. ExplainDocument 完整性 — sections/id/type
//   8. ExplainDocumentBuilder Zero Computation — confidence 为 null
// ============================================================

import { describe, it, before } from 'node:test'
import * as assert from 'node:assert/strict'

import type { ExplainDocument } from '../../src/services/geo/explain/explain-document'

import { ExecutionExplainProvider } from '../../src/services/geo/explain/providers/execution-explain-provider'
import type { IAssignmentRepository } from '../../src/services/geo/explain/providers/execution-explain-provider'

import { InMemoryExecutionTraceRepository } from '../../src/services/geo/execution/repository/execution-trace.repository.impl'

import {
  createExecutionContext,
  createExecutionGraph,
  createExecutionNode,
  createExecutionArtifact,
  createExecutionEvent,
} from '../../src/services/geo/execution/index'

import type {
  ExecutionEvent,
  ExecutionEventType,
  ExecutionGraph,
  ExecutionNode,
} from '../../src/services/geo/execution/types'

import type { ExecutionAssignment } from '../../src/services/geo/execution/resource/resource.types'

// ─── 辅助: 构建带指定 executionId 的事件 ───

function buildEvents(
  execId: string,
  overrides: Partial<ExecutionEvent>[],
): ExecutionEvent[] {
  return overrides.map((o, i) => {
    const base = createExecutionEvent({
      executionId: execId,
      graphId: 'graph-test',
      type: (o.type as ExecutionEventType) || 'graph_created',
      nodeId: o.nodeId,
      data: o.data,
    })
    return {
      ...base,
      ...o,
      id: o.id || base.id,
      timestamp: o.timestamp || new Date(Date.now() + i * 1000).toISOString(),
    } as ExecutionEvent
  })
}

// ─── 测试 ───

describe('RC4-1 ExecutionExplainProvider', () => {
  // ─────── 1. Events → Timeline section ───────

  it('should build timeline section from events', async () => {
    const execId = 'test-timeline-1'
    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr)

    const events = buildEvents(execId, [
      { id: 'e1', type: 'graph_created', timestamp: new Date('2024-01-01T00:00:00Z').toISOString() },
      { id: 'e2', type: 'node_started', nodeId: 'n1', timestamp: new Date('2024-01-01T00:00:01Z').toISOString() },
      { id: 'e3', type: 'node_completed', nodeId: 'n1', timestamp: new Date('2024-01-01T00:00:02Z').toISOString() },
      { id: 'e4', type: 'graph_completed', timestamp: new Date('2024-01-01T00:00:03Z').toISOString() },
    ])
    for (const e of events) {
      await tr.saveEvent(e)
    }

    const doc = await p.getExplain('execution', execId)

    const timelineSection = doc.sections.find(s => s.type === 'timeline')
    assert.ok(timelineSection, 'timeline section should exist')
    assert.equal(timelineSection.items.length, 3, 'timeline should have 3 items (graph_created filtered out)')

    // 验证时间排序 (ascending)
    const labels = timelineSection.items.map(i => i.label)
    // TimelineBuilder 过滤掉了 graph_created，并转换为可读标签
    assert.equal(labels[0], 'Node Started')
    assert.equal(labels[1], 'Node Completed')
    assert.equal(labels[2], 'Execution Completed')

    // 验证 status 推断
    const completedItem = timelineSection.items.find(i => i.label === 'Execution Completed')
    assert.equal(completedItem?.status, 'positive')
  })

  // ─────── 2. Nodes → Evidence section (with artifacts) ───────

  it('should build evidence section from nodes with artifacts', async () => {
    const execId = 'test-evidence-1'
    const ctx = createExecutionContext({
      brandId: 'b1',
      tenantId: 't1',
      sourceType: 'manual',
      sourceId: execId,
    })
    ctx.executionId = execId // override to match

    const artifact = createExecutionArtifact({
      type: 'discovery_signal',
      payload: { signal: 'test', score: 0.85 },
      nodeId: 'n1',
      graphId: 'g1',
      provider: 'deepseek',
      duration: 100,
      cost: 50,
      retryCount: 0,
    })
    const node = createExecutionNode({
      label: 'TestNode',
      type: 'discovery',
      capability: 'reasoning',
    })
    // manually set id so we can reference it
    // artifact will be attached to node
    node.artifact = artifact

    const graph = createExecutionGraph({
      context: ctx,
      nodes: [node],
      edges: [],
    })

    const tr = new InMemoryExecutionTraceRepository()
    // Inject graph into the repo's internal map
    const impl = tr as unknown as { graphs: Map<string, ExecutionGraph>; saveGraph(g: ExecutionGraph): void; saveGraph?: (g: ExecutionGraph) => void }
    if (impl.saveGraph) {
      impl.saveGraph(graph)
    } else {
      // The InMemoryExecutionTraceRepository might have a private method
      // Let's use the internal graphs map directly
      const repo = tr as unknown as { graphs: Map<string, ExecutionGraph> }
      repo.graphs = repo.graphs || new Map()
      repo.graphs.set(execId, { ...graph })
    }

    const p = new ExecutionExplainProvider(tr)

    const doc = await p.getExplain('execution', execId)

    const evidenceSection = doc.sections.find(s => s.type === 'evidence')
    assert.ok(evidenceSection, 'evidence section should exist')

    // Filter out "no-data" fallback items
    const artifactItems = evidenceSection.items.filter(
      i => i.id !== 'no-artifact' && i.id !== 'no-graph',
    )
    assert.ok(artifactItems.length >= 1, 'should have at least 1 artifact evidence item')
    const firstItem = artifactItems[0]
    assert.ok(
      String(firstItem.value).includes('discovery_signal'),
      'should reference artifact type',
    )
    assert.ok(firstItem.source, 'should have source (provider)')
  })

  // ─────── 3. Metric section ───────

  it('should build metric section with duration/nodes/events', async () => {
    const execId = 'test-metric-1'
    const ctx = createExecutionContext({
      brandId: 'b1',
      tenantId: 't1',
      sourceType: 'manual',
      sourceId: execId,
    })
    ctx.executionId = execId

    const node = createExecutionNode({
      label: 'N1',
      type: 'discovery',
      capability: 'reasoning',
    })
    const graph = createExecutionGraph({
      context: ctx,
      nodes: [node],
      edges: [],
    })

    const tr = new InMemoryExecutionTraceRepository()
    // Inject graph
    const repo = tr as unknown as { graphs: Map<string, ExecutionGraph> }
    repo.graphs = repo.graphs || new Map()
    repo.graphs.set(execId, { ...graph })

    const events = buildEvents(execId, [
      { id: 'e1', type: 'graph_created', timestamp: new Date('2024-01-01T00:00:00Z').toISOString() },
      { id: 'e2', type: 'graph_completed', timestamp: new Date('2024-01-01T00:00:10Z').toISOString() },
    ])
    for (const e of events) {
      await tr.saveEvent(e)
    }

    const p = new ExecutionExplainProvider(tr)

    const doc = await p.getExplain('execution', execId)

    const metricSection = doc.sections.find(s => s.type === 'metric')
    assert.ok(metricSection, 'metric section should exist')

    const durationItem = metricSection.items.find(i => i.id === 'duration')
    assert.ok(durationItem, 'duration metric should exist')
    assert.ok(String(durationItem.value).includes('ms'), 'duration should be in ms')
    const durationMs = parseInt(String(durationItem.value))
    assert.ok(durationMs >= 10000, `duration ${durationMs}ms should be >= 10000ms`)

    const nodesItem = metricSection.items.find(i => i.id === 'nodes')
    assert.ok(nodesItem, 'nodes metric should exist')
    assert.equal(nodesItem.value, 1, 'should show 1 node')

    const eventsItem = metricSection.items.find(i => i.id === 'events')
    assert.ok(eventsItem, 'events metric should exist')
    assert.equal(eventsItem.value, 2, 'should show 2 events')
  })

  // ─────── 4. Resource section ───────

  it('should build resource section from assignments', async () => {
    const execId = 'test-resource-1'
    const assignments: ExecutionAssignment[] = [
      {
        nodeId: 'n1',
        capability: 'reasoning',
        assignedTo: 'deepseek-chat',
        resourceType: 'llm_provider',
        priority: 1,
        reason: 'fastest',
      },
      {
        nodeId: 'n2',
        capability: 'search',
        assignedTo: 'tavily',
        resourceType: 'crawler',
        priority: 2,
        reason: 'cheapest',
      },
    ]

    const mockAssignmentRepo: IAssignmentRepository = {
      getAssignments: async (_id: string) => assignments,
    }

    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr, mockAssignmentRepo)

    const doc = await p.getExplain('execution', execId)

    // Resource allocation items are merged into the 'evidence' section
    // (Builder deduplicates by type, so Resource Allocation items appear
    //  within the same 'evidence' section as Execution Evidence)
    const evidenceSection = doc.sections.find(s => s.type === 'evidence')
    assert.ok(evidenceSection, 'evidence section should exist')
    // Find items that look like resource assignments (label containing '→')
    const resourceItems = evidenceSection.items.filter(i => i.label.includes('→'))
    assert.equal(resourceItems.length, 2, 'should have 2 assignment items')

    const firstItem = resourceItems[0]
    assert.ok(firstItem.label.includes('deepseek'), 'label should show provider name')
    assert.ok(String(firstItem.value).includes('reasoning'), 'should show capability')
    assert.equal(firstItem.source, 'fastest', 'should show reason')
  })

  // ─────── 5. Retry section ───────

  it('should filter retry/fallback events', async () => {
    const execId = 'test-retry-1'
    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr)
    const events = buildEvents(execId, [
      { id: 'e1', type: 'graph_created' },
      { id: 'e2', type: 'node_retry', nodeId: 'n1' },
      { id: 'e3', type: 'node_fallback', nodeId: 'n1' },
      { id: 'e4', type: 'graph_completed' },
    ])
    for (const e of events) {
      await tr.saveEvent(e)
    }

    const doc = await p.getExplain('execution', execId)

    const retrySection = doc.sections.find(
      s => s.type === 'recommendation' && s.title === 'Retry / Fallback Summary',
    )
    assert.ok(retrySection, 'retry section should exist')
    // node_retry includes 'retry'; node_fallback includes 'fallback' — both should match
    assert.equal(retrySection.items.length, 2, 'should filter 2 retry/fallback events')

    const retryItem = retrySection.items.find(i => i.label === 'node_retry')
    assert.ok(retryItem, 'node_retry event should be included')
    assert.equal(
      retryItem.status,
      'action_required',
      'retry should have action_required status',
    )

    const fallbackItem = retrySection.items.find(i => i.label === 'node_fallback')
    assert.ok(fallbackItem, 'node_fallback event should be included')
    assert.equal(
      fallbackItem.status,
      'action_required',
      'fallback should have action_required status',
    )
  })

  // ─────── 6. Empty trace ───────

  it('should produce a valid explain for empty trace', async () => {
    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr)

    const doc = await p.getExplain('execution', 'test-empty-1')

    assert.ok(doc, 'document should be created even with empty trace')
    // 4 unique section types: timeline, evidence (merged), metric, recommendation
    // (Resource allocation merges into evidence since Builder deduplicates by type)
    assert.equal(doc.sections.length, 4, 'should have 4 unique section types (timeline, evidence, metric, recommendation)')
    assert.ok(doc.id, 'should have an id')
    assert.ok(doc.title, 'should have a title')
    assert.ok(doc.summary, 'should have a summary')

    // Timeline: empty events
    const timelineSection = doc.sections.find(s => s.type === 'timeline')
    assert.ok(timelineSection, 'timeline section should exist')
    assert.equal(timelineSection.items.length, 0, 'timeline should be empty')

    // Metric: should show 0
    const metricSection = doc.sections.find(s => s.type === 'metric')
    assert.ok(metricSection, 'metric section should exist')
    const nodesItem = metricSection.items.find(i => i.id === 'nodes')
    assert.equal(nodesItem?.value, 0, 'nodes should be 0')
    const eventsItem = metricSection.items.find(i => i.id === 'events')
    assert.equal(eventsItem?.value, 0, 'events should be 0')
  })

  // ─────── 7. ExplainDocument completeness ───────

  it('should contain all expected sections', async () => {
    const execId = 'test-complete-1'
    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr)
    const events = buildEvents(execId, [
      { id: 'e1', type: 'graph_created' },
      { id: 'e2', type: 'graph_completed' },
    ])
    for (const e of events) {
      await tr.saveEvent(e)
    }

    const doc = await p.getExplain('execution', execId)

    const sectionTypes = doc.sections.map(s => s.type)
    assert.ok(sectionTypes.includes('timeline'), 'should have timeline section')
    assert.ok(sectionTypes.includes('evidence'), 'should have evidence section')
    assert.ok(sectionTypes.includes('metric'), 'should have metric section')
    assert.ok(sectionTypes.includes('recommendation'), 'should have recommendation section')

    // All sections should have order
    for (const section of doc.sections) {
      assert.ok(typeof section.order === 'number', `section ${section.type} should have order`)
    }

    // Document-level fields
    assert.ok(
      doc.id.startsWith('execution-explain-'),
      'id should prefix with execution-explain-',
    )
    assert.equal(doc.metadata.sourceType, 'execution', 'metadata.sourceType should be execution')
    assert.equal(doc.metadata.type, 'execution', 'metadata.type should be execution')
    assert.equal(
      doc.metadata.provider,
      'ExecutionExplainProvider',
      'metadata.provider should be set',
    )
    assert.equal(doc.metadata.version, '1.0', 'metadata.version should be 1.0')
    assert.ok(doc.metadata.generatedAt, 'metadata.generatedAt should be set')
  })

  // ─────── 8. Builder Zero Computation ───────

  it('should have null confidence (Zero Computation)', async () => {
    const execId = 'test-zero-compute-1'
    const tr = new InMemoryExecutionTraceRepository()
    const p = new ExecutionExplainProvider(tr)
    const events = buildEvents(execId, [
      { id: 'e1', type: 'graph_created' },
      { id: 'e2', type: 'node_completed', nodeId: 'n1' },
      { id: 'e3', type: 'graph_completed' },
    ])
    for (const e of events) {
      await tr.saveEvent(e)
    }

    const doc = await p.getExplain('execution', execId)

    // Zero Computation: confidence must be null (not calculated)
    assert.equal(doc.confidence, null, 'confidence must be null — provider does not compute confidence')

    // 验证没有 item 上设置了 confidence（保持 Builder 的 Zero Computation）
    for (const section of doc.sections) {
      for (const item of section.items) {
        if (item.confidence !== undefined) {
          assert.fail(
            `item ${item.id} has confidence set (${item.confidence}) — violates Zero Computation`,
          )
        }
      }
    }
  })
})
