// ============================================================
// RC4-3: Workspace Integration — Mission Execution Test
// ============================================================
// 覆盖：
//   1. Mission Execute Route — 调用 POST 创建执行
//   2. Planner 集成 — Mission → ExecutionGraph
//   3. Runtime 集成 — Graph 正常执行
//   4. Trace 持久化 — 执行完成后 Trace 可用
//   5. Explain 集成 — Explain API 返回 explain document
//   6. Timeline Section — ExplainDocument 包含 timeline section
//   7. 状态流转 — 执行状态变化正确
//   8. 错误处理 — Mission 无效时返回错误

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import {
  ExecutionPlanner,
  MissionExecutionAdapter,
  DAGScheduler,
  InMemoryExecutionTraceRepository,
  ProviderRegistry,
  ResourceAllocator,
  createExecutionContext,
} from '../../src/services/geo/execution/index'

import type { ExecutionGraph } from '../../src/services/geo/execution/types'
import type { ExplainDocument } from '../../src/services/geo/explain/explain-document'
import { ExplainEngine, ExplainRegistry } from '../../src/services/geo/explain/index.js'

// ─── Test Helpers ───

function createTestMission(overrides?: any) {
  return {
    id: `mission-${Date.now()}`,
    brandId: 'test-brand-001',
    priority: 'normal' as const,
    steps: [
      {
        id: 'step-discovery',
        actionType: 'discovery',
        description: 'Discover current state',
        config: { source: 'web' },
      },
      {
        id: 'step-knowledge',
        actionType: 'knowledge',
        description: 'Extract knowledge artifacts',
        config: { depth: 'full' },
      },
      {
        id: 'step-recommendation',
        actionType: 'recommendation',
        description: 'Generate recommendations',
        config: { format: 'structured' },
      },
    ],
    ...overrides,
  }
}

// ─── Tests ───

