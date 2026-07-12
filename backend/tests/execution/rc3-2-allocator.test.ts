// ============================================================
// RC3-2 — Resource Allocator 测试
// ============================================================
// 覆盖场景:
//   1. Fastest 策略 — 选择 latency 最低的 Provider
//   2. Cheapest 策略 — 选择 cost 最低的 Provider
//   3. Balanced 策略 — 加权评分选择
//   4. 无匹配能力 — 产生 CAPABILITY_NOT_FOUND 警告
//   5. 多个节点 — 每个节点独立分配
//   6. Diagnostics — 正确统计 allocated/unallocated
//   7. 自定义策略注册 — registerStrategy 生效
//   8. Graph 完整分配 — 端到端：Planner → Allocator
//   9. Health 集成 — healthMap 影响分配

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'

// ── RC3-2 模块 ──

import { ResourceAllocator } from '../../src/services/geo/execution/resource/resource-allocator'
import type { ExecutionAssignment, AllocationResult, AllocationDiagnostic } from '../../src/services/geo/execution/resource/resource.types'
import type { IAllocationStrategy, AllocationContext } from '../../src/services/geo/execution/resource/strategies/strategy.interface'
import { FastestStrategy } from '../../src/services/geo/execution/resource/strategies/fastest.strategy'
import { CheapestStrategy } from '../../src/services/geo/execution/resource/strategies/cheapest.strategy'
import { BalancedStrategy } from '../../src/services/geo/execution/resource/strategies/balanced.strategy'

// ── 依赖模块 ──

import { ProviderRegistry } from '../../src/services/geo/execution/provider/provider-registry'
import type { ProviderRegistration, ProviderCapability } from '../../src/services/geo/execution/provider/types'
import type { ProviderHealth } from '../../src/services/geo/execution/provider/provider-health'
import type { ExecutionGraph, ExecutionNode, ExecutionEdge, ExecutionContext } from '../../src/services/geo/execution/types'
import { DEFAULT_RETRY_CONFIG } from '../../src/services/geo/execution/types'
import { ExecutionPlanner } from '../../src/services/geo/execution/planner/planner'
import type { PlanningRequest, PlanningStep } from '../../src/services/geo/execution/planner/planner.types'
import { createExecutionContext } from '../../src/services/geo/execution/context'

// ============================================================
// 辅助函数：创建测试 Provider
// ============================================================

function makeProvider(
  name: string,
  capabilities: Array<{ capability: string; priority: number; costPerToken: number; averageLatency: number }>,
  enabled = true,
): ProviderRegistration {
  return {
    provider: name,
    capabilities: capabilities.map(c => ({
      provider: name,
      capability: c.capability,
      priority: c.priority,
      costPerToken: c.costPerToken,
      averageLatency: c.averageLatency,
      supportedPolicies: ['FASTEST', 'CHEAPEST', 'MOST_RELIABLE'],
      maxRetries: 3,
      timeout: 30000,
    })),
    enabled,
  }
}

function makeHealth(overrides: Partial<ProviderHealth> = {}): ProviderHealth {
  return {
    provider: overrides.provider ?? 'unknown',
    status: overrides.status ?? 'healthy',
    latencyP50: overrides.latencyP50 ?? 100,
    latencyP99: overrides.latencyP99 ?? 500,
    errorRate: overrides.errorRate ?? 0.01,
    successCount: overrides.successCount ?? 1000,
    failureCount: overrides.failureCount ?? 10,
    lastChecked: overrides.lastChecked ?? new Date().toISOString(),
  }
}

function makeTestNode(
  id: string,
  capability: string,
  dependencies: string[] = [],
): ExecutionNode {
  return {
    id,
    label: `node-${id}`,
    type: 'mission',
    capability,
    providerPolicy: 'FASTEST',
    config: {},
    status: 'pending',
    retryConfig: { ...DEFAULT_RETRY_CONFIG },
    timeout: 30000,
    dependencies,
    artifact: null,
    error: null,
    startedAt: null,
    completedAt: null,
  }
}

