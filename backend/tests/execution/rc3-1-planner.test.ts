// ============================================================
// RC3-1 — Execution Planner 测试
// ============================================================
// 覆盖场景:
//   1. Mission → ExecutionGraph (完整转换流程)
//   2. Dependency Builder (手动依赖 / 自动推断 / 空依赖)
//   3. Graph Validator — 正常图
//   4. Graph Validator — 空图 (EMPTY_GRAPH)
//   5. Graph Validator — 环检测 (CYCLE_DETECTED)
//   6. Graph Validator — 缺失依赖 (MISSING_DEPENDENCY)
//   7. Graph Validator — 自依赖 (SELF_DEPENDENCY)
//   8. Graph Validator — 警告 (UNKNOWN_NODE_TYPE / NODE_WITHOUT_DEPENDENCIES)
//   9. PlanningRequest (非 Mission) — verification / manual
//  10. 生成的 ExecutionGraph 可直接交给 Runtime

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'

// ── RC3-1 模块 ──

import { ExecutionPlanner } from '../../src/services/geo/execution/planner/planner'
import type { IExecutionPlanner } from '../../src/services/geo/execution/planner/planner'
import { DependencyBuilder } from '../../src/services/geo/execution/planner/dependency-builder'
import { GraphValidator } from '../../src/services/geo/execution/planner/graph-validator'
import type {
  PlanningRequest,
  PlanningStep,
} from '../../src/services/geo/execution/planner/planner.types'
import { MissionExecutionAdapter } from '../../src/services/geo/execution/adapters/mission-adapter'
import type { Mission } from '../../src/services/geo/execution/adapters/mission-adapter'

// ── RC1 类型 ──

import type { ExecutionGraph } from '../../src/services/geo/execution/types'
import { DEFAULT_RETRY_CONFIG } from '../../src/services/geo/execution/types'
import { getReadyNodes } from '../../src/services/geo/execution/graph-helpers'

// ============================================================
// 1. Dependency Builder 测试
// ============================================================

void describe('DependencyBuilder', () => {
  const builder = new DependencyBuilder()

  void it('should build edges from manual dependencies', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
      { id: 'c', label: 'C', type: 'recommendation', capability: 'generation', dependsOn: ['a', 'b'], config: {} },
    ]

    const edges = builder.buildEdges(steps)

    assert.strictEqual(edges.length, 3)
    assert.deepStrictEqual(edges.filter(e => e.from === 'a' && e.to === 'b').length, 1)
    assert.deepStrictEqual(edges.filter(e => e.from === 'a' && e.to === 'c').length, 1)
    assert.deepStrictEqual(edges.filter(e => e.from === 'b' && e.to === 'c').length, 1)
  })

  void it('should skip missing dependencies', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['nonexistent'], config: {} },
    ]

    const edges = builder.buildEdges(steps)

    // buildEdges only adds edges for dependencies that exist in steps
    assert.strictEqual(edges.length, 0)
  })

  void it('should handle empty steps', () => {
    const edges = builder.buildEdges([])
    assert.strictEqual(edges.length, 0)
  })

  void it('should infer dependencies based on node types', () => {
    const steps: PlanningStep[] = [
      { id: 'd1', label: 'Discovery 1', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'k1', label: 'Knowledge 1', type: 'knowledge', capability: 'extraction', dependsOn: [], config: {} },
      { id: 'r1', label: 'Recommendation 1', type: 'recommendation', capability: 'generation', dependsOn: [], config: {} },
    ]

    const edges = builder.inferDependencies(steps)

    // knowledge → discovery, recommendation → discovery, recommendation → knowledge
    assert.ok(edges.length >= 3)
    assert.strictEqual(edges.filter(e => e.from === 'd1' && e.to === 'k1').length, 1) // knowledge → discovery
    assert.strictEqual(edges.filter(e => e.from === 'd1' && e.to === 'r1').length, 1) // recommendation → discovery
    assert.strictEqual(edges.filter(e => e.from === 'k1' && e.to === 'r1').length, 1) // recommendation → knowledge
  })

  void it('should not create duplicate edges when manual and inferred overlap', () => {
    const steps: PlanningStep[] = [
      { id: 'd1', label: 'D1', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'k1', label: 'K1', type: 'knowledge', capability: 'extraction', dependsOn: ['d1'], config: {} },
    ]

    const inferred = builder.inferDependencies(steps) // adds d1 → k1
    const manual = builder.buildEdges(steps)          // already has d1 → k1

    // Merge dedup
    const all = [...manual]
    for (const e of inferred) {
      if (!all.some((x) => x.from === e.from && x.to === e.to)) {
        all.push(e)
      }
    }

    assert.strictEqual(all.length, 1)
    assert.strictEqual(all[0].from, 'd1')
    assert.strictEqual(all[0].to, 'k1')
  })

  void it('should use custom inference rules', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'b', label: 'B', type: 'custom', capability: 'custom', dependsOn: [], config: {} },
    ]

    const rules = new Map()
    rules.set('custom', ['discovery'])

    const edges = builder.inferDependencies(steps, rules)
    assert.strictEqual(edges.length, 1)
    assert.strictEqual(edges[0].from, 'a')
    assert.strictEqual(edges[0].to, 'b')
  })

  void it('should return empty edges when no inference rules match', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'custom', capability: 'custom', dependsOn: [], config: {} },
    ]

    const edges = builder.inferDependencies(steps)
    assert.strictEqual(edges.length, 0)
  })
})

