// ============================================================
// RC2-3b — Fallback Graph Tests
// 8 个 spec 场景
// ============================================================

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { FallbackResolver, createDefaultFallbackConfig } from '../../src/services/geo/execution/fallback/fallback-resolver'
import type { ExecutionNode, ExecutionGraph, ExecutionContext } from '../../src/services/geo/execution/types'
import type { ProviderRegistration, ProviderCapability } from '../../src/services/geo/execution/provider/types'
import type { FallbackGraph } from '../../src/services/geo/execution/fallback/fallback.types'

// ─── Helpers ───

function createMockProvider(provider: string, capability: string, priority: number): ProviderRegistration {
  const cap: ProviderCapability = {
    provider,
    capability,
    priority,
    costPerToken: 0.01,
    averageLatency: 100,
    supportedPolicies: ['FASTEST'],
    maxRetries: 3,
    timeout: 30000,
  }
  return {
    provider,
    capabilities: [cap],
    enabled: true,
  }
}

function createMockNode(id: string, capability: string, provider?: string): ExecutionNode {
  return {
    id,
    label: id,
    type: 'discovery',
    capability,
    providerPolicy: 'FASTEST',
    config: {},
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
    artifact: provider ? {
      id: `art-${id}`,
      type: 'signal',
      payload: {},
      metadata: {
        nodeId: id,
        graphId: 'test-graph',
        provider,
        duration: 100,
        cost: 10,
        retryCount: 0,
      },
      createdAt: new Date().toISOString(),
    } : null,
    error: null,
  }
}