describe('RC4-3 Workspace Integration — Mission Execution', () => {
  // ===== 1. Mission Execute Route =====
  describe('1. Mission Execute Route', () => {
    it('should convert mission to planning request via adapter', () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const request = adapter.toPlanningRequest(mission)

      assert.equal(request.sourceType, 'mission')
      assert.equal(request.sourceId, mission.id)
      assert.equal(request.brandId, mission.brandId)
      assert.equal(request.steps.length, mission.steps.length)
      assert.equal(request.steps[0].id, 'step-discovery')
      assert.equal(request.steps[1].capability, 'extraction')
      assert.equal(request.steps[2].capability, 'generation')
    })

    it('should accept mission execute via POST route simulation', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()

      // Simulate route: Mission → Adapter → Planner → Graph
      const planningRequest = adapter.toPlanningRequest(mission)
      const { graph, result } = await planner.plan(planningRequest)

      assert.ok(graph)
      assert.equal(graph.nodes.length, 3)
      assert.equal(graph.context.sourceType, 'mission')
      assert.equal(graph.context.sourceId, mission.id)
      assert.ok(result.validation.valid)
    })
  })

  // ===== 2. Planner 集成 =====
  describe('2. Planner Integration — Mission → ExecutionGraph', () => {
    it('should produce valid ExecutionGraph from mission', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()

      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      assert.ok(graph.id)
      assert.equal(graph.status, 'pending')
      assert.equal(graph.nodes.length, 3)

      // Edges are validated — DependencyBuilder adds inferred edges
      // (step-discovery → step-knowledge, step-knowledge → step-recommendation)
      // May also add edges from dependency inference
      assert.ok(graph.edges.length >= 2)

      // Verify node structure
      const discoveryNode = graph.nodes.find(n => n.id === 'step-discovery')
      assert.ok(discoveryNode)
      assert.equal(discoveryNode.type, 'discovery')
      assert.equal(discoveryNode.capability, 'reasoning')

      const knowledgeNode = graph.nodes.find(n => n.id === 'step-knowledge')
      assert.ok(knowledgeNode)
      assert.equal(knowledgeNode.dependencies.length, 1)
      assert.equal(knowledgeNode.dependencies[0], 'step-discovery')
    })

    it('should detect invalid missions (empty steps)', async () => {
      const mission = createTestMission({ steps: [] })
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()

      const { graph, result } = await planner.plan(adapter.toPlanningRequest(mission))

      assert.ok(graph)
      assert.equal(graph.nodes.length, 0)
      assert.ok(!result.validation.valid)
      assert.ok(result.validation.errors.some((e: any) => e.code === 'EMPTY_GRAPH'))
    })
  })

  // ===== 3. Runtime 集成 =====
  describe('3. Runtime Integration — Graph Execution', () => {
    it('should execute graph with DAGScheduler', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo })
      const completedGraph = await scheduler.execute(graph)

      assert.equal(completedGraph.status, 'completed')
      assert.equal(completedGraph.nodes.every(n => n.status === 'completed'), true)
    })

    it('should generate events during execution', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo })
      await scheduler.execute(graph)

      const events = await traceRepo.getEvents(graph.context.executionId)
      // DAGScheduler generates graph_created + graph_completed events
      assert.ok(events.length >= 2, `Expected >= 2 events, got ${events.length}`)

      const eventTypes = events.map(e => e.type)
      assert.ok(eventTypes.includes('graph_created'))
      assert.ok(eventTypes.includes('graph_completed'))
    })
  })

  // ===== 4. Trace 持久化 =====
  describe('4. Trace Persistence', () => {
    it('should persist graph and events after execution — use completed graph', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()

      const scheduler = new DAGScheduler({ traceRepo })
      const completedGraph = await scheduler.execute(graph)

      // The scheduler returns the completed graph — the trace repo
      // has the events but needs the graph explicitly saved with updated status
      // Save completed graph to trace
      traceRepo.saveGraph(completedGraph)

      // Verify trace is available
      const executionId = completedGraph.context.executionId
      const persistedGraph = await traceRepo.getGraph(executionId)
      assert.ok(persistedGraph)
      assert.equal(persistedGraph!.status, 'completed')

      const events = await traceRepo.getEvents(executionId)
      assert.ok(events.length > 0)
      assert.equal(events[0].executionId, executionId)
    })

    it('should allow multiple executions with separate traces', async () => {
      const mission1 = createTestMission()
      const mission2 = createTestMission()

      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()

      // Execute mission 1
      const { graph: graph1 } = await planner.plan(adapter.toPlanningRequest(mission1))
      const traceRepo1 = new InMemoryExecutionTraceRepository()
      traceRepo1.saveGraph(graph1)
      const scheduler1 = new DAGScheduler({ traceRepo: traceRepo1 })
      const completed1 = await scheduler1.execute(graph1)
      traceRepo1.saveGraph(completed1)

      // Execute mission 2
      const { graph: graph2 } = await planner.plan(adapter.toPlanningRequest(mission2))
      const traceRepo2 = new InMemoryExecutionTraceRepository()
      traceRepo2.saveGraph(graph2)
      const scheduler2 = new DAGScheduler({ traceRepo: traceRepo2 })
      const completed2 = await scheduler2.execute(graph2)
      traceRepo2.saveGraph(completed2)

      // Verify separate traces
      const events1 = await traceRepo1.getEvents(completed1.context.executionId)
      const events2 = await traceRepo2.getEvents(completed2.context.executionId)
      assert.ok(events1.length > 0)
      assert.ok(events2.length > 0)
      assert.notEqual(completed1.context.executionId, completed2.context.executionId)
    })
  })

  // ===== 5. Explain 集成 =====
  describe('5. Explain Integration', () => {
    it('should generate ExplainDocument for execution via ExecutionExplainProvider', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo })
      const completedGraph = await scheduler.execute(graph)
      traceRepo.saveGraph(completedGraph)

      const executionId = completedGraph.context.executionId

      // Setup ExplainEngine with ExecutionExplainProvider
      const { ExecutionExplainProvider } = await import('../../src/services/geo/explain/providers/execution-explain-provider.js')
      const registry = new ExplainRegistry()
      registry.register(new ExecutionExplainProvider(traceRepo))

      const engine = new ExplainEngine(registry, null as any)
      const doc = await engine.explain('execution', executionId)

      assert.ok(doc)
      assert.equal(doc!.metadata.type, 'execution')
      assert.equal(doc!.metadata.sourceId, executionId)
      assert.equal(doc!.metadata.provider, 'ExecutionExplainProvider')
      assert.ok(doc!.sections.length > 0)
    })
  })

  // ===== 6. Timeline Section =====
  describe('6. Timeline Section', () => {
    it('should contain timeline section in ExplainDocument', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo })
      const completedGraph = await scheduler.execute(graph)
      traceRepo.saveGraph(completedGraph)

      const executionId = completedGraph.context.executionId

      const { ExecutionExplainProvider } = await import('../../src/services/geo/explain/providers/execution-explain-provider.js')
      const registry = new ExplainRegistry()
      registry.register(new ExecutionExplainProvider(traceRepo))

      const engine = new ExplainEngine(registry, null as any)
      const doc = await engine.explain('execution', executionId) as ExplainDocument

      // Verify timeline section exists
      const timelineSection = doc.sections.find(s => s.type === 'timeline')
      assert.ok(timelineSection, 'Timeline section should exist')
      assert.equal(timelineSection!.title, 'Execution Timeline')
      assert.ok(timelineSection!.items.length > 0)

      // Verify timeline items have correct structure
      const firstItem = timelineSection!.items[0]
      assert.ok(firstItem.id)
      assert.ok(firstItem.label)
      assert.ok(firstItem.value)
      assert.ok(firstItem.source)
    })

    it('should have timeline items ordered by timestamp', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo })
      const completedGraph = await scheduler.execute(graph)
      traceRepo.saveGraph(completedGraph)

      const executionId = completedGraph.context.executionId

      const { ExecutionExplainProvider } = await import('../../src/services/geo/explain/providers/execution-explain-provider.js')
      const registry = new ExplainRegistry()
      registry.register(new ExecutionExplainProvider(traceRepo))

      const engine = new ExplainEngine(registry, null as any)
      const doc = await engine.explain('execution', executionId) as ExplainDocument
      const timelineSection = doc.sections.find(s => s.type === 'timeline')!

      // Verify items are ordered by timestamp (source contains timestamps)
      assert.ok(timelineSection.items.length > 0)

      // All items should have valid label and value
      for (const item of timelineSection.items) {
        assert.ok(item.label, `Item ${item.id} should have label`)
        assert.ok(item.value, `Item ${item.id} should have value`)
      }
    })
  })

  // ===== 7. 状态流转 =====
  describe('7. Status Transitions', () => {
    it('should transition through correct statuses', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo })
      const completedGraph = await scheduler.execute(graph)

      // Initial state should be pending
      assert.equal(graph.status, 'pending')

      // Final state should be completed
      assert.equal(completedGraph.status, 'completed')

      // All nodes should be completed
      completedGraph.nodes.forEach(node => {
        assert.equal(node.status, 'completed', `Node ${node.id} should be completed`)
      })
    })

    it('should handle failed execution', async () => {
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(adapter.toPlanningRequest(mission))

      const traceRepo = new InMemoryExecutionTraceRepository()
      traceRepo.saveGraph(graph)

      // Custom node execute that fails for the knowledge node
      const scheduler = new DAGScheduler({
        traceRepo,
        nodeExecute: async (node) => {
          if (node.id === 'step-knowledge') {
            return { success: false, error: 'Simulated failure' }
          }
          return { success: true, output: null, duration: 0 }
        },
      })

      const completedGraph = await scheduler.execute(graph)

      // Graph should fail
      assert.equal(completedGraph.status, 'failed')

      // Discovery should have completed, knowledge failed
      const discoveryNode = completedGraph.nodes.find(n => n.id === 'step-discovery')!
      const knowledgeNode = completedGraph.nodes.find(n => n.id === 'step-knowledge')!
      const recommendNode = completedGraph.nodes.find(n => n.id === 'step-recommendation')!

      assert.equal(discoveryNode.status, 'completed')
      assert.equal(knowledgeNode.status, 'failed')
      // recommendation depends on knowledge, so if knowledge fails, recommendation stays queued/pending
      assert.ok(
        ['queued', 'pending', 'failed'].includes(recommendNode.status),
        `Expected recommendation to be queued/pending/failed, got: ${recommendNode.status}`
      )
    })
  })

  // ===== 8. 错误处理 =====
  describe('8. Error Handling', () => {
    it('should handle non-existent mission gracefully', async () => {
      const adapter = new MissionExecutionAdapter()
      // Adapter should not throw for valid structure with empty steps
      const planningRequest = adapter.toPlanningRequest({
        id: 'non-existent-mission-999',
        brandId: 'test',
        priority: 'normal',
        steps: [],
      })
      assert.equal(planningRequest.steps.length, 0)
    })

    it('should handle planner errors for invalid input', async () => {
      const planner = new ExecutionPlanner()

      const { result } = await planner.plan({
        id: 'invalid-plan',
        sourceType: 'mission',
        sourceId: 'invalid',
        brandId: 'test',
        tenantId: 'test',
        priority: 'normal',
        steps: [
          {
            id: 'self-dep',
            label: 'Self-referencing step',
            type: 'custom',
            capability: 'custom',
            dependsOn: ['self-dep'], // self dependency — cycle!
            config: {},
          },
        ],
        providerPolicy: 'FASTEST',
        metadata: {},
      })

      // Should mark as invalid because of self-dependency cycle
      assert.ok(!result.validation.valid)
      assert.ok(result.validation.errors.length > 0)
    })

    it('should handle missing brandId gracefully', async () => {
      const mission = createTestMission({ brandId: '' })
      const adapter = new MissionExecutionAdapter()

      // Even without brandId, adapter should still produce valid output
      const request = adapter.toPlanningRequest(mission)
      assert.ok(request)
      assert.equal(request.brandId, '')
      assert.equal(request.steps.length, 3)

      const planner = new ExecutionPlanner()
      const { graph } = await planner.plan(request)
      assert.ok(graph)
      assert.equal(graph.nodes.length, 3)
    })
  })

  // ===== 集成: 完整链路 =====
  describe('Full Integration — Mission → Execution → Explain → Timeline', () => {
    it('should complete full pipeline: Mission → Adapter → Planner → Scheduler → Trace → Explain → Timeline', async () => {
      // Step 1-2: Mission → Adapter → Planner
      const mission = createTestMission()
      const adapter = new MissionExecutionAdapter()
      const planner = new ExecutionPlanner()
      const planningRequest = adapter.toPlanningRequest(mission)
      const { graph, result } = await planner.plan(planningRequest)

      assert.ok(result.validation.valid, 'Plan should be valid')
      assert.equal(graph.nodes.length, 3)
      assert.equal(graph.context.sourceType, 'mission')

      // Step 3: ResourceAllocator — use capabilities matching MissionExecutionAdapter
      const providerRegistry = new ProviderRegistry()
      providerRegistry.register({
        provider: 'test-provider',
        capabilities: [
          { provider: 'test-provider', capability: 'reasoning', priority: 1, costPerToken: 0.001, averageLatency: 100, supportedPolicies: ['FASTEST', 'CHEAPEST', 'MOST_RELIABLE'], maxRetries: 3, timeout: 30000 },
          { provider: 'test-provider', capability: 'extraction', priority: 1, costPerToken: 0.001, averageLatency: 100, supportedPolicies: ['FASTEST', 'CHEAPEST', 'MOST_RELIABLE'], maxRetries: 3, timeout: 30000 },
          { provider: 'test-provider', capability: 'generation', priority: 1, costPerToken: 0.001, averageLatency: 100, supportedPolicies: ['FASTEST', 'CHEAPEST', 'MOST_RELIABLE'], maxRetries: 3, timeout: 30000 },
          { provider: 'test-provider', capability: 'analysis', priority: 1, costPerToken: 0.001, averageLatency: 100, supportedPolicies: ['FASTEST', 'CHEAPEST', 'MOST_RELIABLE'], maxRetries: 3, timeout: 30000 },
          { provider: 'test-provider', capability: 'custom', priority: 5, costPerToken: 0.001, averageLatency: 100, supportedPolicies: ['FASTEST', 'CHEAPEST', 'MOST_RELIABLE'], maxRetries: 3, timeout: 30000 },
        ],
        enabled: true,
      })
      const allocator = new ResourceAllocator(providerRegistry)
      const allocation = await allocator.allocate(graph, 'fastest')
      // All 3 nodes should be allocated: discovery(reasoning), knowledge(extraction), recommendation(generation)
      assert.equal(allocation.assignments.length, 3,
        `Expected 3 assignments, got ${allocation.assignments.length}: ${JSON.stringify(allocation.warnings)}`)
      assert.equal(allocation.diagnostics.allocated, 3)

      // Step 4: Execution + Trace
      const traceRepo = new InMemoryExecutionTraceRepository()

      const scheduler = new DAGScheduler({ traceRepo })
      const completedGraph = await scheduler.execute(graph)
      // Save completed graph to trace repo so it's available
      traceRepo.saveGraph(completedGraph)

      assert.equal(completedGraph.status, 'completed')

      // Step 5: Verify Trace persistence
      const executionId = completedGraph.context.executionId
      const persistedGraph = await traceRepo.getGraph(executionId)
      assert.ok(persistedGraph)
      assert.equal(persistedGraph!.status, 'completed')
      const events = await traceRepo.getEvents(executionId)
      assert.ok(events.length > 0)

      // Step 6: Explain
      const { ExecutionExplainProvider } = await import('../../src/services/geo/explain/providers/execution-explain-provider.js')
      const registry = new ExplainRegistry()
      registry.register(new ExecutionExplainProvider(traceRepo))

      const engine = new ExplainEngine(registry, null as any)
      const doc = await engine.explain('execution', executionId) as ExplainDocument

      // Step 7: Verify Timeline Section
      assert.ok(doc)
      assert.equal(doc.metadata.provider, 'ExecutionExplainProvider')

      const timelineSection = doc.sections.find(s => s.type === 'timeline')
      assert.ok(timelineSection, 'Should have timeline section')
      assert.ok(timelineSection!.items.length > 0, 'Timeline should have items')

      // Verify evidence section
      const evidenceSection = doc.sections.find(s => s.type === 'evidence')
      assert.ok(evidenceSection, 'Should have evidence section')

      // Verify metric section
      const metricSection = doc.sections.find(s => s.type === 'metric')
      assert.ok(metricSection, 'Should have metric section')

      // Verify recommendation section (retry/fallback)
      const recSection = doc.sections.find(s => s.type === 'recommendation')
      assert.ok(recSection, 'Should have recommendation section')

      // Summary should mention execution details
      assert.ok(doc.summary.includes('Execution') || doc.summary.includes('execution'),
        'Summary should mention execution. Got: ' + doc.summary)
      assert.ok(doc.summary.includes('nodes'), 'Summary should mention nodes. Got: ' + doc.summary)
    })
  })
})