// ============================================================
// 2. Graph Validator 测试
// ============================================================

void describe('GraphValidator', () => {
  const validator = new GraphValidator()

  void it('should validate a normal DAG', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
      { id: 'c', label: 'C', type: 'recommendation', capability: 'generation', dependsOn: ['b'], config: {} },
    ]

    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]

    const result = validator.validate(steps, edges)

    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.errors.length, 0)
  })

  void it('should detect empty graph', () => {
    const result = validator.validate([], [])
    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.errors.length, 1)
    assert.strictEqual(result.errors[0].code, 'EMPTY_GRAPH')
  })

  void it('should detect cycle', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: ['c'], config: {} },
      { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
      { id: 'c', label: 'C', type: 'recommendation', capability: 'generation', dependsOn: ['b'], config: {} },
    ]

    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' }, // cycle!
    ]

    const result = validator.validate(steps, edges)

    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some((e) => e.code === 'CYCLE_DETECTED'))
  })

  void it('should detect missing dependency', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['nonexistent'], config: {} },
    ]

    const result = validator.validate(steps, [])

    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some((e) => e.code === 'MISSING_DEPENDENCY'))
    assert.strictEqual(result.errors.find(e => e.code === 'MISSING_DEPENDENCY')?.nodeId, 'b')
  })

  void it('should detect self-dependency', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: ['a'], config: {} },
    ]

    const result = validator.validate(steps, [])

    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some((e) => e.code === 'SELF_DEPENDENCY'))
    assert.strictEqual(result.errors.find(e => e.code === 'SELF_DEPENDENCY')?.nodeId, 'a')
  })

  void it('should warn about unknown node type', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'unknown_type' as any, capability: 'custom', dependsOn: [], config: {} },
    ]

    const result = validator.validate(steps, [])

    // unknown_type 不在 validTypes 中 → warning, 但 valid 仍为 true
    assert.strictEqual(result.valid, true)
    assert.ok(result.warnings.some((w) => w.code === 'UNKNOWN_NODE_TYPE'))
  })

  void it('should warn about nodes without dependencies', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
    ]

    const edges = [{ from: 'a', to: 'b' }]
    const result = validator.validate(steps, edges)

    // a is a root node with no incoming edges → warning
    assert.strictEqual(result.valid, true)
    assert.ok(result.warnings.some((w) => w.code === 'NODE_WITHOUT_DEPENDENCIES'))
  })

  void it('should accumulate multiple errors', () => {
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: ['a', 'b'], config: {} },
    ]

    const result = validator.validate(steps, [])

    // self-dependency + missing dependency (b)
    assert.strictEqual(result.valid, false)
    const codes = result.errors.map((e) => e.code)
    assert.ok(codes.includes('SELF_DEPENDENCY'))
    assert.ok(codes.includes('MISSING_DEPENDENCY'))
  })

  void it('should detect cycle in complex graph', () => {
    // A → B → C → D → A (cycle)
    const steps: PlanningStep[] = [
      { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
      { id: 'c', label: 'C', type: 'recommendation', capability: 'generation', dependsOn: ['b'], config: {} },
      { id: 'd', label: 'D', type: 'verification', capability: 'analysis', dependsOn: ['c'], config: {} },
    ]

    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
      { from: 'd', to: 'a' }, // cycle: a → b → c → d → a
    ]

    const result = validator.validate(steps, edges)

    assert.strictEqual(result.valid, false)
    assert.ok(result.errors.some((e) => e.code === 'CYCLE_DETECTED'))
  })
})