function makeTestGraph(id: string, nodes: ExecutionNode[], edges: ExecutionEdge[] = []): ExecutionGraph {
  return {
    id,
    nodes,
    edges,
    status: 'pending',
    context: createExecutionContext({
      brandId: 'test-brand',
      tenantId: 'test-tenant',
      sourceType: 'test',
      sourceId: 'test-source',
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ============================================================
// 1. Fastest 策略 — 选择 latency 最低的 Provider
// ============================================================

describe('RC3-2: Fastest Strategy', () => {
  it('should select provider with lowest latencyP50', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 500 }]))
    registry.register(makeProvider('provider-b', [{ capability: 'reasoning', priority: 2, costPerToken: 0.02, averageLatency: 100 }]))
    registry.register(makeProvider('provider-c', [{ capability: 'reasoning', priority: 3, costPerToken: 0.03, averageLatency: 300 }]))

    const healthMap = new Map<string, ProviderHealth>()
    healthMap.set('provider-a', makeHealth({ provider: 'provider-a', latencyP50: 500 }))
    healthMap.set('provider-b', makeHealth({ provider: 'provider-b', latencyP50: 100 }))
    healthMap.set('provider-c', makeHealth({ provider: 'provider-c', latencyP50: 300 }))

    const strategy = new FastestStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'reasoning'),
      candidates: registry.getProvidersByCapability('reasoning'),
      healthMap,
      policy: 'fastest',
    })

    assert.ok(result, 'Should return a result')
    assert.strictEqual(result!.provider, 'provider-b', 'Should pick provider-b (lowest latency)')
    assert.strictEqual(result!.reason, 'fastest')
  })

  it('should fallback to averageLatency when no health data', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'search', priority: 1, costPerToken: 0.01, averageLatency: 200 }]))
    registry.register(makeProvider('provider-b', [{ capability: 'search', priority: 2, costPerToken: 0.01, averageLatency: 50 }]))

    const strategy = new FastestStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'search'),
      candidates: registry.getProvidersByCapability('search'),
      healthMap: new Map(),
      policy: 'fastest',
    })

    assert.ok(result)
    assert.strictEqual(result!.provider, 'provider-b', 'Should pick provider-b (lower averageLatency)')
  })

  it('should return null when no candidates', async () => {
    const strategy = new FastestStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'missing-capability'),
      candidates: [],
      healthMap: new Map(),
      policy: 'fastest',
    })
    assert.strictEqual(result, null)
  })
})

// ============================================================
// 2. Cheapest 策略 — 选择 cost 最低的 Provider
// ============================================================

describe('RC3-2: Cheapest Strategy', () => {
  it('should select provider with lowest costPerToken', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'generation', priority: 1, costPerToken: 0.05, averageLatency: 200 }]))
    registry.register(makeProvider('provider-b', [{ capability: 'generation', priority: 2, costPerToken: 0.01, averageLatency: 500 }]))
    registry.register(makeProvider('provider-c', [{ capability: 'generation', priority: 3, costPerToken: 0.03, averageLatency: 300 }]))

    const strategy = new CheapestStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'generation'),
      candidates: registry.getProvidersByCapability('generation'),
      healthMap: new Map(),
      policy: 'cheapest',
    })

    assert.ok(result)
    assert.strictEqual(result!.provider, 'provider-b', 'Should pick provider-b (lowest cost)')
    assert.strictEqual(result!.reason, 'cheapest')
  })
})

// ============================================================
// 3. Balanced 策略 — 加权评分选择
// ============================================================