function createMockGraph(nodes: ExecutionNode[]): ExecutionGraph {
  const context: ExecutionContext = {
    executionId: 'test-exec-1',
    brandId: 'brand-1',
    tenantId: 'tenant-1',
    sourceType: 'manual',
    sourceId: 'src-1',
    variables: {},
    providerPolicy: 'FASTEST',
    metadata: {},
  }
  return {
    id: 'test-graph',
    nodes,
    edges: [],
    status: 'running',
    context,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createMockCB(allowed: string[] = []) {
  return {
    allowRequest: async (provider: string) => allowed.includes(provider),
  }
}

function captureNodeIds(graph: ExecutionGraph): string[] {
  return graph.nodes.map(n => n.id)
}

describe('RC2-3b: Fallback Graph', () => {
  const resolver = new FallbackResolver()

  // ─── 场景 1: 主备 fallback ───
  // B 失败，A→B→C，备选 P2
  // 预期: FallbackGraph with B2(P2)
  it('场景 1: 主备 fallback — 单备选', async () => {
    const nodeA = createMockNode('A', 'reasoning', 'P1')
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    const nodeC = createMockNode('C', 'summary', 'P3')
    nodeA.status = 'completed'
    nodeC.status = 'pending'
    nodeA.dependencies = []
    nodeB.dependencies = ['A']
    nodeC.dependencies = ['B']

    const graph = createMockGraph([nodeA, nodeB, nodeC])

    // 备选: P2 提供 reasoning 能力
    const providers = [
      createMockProvider('P2', 'reasoning', 10),
      createMockProvider('P4', 'search', 5), // 不匹配 capability
    ]

    const originalNodeIds = captureNodeIds(graph)

    const { fallbackGraph, events } = await resolver.resolve(
      nodeB,
      providers,
      graph,
    )

    // 验证 fallbackGraph 结构
    assert.strictEqual(fallbackGraph.originalNodeId, 'B')
    assert.strictEqual(fallbackGraph.fallbackNodes.length, 1)
    assert.strictEqual(fallbackGraph.fallbackNodes[0].provider, 'P2')
    assert.strictEqual(fallbackGraph.fallbackNodes[0].capability, 'reasoning')
    assert.strictEqual(fallbackGraph.fallbackNodes[0].fallbackLevel, 1)
    assert.strictEqual(fallbackGraph.status, 'pending')
    assert.strictEqual(fallbackGraph.selectedNodeId, fallbackGraph.fallbackNodes[0].id)

    // 验证 event
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].type, 'node_fallback')
    assert.strictEqual((events[0].data as any)?.fallbackProvider, 'P2')

    // 验证原始 DAG 不变
    assert.deepStrictEqual(captureNodeIds(graph), originalNodeIds)
  })

  // ─── 场景 2: 多级 fallback ───
  // B 失败，3 个备选
  // 预期: 2-level fallback chain（maxFallbackLevel=2）
  it('场景 2: 多级 fallback — 最多 maxFallbackLevel 个备选', async () => {
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    nodeB.status = 'failed'
    const graph = createMockGraph([nodeB])

    const providers = [
      createMockProvider('P2', 'reasoning', 10),
      createMockProvider('P3', 'reasoning', 20),
      createMockProvider('P4', 'reasoning', 30),
    ]

    const { fallbackGraph } = await resolver.resolve(
      nodeB,
      providers,
      graph,
      undefined,
      createDefaultFallbackConfig({ maxFallbackLevel: 2 }),
    )

    assert.strictEqual(fallbackGraph.fallbackNodes.length, 2)
    assert.strictEqual(fallbackGraph.fallbackNodes[0].provider, 'P2')
    assert.strictEqual(fallbackGraph.fallbackNodes[0].fallbackLevel, 1)
    assert.strictEqual(fallbackGraph.fallbackNodes[1].provider, 'P3')
    assert.strictEqual(fallbackGraph.fallbackNodes[1].fallbackLevel, 2)
  })

  // ─── 场景 3: CB 排除 ───
  // B 失败，P2 熔断，P3 正常
  // 预期: 跳过 P2，选中 P3
  it('场景 3: CB 排除 — 跳过熔断 provider', async () => {
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    nodeB.status = 'failed'
    const graph = createMockGraph([nodeB])

    const providers = [
      createMockProvider('P2', 'reasoning', 10),
      createMockProvider('P3', 'reasoning', 20),
    ]

    const circuitBreaker = createMockCB(['P3']) // P2 被熔断

    const { fallbackGraph } = await resolver.resolve(
      nodeB,
      providers,
      graph,
      circuitBreaker,
      createDefaultFallbackConfig({ maxFallbackLevel: 2, requireCircuitCheck: true }),
    )

    assert.strictEqual(fallbackGraph.fallbackNodes.length, 1)
    assert.strictEqual(fallbackGraph.fallbackNodes[0].provider, 'P3')
    assert.strictEqual(fallbackGraph.fallbackNodes[0].fallbackLevel, 1)
  })

  // ─── 场景 4: 无可用备选 ───
  // 所有备选都熔断
  // 预期: status=exhausted, events empty
  it('场景 4: 无可用备选 — 所有 provider 熔断', async () => {
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    nodeB.status = 'failed'
    const graph = createMockGraph([nodeB])

    const providers = [
      createMockProvider('P2', 'reasoning', 10),
      createMockProvider('P3', 'reasoning', 20),
    ]

    const circuitBreaker = createMockCB([]) // 全部熔断

    const { fallbackGraph, events } = await resolver.resolve(
      nodeB,
      providers,
      graph,
      circuitBreaker,
      createDefaultFallbackConfig({ maxFallbackLevel: 2, requireCircuitCheck: true }),
    )

    assert.strictEqual(fallbackGraph.status, 'exhausted')
    assert.strictEqual(fallbackGraph.fallbackNodes.length, 0)
    assert.strictEqual(events.length, 0) // exhausted 不产生 event
  })

  // ─── 场景 5: 全部 provider 已使用 ───
  // 所有 provider 都在图里
  // 预期: exhausted
  it('场景 5: 全部 provider 已使用 — 所有 provider 都在 DAG 中', async () => {
    const nodeA = createMockNode('A', 'search', 'P2')
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    const nodeC = createMockNode('C', 'summary', 'P3')
    nodeA.status = 'completed'
    nodeC.status = 'pending'
    nodeA.dependencies = []
    nodeB.dependencies = ['A']
    nodeC.dependencies = ['B']

    const graph = createMockGraph([nodeA, nodeB, nodeC])

    const providers = [
      createMockProvider('P2', 'reasoning', 10), // P2 已被 nodeA 使用
      createMockProvider('P3', 'reasoning', 20), // P3 已被 nodeC 使用
    ]

    const originalNodeIds = captureNodeIds(graph)

    const { fallbackGraph } = await resolver.resolve(
      nodeB,
      providers,
      graph,
    )

    assert.strictEqual(fallbackGraph.status, 'exhausted')
    assert.strictEqual(fallbackGraph.fallbackNodes.length, 0)

    // 验证原始 DAG 不变
    assert.deepStrictEqual(captureNodeIds(graph), originalNodeIds)
  })

  // ─── 场景 6: selectNext — B2 失败，B3 可用 ───
  it('场景 6: selectNext — 返回下一级 fallback', async () => {
    const fallbackGraph: FallbackGraph = {
      id: 'fb-test',
      originalNodeId: 'B',
      fallbackNodes: [
        { id: 'fb-1', originalNodeId: 'B', provider: 'P2', capability: 'reasoning', fallbackLevel: 1, priority: 10 },
        { id: 'fb-2', originalNodeId: 'B', provider: 'P3', capability: 'reasoning', fallbackLevel: 2, priority: 20 },
      ],
      selectedNodeId: 'fb-1',
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    const { nextNode, events } = await resolver.selectNext(fallbackGraph)

    assert.ok(nextNode !== null)
    assert.strictEqual(nextNode!.id, 'fb-2')
    assert.strictEqual(nextNode!.provider, 'P3')
    assert.strictEqual(nextNode!.fallbackLevel, 2)
    assert.strictEqual(fallbackGraph.selectedNodeId, 'fb-2')
    assert.strictEqual(fallbackGraph.status, 'active')
    assert.strictEqual(events.length, 1)
    assert.strictEqual(events[0].type, 'node_fallback')
  })

  // ─── 场景 7: selectNext — 无可用 ───
  it('场景 7: selectNext — 全部 fallback 耗尽', async () => {
    const fallbackGraph: FallbackGraph = {
      id: 'fb-test',
      originalNodeId: 'B',
      fallbackNodes: [
        { id: 'fb-1', originalNodeId: 'B', provider: 'P2', capability: 'reasoning', fallbackLevel: 1, priority: 10 },
      ],
      selectedNodeId: 'fb-1',
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    // 唯一 fallback B2 已失败，selectNext 应返回 null（耗尽）
    const { nextNode, events } = await resolver.selectNext(fallbackGraph)
    assert.strictEqual(nextNode, null)
    assert.strictEqual(fallbackGraph.status, 'exhausted')
    assert.strictEqual(events.length, 0)

    // status 已经是 exhausted，再选一次 — 仍返回 null
    const { nextNode: next2, events: events2 } = await resolver.selectNext(fallbackGraph)
    assert.strictEqual(next2, null)
    assert.strictEqual(fallbackGraph.status, 'exhausted')
    assert.strictEqual(events2.length, 0)
  })

  // ─── 场景 8: 不修改原始 DAG ───
  it('场景 8: 不修改原始 DAG — 对所有类型验证', async () => {
    const nodeA = createMockNode('A', 'reasoning', 'P1')
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    nodeA.status = 'completed'
    nodeA.dependencies = []
    nodeB.dependencies = ['A']

    const graph = createMockGraph([nodeA, nodeB])
    const originalNodeIds = graph.nodes.map(n => n.id)

    const providers = [
      createMockProvider('P2', 'reasoning', 10),
    ]

    // resolve 不应修改原始 DAG
    const { fallbackGraph } = await resolver.resolve(nodeB, providers, graph)

    // 验证原始节点数和 ID 不变
    assert.strictEqual(graph.nodes.length, 2)
    assert.deepStrictEqual(captureNodeIds(graph), originalNodeIds)

    // 验证每个原始节点的内容不变
    assert.strictEqual(graph.nodes[0].id, 'A')
    assert.strictEqual(graph.nodes[0].capability, 'reasoning')
    assert.strictEqual(graph.nodes[1].id, 'B')
    assert.strictEqual(graph.nodes[1].capability, 'reasoning')

    // selectNext 不应修改原始 DAG
    await resolver.selectNext(fallbackGraph)
    assert.strictEqual(graph.nodes.length, 2)
    assert.deepStrictEqual(captureNodeIds(graph), originalNodeIds)
  })

  // ─── 附加: 排除与原始节点同 provider ───
  it('附加: 排除和原始节点相同的 provider', async () => {
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    nodeB.status = 'failed'
    const graph = createMockGraph([nodeB])

    const providers = [
      createMockProvider('P1', 'reasoning', 10), // 与原始节点相同，应排除
      createMockProvider('P2', 'reasoning', 20),
    ]

    const { fallbackGraph } = await resolver.resolve(
      nodeB,
      providers,
      graph,
    )

    assert.strictEqual(fallbackGraph.fallbackNodes.length, 1)
    assert.strictEqual(fallbackGraph.fallbackNodes[0].provider, 'P2')
  })

  // ─── 附加: requireCircuitCheck=false ───
  it('附加: requireCircuitCheck=false 时跳过 CB 检查', async () => {
    const nodeB = createMockNode('B', 'reasoning', 'P1')
    nodeB.status = 'failed'
    const graph = createMockGraph([nodeB])

    const providers = [
      createMockProvider('P2', 'reasoning', 10),
      createMockProvider('P3', 'reasoning', 20),
    ]

    // CB 全部拒绝，但 config 禁用 CB 检查
    const circuitBreaker = createMockCB([])
    const { fallbackGraph } = await resolver.resolve(
      nodeB,
      providers,
      graph,
      circuitBreaker,
      createDefaultFallbackConfig({ requireCircuitCheck: false }),
    )

    // 仍应得到 2 个 fallback nodes（因为跳过 CB 检查）
    assert.strictEqual(fallbackGraph.fallbackNodes.length, 2)
    assert.strictEqual(fallbackGraph.status, 'pending')
  })

  // ─── 附加: selectNext 从 pending 状态启动 ───
  it('附加: selectNext 从 pending 状态启动', async () => {
    const fallbackGraph: FallbackGraph = {
      id: 'fb-test',
      originalNodeId: 'B',
      fallbackNodes: [
        { id: 'fb-1', originalNodeId: 'B', provider: 'P2', capability: 'reasoning', fallbackLevel: 1, priority: 10 },
        { id: 'fb-2', originalNodeId: 'B', provider: 'P3', capability: 'reasoning', fallbackLevel: 2, priority: 20 },
      ],
      selectedNodeId: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    const { nextNode, events } = await resolver.selectNext(fallbackGraph)

    assert.ok(nextNode !== null)
    assert.strictEqual(nextNode!.id, 'fb-1')
    assert.strictEqual(fallbackGraph.status, 'active')
    assert.strictEqual(fallbackGraph.selectedNodeId, 'fb-1')
    assert.strictEqual(events.length, 1)
  })
})