// ============================================================
// 3. ExecutionPlanner 测试
// ============================================================

void describe('ExecutionPlanner', () => {
  const planner: IExecutionPlanner = new ExecutionPlanner()

  void it('should produce valid ExecutionGraph from PlanningRequest', async () => {
    const request: PlanningRequest = {
      id: 'req-001',
      sourceType: 'manual',
      sourceId: 'src-001',
      brandId: 'brand-a',
      tenantId: 'tenant-a',
      priority: 'high',
      providerPolicy: 'FASTEST',
      steps: [
        {
          id: 'discover',
          label: 'Discover signals',
          type: 'discovery',
          capability: 'reasoning',
          dependsOn: [],
          config: { query: 'user trends' },
          retryConfig: DEFAULT_RETRY_CONFIG,
          timeout: 15000,
        },
        {
          id: 'analyze',
          label: 'Analyze knowledge',
          type: 'knowledge',
          capability: 'extraction',
          dependsOn: ['discover'],
          config: { depth: 'deep' },
        },
        {
          id: 'recommend',
          label: 'Generate recommendations',
          type: 'recommendation',
          capability: 'generation',
          dependsOn: ['analyze'],
          config: { limit: 5 },
        },
      ],
      metadata: { project: 'test' },
    }

    const { graph, result } = await planner.plan(request)

    // ── Graph ──

    assert.ok(graph, 'graph should be defined')
    assert.ok(graph.id, 'graph.id should be truthy')
    assert.strictEqual(graph.status, 'pending')
    assert.strictEqual(graph.nodes.length, 3)
    // Manual: discover→analyze, analyze→recommend
    // Inferred: discover→recommend (recommendation depends on discovery)
    // After dedup, all 3 edges are unique
    assert.strictEqual(graph.edges.length, 3)
    assert.ok(graph.context, 'context should be defined')
    assert.strictEqual(graph.context.brandId, 'brand-a')
    assert.strictEqual(graph.context.sourceType, 'manual')

    // 验证 node 结构
    for (const node of graph.nodes) {
      assert.strictEqual(node.status, 'pending')
      assert.strictEqual(node.artifact, null)
      assert.strictEqual(node.error, null)
      assert.strictEqual(node.startedAt, null)
      assert.strictEqual(node.completedAt, null)
      assert.strictEqual(typeof node.timeout, 'number')
      assert.ok(node.retryConfig, 'retryConfig should be defined')
      assert.strictEqual(node.providerPolicy, 'FASTEST')
    }

    // 验证 discover → analyze → recommend 链
    const discoverNode = graph.nodes.find((n) => n.id === 'discover')!
    const analyzeNode = graph.nodes.find((n) => n.id === 'analyze')!
    const recommendNode = graph.nodes.find((n) => n.id === 'recommend')!

    assert.strictEqual(discoverNode.dependencies.length, 0)
    assert.deepStrictEqual(analyzeNode.dependencies, ['discover'])
    assert.deepStrictEqual(recommendNode.dependencies, ['analyze'])

    // 验证定制配置
    assert.deepStrictEqual(discoverNode.config, { query: 'user trends' })
    assert.strictEqual(discoverNode.timeout, 15000)
    assert.deepStrictEqual(discoverNode.retryConfig, DEFAULT_RETRY_CONFIG)

    // ── Result ──

    assert.strictEqual(result.requestId, 'req-001')
    assert.strictEqual(result.sourceType, 'manual')
    assert.strictEqual(result.validation.valid, true)
    assert.strictEqual(result.graph.nodes.length, 3)
    assert.strictEqual(result.graph.edges.length, 3)
  })

  void it('should produce valid graph for normal dependencies (no cycle)', async () => {
    const request: PlanningRequest = {
      id: 'req-nocycle',
      sourceType: 'manual',
      sourceId: 'src-nocycle',
      brandId: 'brand-a',
      tenantId: 'tenant-a',
      priority: 'normal',
      providerPolicy: 'FASTEST',
      steps: [
        { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
        { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
      ],
      metadata: {},
    }

    const { result } = await planner.plan(request)
    assert.strictEqual(result.validation.valid, true)
  })

  void it('should handle single step request', async () => {
    const request: PlanningRequest = {
      id: 'req-single',
      sourceType: 'manual',
      sourceId: 'src-single',
      brandId: 'brand-a',
      tenantId: 'tenant-a',
      priority: 'low',
      providerPolicy: 'FASTEST',
      steps: [
        { id: 'only', label: 'Only step', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      ],
      metadata: {},
    }

    const { graph, result } = await planner.plan(request)

    assert.strictEqual(graph.nodes.length, 1)
    assert.strictEqual(graph.edges.length, 0)
    assert.strictEqual(result.validation.valid, true)
  })
})

// ============================================================
// 4. Mission Adapter 测试
// ============================================================

void describe('MissionExecutionAdapter', () => {
  const adapter = new MissionExecutionAdapter()

  void it('should convert mission to PlanningRequest', () => {
    const mission: Mission = {
      id: 'mission-001',
      brandId: 'brand-a',
      priority: 'high',
      steps: [
        { id: 'step-1', actionType: 'discovery', description: 'Discover signals', config: { topic: 'trends' } },
        { id: 'step-2', actionType: 'knowledge', description: 'Extract knowledge', config: {} },
        { id: 'step-3', actionType: 'recommendation', description: 'Generate recommendations', config: { limit: 5 } },
      ],
    }

    const request = adapter.toPlanningRequest(mission)

    assert.strictEqual(request.id, 'plan-mission-001')
    assert.strictEqual(request.sourceType, 'mission')
    assert.strictEqual(request.sourceId, 'mission-001')
    assert.strictEqual(request.brandId, 'brand-a')
    assert.strictEqual(request.priority, 'high')
    assert.strictEqual(request.providerPolicy, 'FASTEST')
    assert.strictEqual(request.steps.length, 3)

    // 验证依赖链: step-1 → step-2 → step-3
    assert.deepStrictEqual(request.steps[0].dependsOn, [])
    assert.deepStrictEqual(request.steps[1].dependsOn, ['step-1'])
    assert.deepStrictEqual(request.steps[2].dependsOn, ['step-2'])

    // 验证 capability 映射
    assert.strictEqual(request.steps[0].capability, 'reasoning')  // discovery → reasoning
    assert.strictEqual(request.steps[1].capability, 'extraction') // knowledge → extraction
    assert.strictEqual(request.steps[2].capability, 'generation') // recommendation → generation

    // 验证配置透传
    assert.deepStrictEqual(request.steps[0].config, { topic: 'trends' })
    assert.deepStrictEqual(request.steps[2].config, { limit: 5 })
  })

  void it('should handle single-step mission', () => {
    const mission: Mission = {
      id: 'm-single',
      brandId: 'brand-b',
      priority: 'low',
      steps: [
        { id: 's1', actionType: 'discovery', description: 'Single discovery', config: {} },
      ],
    }

    const request = adapter.toPlanningRequest(mission)

    assert.strictEqual(request.steps.length, 1)
    assert.deepStrictEqual(request.steps[0].dependsOn, [])
  })

  void it('should handle mission with custom action type', () => {
    const mission: Mission = {
      id: 'm-custom',
      brandId: 'brand-c',
      priority: 'normal',
      steps: [
        { id: 's1', actionType: 'custom_action', description: 'Custom', config: {} },
      ],
    }

    const request = adapter.toPlanningRequest(mission)

    assert.strictEqual(request.steps[0].capability, 'custom')
  })
})

// ============================================================
// 5. 完整集成: Mission → ExecutionGraph
// ============================================================

void describe('Mission → ExecutionGraph Integration', () => {
  const adapter = new MissionExecutionAdapter()
  const planner: IExecutionPlanner = new ExecutionPlanner()

  void it('should produce a Runtime-ready ExecutionGraph from a Mission', async () => {
    const mission: Mission = {
      id: 'mission-integration-001',
      brandId: 'brand-integration',
      priority: 'high',
      steps: [
        { id: 'd1', actionType: 'discovery', description: 'Discover trends', config: { topic: 'fashion' } },
        { id: 'k1', actionType: 'knowledge', description: 'Build knowledge', config: { depth: 'comprehensive' } },
        { id: 'v1', actionType: 'verification', description: 'Verify findings', config: {} },
        { id: 'p1', actionType: 'publishing', description: 'Publish report', config: { format: 'markdown' } },
      ],
    }

    // Step 1: Adapter → PlanningRequest
    const request = adapter.toPlanningRequest(mission)

    // Step 2: Planner → ExecutionGraph
    const { graph, result } = await planner.plan(request)

    // ── 验证 PlanningResult ──

    assert.strictEqual(result.requestId, 'plan-mission-integration-001')
    assert.strictEqual(result.sourceType, 'mission')
    assert.strictEqual(result.sourceId, 'mission-integration-001')
    assert.strictEqual(result.validation.valid, true)

    // ── 验证 ExecutionGraph 结构 ──

    assert.ok(graph.id)
    assert.strictEqual(graph.status, 'pending')
    assert.strictEqual(graph.nodes.length, 4)
    assert.ok(graph.edges.length >= 3) // manual edges + inferred edges

    // ── 验证节点类型 ──

    const nodeTypes = graph.nodes.map((n) => n.type)
    assert.ok(nodeTypes.includes('discovery'))
    assert.ok(nodeTypes.includes('knowledge'))
    assert.ok(nodeTypes.includes('verification'))
    assert.ok(nodeTypes.includes('publishing'))

    // ── 验证节点顺序依赖 (手动: 顺序链) ──

    const d1Node = graph.nodes.find((n) => n.id === 'd1')!
    const k1Node = graph.nodes.find((n) => n.id === 'k1')!
    const v1Node = graph.nodes.find((n) => n.id === 'v1')!
    const p1Node = graph.nodes.find((n) => n.id === 'p1')!

    assert.deepStrictEqual(d1Node.dependencies, [])
    assert.ok(k1Node.dependencies.includes('d1'))
    assert.ok(v1Node.dependencies.includes('k1'))
    assert.ok(p1Node.dependencies.includes('v1'))

    // ── 验证 providerPolicy 传播 ──

    for (const node of graph.nodes) {
      assert.strictEqual(node.providerPolicy, 'FASTEST')
    }

    // ── 验证 config 透传 ──

    assert.deepStrictEqual(d1Node.config, { topic: 'fashion' })
    assert.deepStrictEqual(k1Node.config, { depth: 'comprehensive' })
    assert.deepStrictEqual(p1Node.config, { format: 'markdown' })

    // ── 验证 retryConfig 和 timeout 默认值 ──

    for (const node of graph.nodes) {
      assert.deepStrictEqual(node.retryConfig, DEFAULT_RETRY_CONFIG)
      assert.strictEqual(node.timeout, 30000)
    }

    // ── 验证 Edge 结构 ──

    for (const edge of graph.edges) {
      assert.ok(edge.from)
      assert.ok(edge.to)
    }

    // ── 验证 Context ──

    assert.strictEqual(graph.context.brandId, 'brand-integration')
    assert.strictEqual(graph.context.sourceType, 'mission')
    assert.strictEqual(graph.context.sourceId, 'mission-integration-001')
    assert.deepStrictEqual(graph.context.variables, {})
  })
})

// ============================================================
// 6. Verification/Manual 来源测试
// ============================================================

void describe('Non-Mission PlanningRequest', () => {
  const planner: IExecutionPlanner = new ExecutionPlanner()

  void it('should handle verification source', async () => {
    const request: PlanningRequest = {
      id: 'verif-001',
      sourceType: 'verification',
      sourceId: 'verification-batch-1',
      brandId: 'brand-verif',
      tenantId: 'tenant-verif',
      priority: 'normal',
      providerPolicy: 'MOST_RELIABLE',
      steps: [
        {
          id: 'check',
          label: 'Check content',
          type: 'verification',
          capability: 'analysis',
          dependsOn: [],
          config: { rules: ['no_hate_speech', 'no_spam'] },
          timeout: 60000,
        },
      ],
      metadata: { batchId: 'batch-1' },
    }

    const { graph, result } = await planner.plan(request)

    assert.strictEqual(graph.context.sourceType, 'verification')
    assert.strictEqual(graph.nodes[0].type, 'verification')
    assert.strictEqual(graph.nodes[0].timeout, 60000)
    assert.strictEqual(result.validation.valid, true)
  })

  void it('should handle manual source', async () => {
    const request: PlanningRequest = {
      id: 'manual-001',
      sourceType: 'manual',
      sourceId: 'user-request-1',
      brandId: 'brand-manual',
      tenantId: 'tenant-manual',
      priority: 'high',
      providerPolicy: 'LOCAL_ONLY',
      steps: [
        {
          id: 'step-1',
          label: 'Custom step',
          type: 'custom',
          capability: 'custom',
          dependsOn: [],
          config: { customField: 'value' },
          retryConfig: { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 5000, jitter: false, useExponentialBackoff: false },
        },
      ],
      metadata: { userId: 'user-123' },
    }

    const { graph, result } = await planner.plan(request)

    assert.strictEqual(graph.context.sourceType, 'manual')
    assert.strictEqual(graph.nodes[0].type, 'custom')
    assert.strictEqual(graph.nodes[0].retryConfig.maxRetries, 1)
    assert.strictEqual(result.validation.valid, true)
  })
})

// ============================================================
// 7. Runtime 兼容性验证: 生成的 ExecutionGraph 可直接执行
// ============================================================

void describe('ExecutionGraph Runtime Compatibility', () => {
  const planner: IExecutionPlanner = new ExecutionPlanner()

  void it('should produce graph compatible with getReadyNodes', async () => {
    const request: PlanningRequest = {
      id: 'rt-001',
      sourceType: 'manual',
      sourceId: 'rt-src',
      brandId: 'brand-rt',
      tenantId: 'tenant-rt',
      priority: 'normal',
      providerPolicy: 'FASTEST',
      steps: [
        { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
        { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
        { id: 'c', label: 'C', type: 'recommendation', capability: 'generation', dependsOn: ['b'], config: {} },
      ],
      metadata: {},
    }

    const { graph } = await planner.plan(request)

    // 模拟调度器的准备工作: 将根节点设为 'queued'
    const queuedGraph: ExecutionGraph = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.dependencies.length === 0 ? { ...n, status: 'queued' as const } : n,
      ),
    }

    const readyNodes = getReadyNodes(queuedGraph)

    // 只有根节点 (a) 应该 ready
    assert.strictEqual(readyNodes.length, 1)
    assert.strictEqual(readyNodes[0].id, 'a')
  })

  void it('should produce graph with correct edge structure for Scheduler', async () => {
    const request: PlanningRequest = {
      id: 'rt-002',
      sourceType: 'manual',
      sourceId: 'rt-src-2',
      brandId: 'brand-rt',
      tenantId: 'tenant-rt',
      priority: 'normal',
      providerPolicy: 'FASTEST',
      steps: [
        { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
        { id: 'b', label: 'B', type: 'knowledge', capability: 'extraction', dependsOn: ['a'], config: {} },
      ],
      metadata: {},
    }

    const { graph } = await planner.plan(request)

    // Manual: a→b (from dependsOn). Inferred: discovery→knowledge (a→b, duplicate).
    // After dedup: only 1 unique edge
    assert.strictEqual(graph.edges.length, 1)
    // 确保边的方向正确
    for (const edge of graph.edges) {
      assert.ok(edge.from)
      assert.ok(edge.to)
    }
  })

  void it('should produce graph with valid status field for StateMachine', async () => {
    const request: PlanningRequest = {
      id: 'rt-003',
      sourceType: 'manual',
      sourceId: 'rt-src-3',
      brandId: 'brand-rt',
      tenantId: 'tenant-rt',
      priority: 'normal',
      providerPolicy: 'FASTEST',
      steps: [
        { id: 'a', label: 'A', type: 'discovery', capability: 'reasoning', dependsOn: [], config: {} },
      ],
      metadata: {},
    }

    const { graph } = await planner.plan(request)

    // 检查所有 node 的 status 是否为合法的 NodeStatus
    const validNodeStatuses = [
      'pending', 'queued', 'running', 'waiting_dependency',
      'retrying', 'fallback', 'cancelled', 'completed', 'failed', 'timeout',
    ]
    const validGraphStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled']

    assert.ok(validGraphStatuses.includes(graph.status))
    for (const node of graph.nodes) {
      assert.ok(validNodeStatuses.includes(node.status))
    }
  })
})