describe('RC3-2: Balanced Strategy', () => {
  it('should select provider with best weighted score', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'summary', priority: 1, costPerToken: 0.01, averageLatency: 10 }]))
    registry.register(makeProvider('provider-b', [{ capability: 'summary', priority: 2, costPerToken: 0.10, averageLatency: 500 }]))

    const healthMap = new Map<string, ProviderHealth>()
    healthMap.set('provider-a', makeHealth({ provider: 'provider-a', latencyP50: 10, errorRate: 0.01 }))
    healthMap.set('provider-b', makeHealth({ provider: 'provider-b', latencyP50: 500, errorRate: 0.40 }))

    const strategy = new BalancedStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'summary'),
      candidates: registry.getProvidersByCapability('summary'),
      healthMap,
      policy: 'balanced',
    })

    assert.ok(result)
    // provider-a has lower latency, lower error rate, lower cost — should win
    assert.strictEqual(result!.provider, 'provider-a')
    assert.strictEqual(result!.reason, 'balanced')
  })

  it('should handle edge case with all zeros', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'test', priority: 1, costPerToken: 0, averageLatency: 0 }]))

    const strategy = new BalancedStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'test'),
      candidates: registry.getProvidersByCapability('test'),
      healthMap: new Map(),
      policy: 'balanced',
    })

    // Should not crash and should return the only provider
    assert.ok(result)
    assert.strictEqual(result!.provider, 'provider-a')
  })

  it('should return null when no candidates', async () => {
    const strategy = new BalancedStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'nope'),
      candidates: [],
      healthMap: new Map(),
      policy: 'balanced',
    })
    assert.strictEqual(result, null)
  })
})

// ============================================================
// 4. 无匹配能力 — 产生 CAPABILITY_NOT_FOUND 警告
// ============================================================

describe('RC3-2: Capability Not Found Warning', () => {
  it('should emit CAPABILITY_NOT_FOUND warning for unmatched capability', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 100 }]))

    const allocator = new ResourceAllocator(registry)
    const graph = makeTestGraph('g1', [
      makeTestNode('n1', 'some-nonexistent-capability'),
    ])

    const result = await allocator.allocate(graph, 'fastest')

    assert.strictEqual(result.assignments.length, 0, 'No assignments for unknown capability')
    assert.ok(result.warnings.length > 0, 'Should have warnings')
    assert.strictEqual(result.warnings[0].code, 'CAPABILITY_NOT_FOUND')
    assert.strictEqual(result.warnings[0].nodeId, 'n1')
    assert.strictEqual(result.diagnostics.allocated, 0)
    assert.strictEqual(result.diagnostics.unallocated, 1)
  })
})

// ============================================================
// 5. 多个节点 — 每个节点独立分配
// ============================================================

describe('RC3-2: Multiple Nodes Allocation', () => {
  it('should allocate each node independently', async () => {
    const registry = new ProviderRegistry()
    // provider-a 擅长 reasoning
    registry.register(makeProvider('provider-a', [
      { capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 100 },
      { capability: 'search', priority: 2, costPerToken: 0.02, averageLatency: 200 },
    ]))
    // provider-b 擅长 search
    registry.register(makeProvider('provider-b', [
      { capability: 'reasoning', priority: 3, costPerToken: 0.03, averageLatency: 500 },
      { capability: 'search', priority: 1, costPerToken: 0.01, averageLatency: 50 },
    ]))

    const allocator = new ResourceAllocator(registry)
    const graph = makeTestGraph('multi-node', [
      makeTestNode('n1', 'reasoning'),
      makeTestNode('n2', 'search'),
    ])

    const result = await allocator.allocate(graph, 'fastest')

    assert.strictEqual(result.assignments.length, 2, 'Both nodes should be assigned')
    assert.strictEqual(result.diagnostics.allocated, 2)

    // n1 should be provider-a (latency 100 < 500)
    const n1Assignment = result.assignments.find(a => a.nodeId === 'n1')
    assert.ok(n1Assignment)
    assert.strictEqual(n1Assignment!.assignedTo, 'provider-a')

    // n2 should be provider-b (latency 50 < 200)
    const n2Assignment = result.assignments.find(a => a.nodeId === 'n2')
    assert.ok(n2Assignment)
    assert.strictEqual(n2Assignment!.assignedTo, 'provider-b')
  })
})

// ============================================================
// 6. Diagnostics — 正确统计 allocated/unallocated
// ============================================================

