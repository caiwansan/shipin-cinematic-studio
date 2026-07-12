// ============================================================
// RC3-3 — Prediction Layer 测试
// ============================================================
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import { StaticEstimator } from '../../src/services/geo/execution/prediction/static-estimator'
import { PredictionService } from '../../src/services/geo/execution/prediction/prediction.service'
import type { IEstimator } from '../../src/services/geo/execution/prediction/estimator.interface'
import type {
  EstimationResult,
  PredictionContext,
  NodeEstimate,
  ResourceSummary,
  CriticalPathAnalysis,
} from '../../src/services/geo/execution/prediction/prediction.types'
import type { ExecutionGraph } from '../../src/services/geo/execution/types'
import type { ExecutionAssignment } from '../../src/services/geo/execution/resource/resource.types'

// ─── Helpers ───

function createMockGraph(overrides: Partial<ExecutionGraph> = {}): ExecutionGraph {
  return {
    id: 'test-graph-1',
    nodes: [],
    edges: [],
    status: 'pending',
    context: {
      executionId: 'exec-1',
      brandId: 'brand-1',
      tenantId: 'tenant-1',
      sourceType: 'mission',
      sourceId: 'src-1',
      variables: {},
      providerPolicy: 'FASTEST',
      metadata: {},
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: undefined,
    ...overrides,
  }
}

function makeAssignment(
  nodeId: string,
  assignedTo: string,
  resourceType: string,
  capability: string = 'reasoning',
): ExecutionAssignment {
  return {
    nodeId,
    assignedTo,
    resourceType: resourceType as any,
    capability,
    priority: 1,
    reason: 'fastest',
  }
}

// ─── Tests ───

describe('RC3-3 — Prediction Layer', () => {
  // ─── Scene 1: NodeEstimate ───
  describe('NodeEstimate — 每个节点正确估算时间和成本', () => {
    it('llm_provider 使用 typeFactor 1.0', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [makeAssignment('n1', 'deepseek', 'llm_provider')],
        providerCostMap: new Map([['deepseek', 0.5]]),
        providerLatencyMap: new Map([['deepseek', 1000]]),
        nodeCount: 1,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      assert.strictEqual(result.nodeEstimates.length, 1)
      const ne = result.nodeEstimates[0]
      assert.strictEqual(ne.nodeId, 'n1')
      assert.strictEqual(ne.estimatedDuration, 1000 * 1.0) // latency * typeFactor
      assert.strictEqual(ne.estimatedCost, 500 * 0.5)       // tokens * costPerToken
      assert.strictEqual(ne.assignedProvider, 'deepseek')
      assert.strictEqual(ne.capability, 'reasoning')
      assert.strictEqual(ne.resourceType, 'llm_provider')
    })

    it('crawler 使用 typeFactor 3.0', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [makeAssignment('n1', 'deepseek', 'crawler')],
        providerCostMap: new Map([['deepseek', 0.5]]),
        providerLatencyMap: new Map([['deepseek', 1000]]),
        nodeCount: 1,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      assert.strictEqual(result.nodeEstimates[0].estimatedDuration, 1000 * 3.0)
    })

    it('human_review 使用 typeFactor 60000', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [makeAssignment('n1', 'deepseek', 'human_review')],
        providerCostMap: new Map([['deepseek', 0.5]]),
        providerLatencyMap: new Map([['deepseek', 1000]]),
        nodeCount: 1,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      assert.strictEqual(result.nodeEstimates[0].estimatedDuration, 1000 * 60000)
    })

    it('unknown type 使用 typeFactor 1.0 (default)', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [makeAssignment('n1', 'deepseek', 'custom')],
        providerCostMap: new Map([['deepseek', 0.5]]),
        providerLatencyMap: new Map([['deepseek', 1000]]),
        nodeCount: 1,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      assert.strictEqual(result.nodeEstimates[0].estimatedDuration, 1000 * 1.0)
    })
  })

  // ─── Scene 2: 总成本合计正确 ───
  describe('总成本 — 合计正确', () => {
    it('单个节点成本 = tokens * costPerToken', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [makeAssignment('n1', 'deepseek', 'llm_provider')],
        providerCostMap: new Map([['deepseek', 2.0]]),
        providerLatencyMap: new Map([['deepseek', 1000]]),
        nodeCount: 1,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      // 500 tokens * 2.0 = 1000
      assert.strictEqual(result.estimatedCost, 1000)
    })

    it('多个节点成本合计', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [
          makeAssignment('n1', 'deepseek', 'llm_provider'),
          makeAssignment('n2', 'chatgpt', 'llm_provider'),
        ],
        providerCostMap: new Map([
          ['deepseek', 0.5],
          ['chatgpt', 2.0],
        ]),
        providerLatencyMap: new Map([
          ['deepseek', 1000],
          ['chatgpt', 1500],
        ]),
        nodeCount: 2,
        edgeCount: 1,
      }
      const result = await estimator.estimate(context)
      // deepseek: 500*0.5 = 250, chatgpt: 500*2.0 = 1000, total = 1250
      assert.strictEqual(result.estimatedCost, 1250)
    })
  })

  // ─── Scene 3: 总时间（关键路径长度） ───
  describe('总时间 — 关键路径长度正确', () => {
    it('单节点时长 = latency * typeFactor', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [makeAssignment('n1', 'deepseek', 'crawler')],
        providerCostMap: new Map([['deepseek', 0.5]]),
        providerLatencyMap: new Map([['deepseek', 2000]]),
        nodeCount: 1,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      assert.strictEqual(result.estimatedDuration, 2000 * 3.0) // 6000
    })
  })

  // ─── Scene 4: 关键路径分析 ───
  describe('关键路径分析 — pathNodeIds, bottleneckNodeId', () => {
    it('返回 pathNodeIds 按 assignment 顺序', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [
          makeAssignment('n1', 'deepseek', 'llm_provider'),
          makeAssignment('n2', 'chatgpt', 'llm_provider'),
          makeAssignment('n3', 'claude', 'llm_provider'),
        ],
        providerCostMap: new Map([
          ['deepseek', 0.5],
          ['chatgpt', 2.0],
          ['claude', 3.0],
        ]),
        providerLatencyMap: new Map([
          ['deepseek', 1000],
          ['chatgpt', 1500],
          ['claude', 2000],
        ]),
        nodeCount: 3,
        edgeCount: 2,
      }
      const result = await estimator.estimate(context)
      assert.deepStrictEqual(result.criticalPath.pathNodeIds, ['n1', 'n2', 'n3'])
    })

    it('识别瓶颈节点（时长最长的节点）', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [
          makeAssignment('n1', 'deepseek', 'llm_provider'), // 1000*1.0 = 1000
          makeAssignment('n2', 'chatgpt', 'crawler'),       // 1500*3.0 = 4500 ← 瓶颈
          makeAssignment('n3', 'claude', 'llm_provider'),   // 2000*1.0 = 2000
        ],
        providerCostMap: new Map([
          ['deepseek', 0.5],
          ['chatgpt', 2.0],
          ['claude', 3.0],
        ]),
        providerLatencyMap: new Map([
          ['deepseek', 1000],
          ['chatgpt', 1500],
          ['claude', 2000],
        ]),
        nodeCount: 3,
        edgeCount: 2,
      }
      const result = await estimator.estimate(context)
      assert.strictEqual(result.criticalPath.bottleneckNodeId, 'n2')
    })

    it('空 assignment 时 bottleneckNodeId 为 null', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [],
        providerCostMap: new Map(),
        providerLatencyMap: new Map(),
        nodeCount: 0,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      assert.deepStrictEqual(result.criticalPath.pathNodeIds, [])
      assert.strictEqual(result.criticalPath.bottleneckNodeId, null)
      assert.strictEqual(result.criticalPath.criticalDuration, 0)
      assert.strictEqual(result.criticalPath.parallelismFactor, 0)
    })
  })

  // ─── Scene 5: ResourceSummary ───
  describe('ResourceSummary — 按类型汇总正确', () => {
    it('按 resourceType 分组汇总', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [
          makeAssignment('n1', 'deepseek', 'llm_provider'),
          makeAssignment('n2', 'chatgpt', 'llm_provider'),
          makeAssignment('n3', 'deepseek', 'crawler'),
        ],
        providerCostMap: new Map([
          ['deepseek', 0.5],
          ['chatgpt', 2.0],
        ]),
        providerLatencyMap: new Map([
          ['deepseek', 1000],
          ['chatgpt', 1500],
        ]),
        nodeCount: 3,
        edgeCount: 2,
      }
      const result = await estimator.estimate(context)
      const summary = result.resourceSummary

      // 应该有 2 个组：llm_provider, crawler
      assert.strictEqual(summary.length, 2)

      const llmGroup = summary.find(s => s.resourceType === 'llm_provider')
      assert.ok(llmGroup)
      assert.strictEqual(llmGroup.count, 2)
      assert.strictEqual(llmGroup.estimatedUsage, 2 * 500) // count * 500
      // deepseek: 250, chatgpt: 1000, total: 1250
      assert.strictEqual(llmGroup.estimatedCost, 1250)
      assert.strictEqual(llmGroup.providers.length, 2)
      assert.strictEqual(llmGroup.providers.find(p => p.name === 'deepseek')!.count, 1)
      assert.strictEqual(llmGroup.providers.find(p => p.name === 'chatgpt')!.count, 1)

      const crawlerGroup = summary.find(s => s.resourceType === 'crawler')
      assert.ok(crawlerGroup)
      assert.strictEqual(crawlerGroup.count, 1)
      assert.strictEqual(crawlerGroup.estimatedCost, 500 * 0.5) // deepseek cost
    })
  })

  // ─── Scene 6: Assumptions ───
  describe('Assumptions — 包含估算假设说明', () => {
    it('返回 assumptions 数组', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [makeAssignment('n1', 'deepseek', 'llm_provider')],
        providerCostMap: new Map([['deepseek', 0.5]]),
        providerLatencyMap: new Map([['deepseek', 1000]]),
        nodeCount: 1,
        edgeCount: 0,
      }
      const result = await estimator.estimate(context)
      assert.ok(Array.isArray(result.assumptions))
      assert.ok(result.assumptions.length >= 3)
      assert.ok(result.assumptions[0].includes('registered provider average latency'))
    })
  })

  // ─── Scene 7: 自定义 Provider 数据 ───
  describe('自定义 Provider 数据 — 传入自定义 costMap/latencyMap 生效', () => {
    it('PredictionService 使用自定义成本/延迟数据', async () => {
      const service = new PredictionService()
      const graph = createMockGraph()
      graph.nodes = [
        { id: 'n1', label: 'Node1', type: 'mission', capability: 'reasoning', providerPolicy: 'FASTEST', config: {}, status: 'pending', retryConfig: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitter: true, useExponentialBackoff: true }, timeout: 30000, dependencies: [], artifact: null, error: null, startedAt: null, completedAt: null },
        { id: 'n2', label: 'Node2', type: 'mission', capability: 'search', providerPolicy: 'FASTEST', config: {}, status: 'pending', retryConfig: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitter: true, useExponentialBackoff: true }, timeout: 30000, dependencies: [], artifact: null, error: null, startedAt: null, completedAt: null },
      ]
      graph.edges = [{ from: 'n1', to: 'n2' }]

      const assignments: ExecutionAssignment[] = [
        makeAssignment('n1', 'my-custom-provider', 'llm_provider'),
        makeAssignment('n2', 'another-provider', 'crawler'),
      ]

      const costMap = new Map<string, number>([
        ['my-custom-provider', 1.5],
        ['another-provider', 0.8],
      ])
      const latencyMap = new Map<string, number>([
        ['my-custom-provider', 500],
        ['another-provider', 3000],
      ])

      const result = await service.predict(graph, assignments, {
        costMap,
        latencyMap,
      })

      // 自定义 provider 成本生效
      assert.strictEqual(result.nodeEstimates[0].estimatedCost, 500 * 1.5)  // 750
      assert.strictEqual(result.nodeEstimates[1].estimatedCost, 500 * 0.8)  // 400

      // 自定义 provider 延迟生效
      assert.strictEqual(result.nodeEstimates[0].estimatedDuration, 500 * 1.0)   // 500
      assert.strictEqual(result.nodeEstimates[1].estimatedDuration, 3000 * 3.0)  // 9000
    })
  })

  // ─── Scene 8: 空 Assignment ───
  describe('空 Assignment — 空列表处理', () => {
    it('返回空的估算结果', async () => {
      const service = new PredictionService()
      const graph = createMockGraph()
      const result = await service.predict(graph, [])
      assert.strictEqual(result.nodeEstimates.length, 0)
      assert.strictEqual(result.resourceSummary.length, 0)
      assert.strictEqual(result.estimatedCost, 0)
      assert.strictEqual(result.estimatedDuration, 0)
      assert.deepStrictEqual(result.criticalPath.pathNodeIds, [])
      assert.strictEqual(result.criticalPath.bottleneckNodeId, null)
      assert.strictEqual(result.confidence, 'medium')
    })
  })

  // ─── Scene 9: 切换 Estimator ───
  describe('切换 Estimator — setEstimator 生效', () => {
    it('替换为自定义估算器', async () => {
      class CustomEstimator implements IEstimator {
        name = 'custom-test'
        async estimate(context: PredictionContext): Promise<EstimationResult> {
          return {
            estimatedDuration: 42,
            estimatedCost: 100,
            confidence: 'high',
            criticalPath: {
              pathNodeIds: ['custom'],
              criticalDuration: 42,
              totalDuration: 42,
              parallelizableDuration: 0,
              parallelismFactor: 0,
              bottleneckNodeId: 'custom',
            },
            resourceSummary: [],
            nodeEstimates: [
              {
                nodeId: 'custom',
                estimatedDuration: 42,
                estimatedCost: 100,
                assignedProvider: 'test',
                capability: 'test',
                resourceType: 'custom',
              },
            ],
            assumptions: ['Custom estimator'],
          }
        }
      }

      const service = new PredictionService()
      service.setEstimator(new CustomEstimator())

      const graph = createMockGraph()
      const result = await service.predict(graph, [], { costMap: new Map(), latencyMap: new Map() })

      assert.strictEqual(service.getEstimatorName(), 'custom-test')
      assert.strictEqual(result.estimatedDuration, 42)
      assert.strictEqual(result.estimatedCost, 100)
      assert.strictEqual(result.confidence, 'high')
      assert.deepStrictEqual(result.criticalPath.pathNodeIds, ['custom'])
      assert.deepStrictEqual(result.assumptions, ['Custom estimator'])
    })
  })

  // ─── Scene 10: 多种 ResourceType ───
  describe('多种 ResourceType — 不同类型使用正确的 typeFactor', () => {
    it('webhook 使用 0.5, browser 使用 5.0', async () => {
      const estimator = new StaticEstimator()
      const context: PredictionContext = {
        graphId: 'g1',
        assignments: [
          makeAssignment('n1', 'deepseek', 'webhook'),
          makeAssignment('n2', 'deepseek', 'browser'),
          makeAssignment('n3', 'deepseek', 'gpu_worker'),
          makeAssignment('n4', 'deepseek', 'background_job'),
        ],
        providerCostMap: new Map([['deepseek', 1.0]]),
        providerLatencyMap: new Map([['deepseek', 1000]]),
        nodeCount: 4,
        edgeCount: 3,
      }
      const result = await estimator.estimate(context)
      assert.strictEqual(result.nodeEstimates.find(n => n.nodeId === 'n1')!.estimatedDuration, 1000 * 0.5)  // webhook
      assert.strictEqual(result.nodeEstimates.find(n => n.nodeId === 'n2')!.estimatedDuration, 1000 * 5.0)  // browser
      assert.strictEqual(result.nodeEstimates.find(n => n.nodeId === 'n3')!.estimatedDuration, 1000 * 10.0) // gpu_worker
      assert.strictEqual(result.nodeEstimates.find(n => n.nodeId === 'n4')!.estimatedDuration, 1000 * 2.0)  // background_job
    })
  })
})