describe('RC3-2: Diagnostics', () => {
  it('should correctly report allocated/unallocated counts', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [
      { capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 100 },
    ]))

    const allocator = new ResourceAllocator(registry)
    const graph = makeTestGraph('diag-test', [
      makeTestNode('n1', 'reasoning'),   // can be allocated
      makeTestNode('n2', 'reasoning'),   // can be allocated
      makeTestNode('n3', 'no-such-cap'), // cannot be allocated
    ])

    const result = await allocator.allocate(graph, 'fastest')

    assert.strictEqual(result.diagnostics.totalNodes, 3)
    assert.strictEqual(result.diagnostics.allocated, 2)
    assert.strictEqual(result.diagnostics.unallocated, 1)
    assert.strictEqual(result.diagnostics.strategyUsed, 'fastest')
    assert.ok(result.diagnostics.duration >= 0, 'Duration should be non-negative')
    assert.strictEqual(result.graphId, 'diag-test')
    assert.ok(result.createdAt, 'Should have createdAt timestamp')
    assert.ok(result.requestId.startsWith('alloc-'))
  })
})

// ============================================================
// 7. 自定义策略注册 — registerStrategy 生效
// ============================================================

describe('RC3-2: Custom Strategy Registration', () => {
  it('should use custom registered strategy', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'custom-cap', priority: 1, costPerToken: 0.01, averageLatency: 100 }]))

    // 自定义策略：总是选 'always-this-provider'（如果存在）
    class AlwaysPickAStrategy implements IAllocationStrategy {
      name = 'always-pick-a'
      async allocate(_context: AllocationContext) {
        return { provider: 'provider-a', priority: 1, reason: 'always-pick-a' }
      }
    }

    const allocator = new ResourceAllocator(registry)
    allocator.registerStrategy('always-pick-a', new AlwaysPickAStrategy())

    const graph = makeTestGraph('custom-strategy', [
      makeTestNode('n1', 'custom-cap'),
    ])

    const result = await allocator.allocate(graph, 'always-pick-a')

    assert.strictEqual(result.assignments.length, 1)
    assert.strictEqual(result.assignments[0].assignedTo, 'provider-a')
    assert.strictEqual(result.assignments[0].reason, 'always-pick-a')
    assert.strictEqual(result.strategy, 'always-pick-a')
    assert.strictEqual(result.diagnostics.strategyUsed, 'always-pick-a')
  })
})

// ============================================================
// 8. Graph 完整分配 — 端到端：Planner → Allocator
// ============================================================

describe('RC3-2: End-to-End Planner → Allocator', () => {
  it('should allocate resources for a planner-generated graph', async () => {
    // 1. Planner 生成 Graph
    const planner = new ExecutionPlanner()
    const request: PlanningRequest = {
      id: 'e2e-test-1',
      sourceType: 'mission',
      sourceId: 'mission-1',
      brandId: 'brand-a',
      tenantId: 'tenant-a',
      priority: 'normal',
      providerPolicy: 'FASTEST',
      metadata: {},
      steps: [
        {
          id: 's1',
          label: 'Discovery',
          type: 'discovery',
          capability: 'reasoning',
          dependsOn: [],
          config: {},
          timeout: 30000,
        },
        {
          id: 's2',
          label: 'Knowledge',
          type: 'knowledge',
          capability: 'search',
          dependsOn: ['s1'],
          config: {},
          timeout: 30000,
        },
      ],
    }

    const { graph } = await planner.plan(request)
    assert.ok(graph.nodes.length === 2, 'Planner should produce 2 nodes')

    // 2. 注册 Provider
    const registry = new ProviderRegistry()
    registry.register(makeProvider('deepseek', [
      { capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 100 },
      { capability: 'search', priority: 2, costPerToken: 0.02, averageLatency: 200 },
    ]))
    registry.register(makeProvider('chatgpt', [
      { capability: 'reasoning', priority: 2, costPerToken: 0.03, averageLatency: 150 },
      { capability: 'search', priority: 1, costPerToken: 0.01, averageLatency: 80 },
    ]))

    // 3. Allocator 分配
    const allocator = new ResourceAllocator(registry)
    const result = await allocator.allocate(graph, 'fastest')

    assert.strictEqual(result.diagnostics.totalNodes, 2)
    assert.strictEqual(result.diagnostics.allocated, 2)
    assert.strictEqual(result.diagnostics.unallocated, 0)
    assert.strictEqual(result.strategy, 'fastest')

    // s1 (reasoning): deepseek latency 100 < chatgpt 150 → deepseek
    const s1 = result.assignments.find(a => a.nodeId === 's1')
    assert.ok(s1)
    assert.strictEqual(s1!.assignedTo, 'deepseek', 'reasoning should go to deepseek (faster)')

    // s2 (search): chatgpt latency 80 < deepseek 200 → chatgpt
    const s2 = result.assignments.find(a => a.nodeId === 's2')
    assert.ok(s2)
    assert.strictEqual(s2!.assignedTo, 'chatgpt', 'search should go to chatgpt (faster)')
  })
})

// ============================================================
// 9. Health 集成 — healthMap 影响分配
// ============================================================

describe('RC3-2: Health Integration', () => {
  it('should use health latencyP50 for fastest strategy', async () => {
    const registry = new ProviderRegistry()
    // provider-a 注册 latency 很低，但 health 显示 latency 很高
    registry.register(makeProvider('provider-a', [{ capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 10 }]))
    // provider-b 注册 latency 很高，但 health 显示 latency 很低
    registry.register(makeProvider('provider-b', [{ capability: 'reasoning', priority: 2, costPerToken: 0.02, averageLatency: 1000 }]))

    const healthMap = new Map<string, ProviderHealth>()
    healthMap.set('provider-a', makeHealth({ provider: 'provider-a', latencyP50: 800 }))
    healthMap.set('provider-b', makeHealth({ provider: 'provider-b', latencyP50: 50 }))

    const strategy = new FastestStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'reasoning'),
      candidates: registry.getProvidersByCapability('reasoning'),
      healthMap,
      policy: 'fastest',
    })

    assert.ok(result)
    // healthMap overrides: provider-b has lower latency (50 vs 800)
    assert.strictEqual(result!.provider, 'provider-b')
  })

  it('should use health errorRate for balanced strategy', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 100 }]))
    registry.register(makeProvider('provider-b', [{ capability: 'reasoning', priority: 2, costPerToken: 0.02, averageLatency: 100 }]))

    const healthMap = new Map<string, ProviderHealth>()
    healthMap.set('provider-a', makeHealth({ provider: 'provider-a', latencyP50: 100, errorRate: 0.50 }))
    healthMap.set('provider-b', makeHealth({ provider: 'provider-b', latencyP50: 100, errorRate: 0.01 }))

    const strategy = new BalancedStrategy()
    const result = await strategy.allocate({
      node: makeTestNode('n1', 'reasoning'),
      candidates: registry.getProvidersByCapability('reasoning'),
      healthMap,
      policy: 'balanced',
    })

    assert.ok(result)
    // provider-b has same latency & cost but much lower error rate → should win
    assert.strictEqual(result!.provider, 'provider-b')
  })

  it('should allocate with health service integration', async () => {
    const registry = new ProviderRegistry()
    registry.register(makeProvider('provider-a', [{ capability: 'reasoning', priority: 1, costPerToken: 0.01, averageLatency: 500 }]))
    registry.register(makeProvider('provider-b', [{ capability: 'reasoning', priority: 2, costPerToken: 0.02, averageLatency: 100 }]))

    // Mock health service
    const healthMap = new Map<string, ProviderHealth>()
    healthMap.set('provider-a', makeHealth({ provider: 'provider-a', latencyP50: 50 }))
    healthMap.set('provider-b', makeHealth({ provider: 'provider-b', latencyP50: 500 }))

    const mockHealthService = {
      getAllHealth: async () => healthMap,
    }

    const allocator = new ResourceAllocator(registry, mockHealthService)
    const graph = makeTestGraph('health-integration', [
      makeTestNode('n1', 'reasoning'),
    ])

    const result = await allocator.allocate(graph, 'fastest')

    assert.strictEqual(result.assignments.length, 1)
    // provider-a has better health latency (50) despite worse registered latency (500)
    assert.strictEqual(result.assignments[0].assignedTo, 'provider-a')
  })
})
