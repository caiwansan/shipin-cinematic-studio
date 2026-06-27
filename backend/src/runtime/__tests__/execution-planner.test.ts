/**
 * Execution Planner 测试 + DAG Simulator
 *
 * S3.3: 验证 ExecutionDAG 构建
 * S3.5: 验证 DAG 可模拟执行（不调用任何 Provider）
 */

import { describe, test, expect } from 'vitest'
import { buildExecutionDAG, validateExecutionDAG } from '../../runtime/execution-planner.js'
import type { ExecutableCapabilityPlan, ExecutableShotCapability } from '../../runtime/capability-negotiator.js'

// ─── 测试用的 ExecutableCapabilityPlan ──────────────────

function makeTestPlan(overrides?: Partial<ExecutableCapabilityPlan>): ExecutableCapabilityPlan {
  return {
    id: 'test_exec_plan_001',
    sourcePlanId: 'test_plan_001',
    environmentId: 'test-env',
    shots: [
      {
        shotId: 'shot_01',
        capabilities: [
          {
            capabilityId: 'film.character.reference' as any,
            requested: 'full', resolved: 'full',
            supported: 'full', fallback: null,
            reason: '环境原生支持', confidence: 1.0,
          },
          {
            capabilityId: 'film.keyframe' as any,
            requested: 'full', resolved: 'full',
            supported: 'full', fallback: null,
            reason: '环境原生支持', confidence: 1.0,
          },
          {
            capabilityId: 'film.render.shot' as any,
            requested: 'full', resolved: 'full',
            supported: 'full', fallback: null,
            reason: '环境原生支持', confidence: 1.0,
          },
        ],
        overallFeasibility: 'feasible',
      },
      {
        shotId: 'shot_02',
        capabilities: [
          {
            capabilityId: 'film.character.reference' as any,
            requested: 'full', resolved: 'full',
            supported: 'full', fallback: null,
            reason: '环境原生支持', confidence: 1.0,
          },
          {
            capabilityId: 'film.keyframe' as any,
            requested: 'full', resolved: 'partial',
            supported: 'partial', fallback: { strategy: 'sequential_generation', description: '降级' },
            reason: '环境部分支持', confidence: 0.6,
          },
          {
            capabilityId: 'film.render.shot' as any,
            requested: 'full', resolved: 'full',
            supported: 'full', fallback: null,
            reason: '环境原生支持', confidence: 1.0,
          },
        ],
        overallFeasibility: 'degraded',
      },
    ],
    metadata: {
      negotiatedAt: '2026-01-01T00:00:00Z',
      totalShots: 2, feasibleShots: 1, degradedShots: 1, blockedShots: 0,
      overallFeasibility: 'degraded',
    },
    ...overrides,
  }
}

describe('Execution Planner (S3.3)', () => {
  test('构建 DAG 包含所有能力节点', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    expect(dag.nodes.length).toBeGreaterThanOrEqual(4)  // charRef×2 + keyframe×2 + shotRender×2
    expect(dag.edges.length).toBeGreaterThan(0)
  })

  test('DAG 节点都绑定 Capability', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    for (const node of dag.nodes) {
      expect(node.requiredCapabilities.length).toBeGreaterThan(0)
    }
  })

  test('DAG 边都是 depends-on 类型', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    for (const edge of dag.edges) {
      expect(edge.type).toBe('depends-on')
    }
  })

  test('DAG 无 Provider 名', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const json = JSON.stringify(dag)
    const providerNames = ['veo', 'seedance', 'aliyun', 'kling', 'sora', 'inference']
    for (const name of providerNames) {
      expect(json.toLowerCase()).not.toContain(name)
    }
  })

  test('DAG 不含执行逻辑（无 retry / timeout / concurrency）', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const json = JSON.stringify(dag)
    const runtimeWords = ['retry', 'timeout', 'concurrency', 'thread', 'queue', 'scheduler']
    for (const word of runtimeWords) {
      expect(json.toLowerCase()).not.toContain(word)
    }
  })

  test('Execution Contract 通过验证', () => {
    const { contract } = buildExecutionDAG(makeTestPlan())
    expect(contract.valid).toBe(true)
    expect(contract.violations.length).toBe(0)
  })

  test('确定性：相同输入产生相同 DAG', () => {
    const a = buildExecutionDAG(makeTestPlan())
    const b = buildExecutionDAG(makeTestPlan())
    expect(a.dag.nodes.length).toBe(b.dag.nodes.length)
    expect(a.dag.edges.length).toBe(b.dag.edges.length)
  })

  test('纯函数：不修改输入', () => {
    const plan = makeTestPlan()
    const originalShots = plan.shots.length
    buildExecutionDAG(plan)
    expect(plan.shots.length).toBe(originalShots)
  })
})

describe('Execution Contract (S3.3)', () => {
  test('空 DAG 不通过', () => {
    const empty = {
      id: 'empty', sourcePlanId: '', nodes: [], edges: [],
      metadata: { createdAt: '', nodeCount: 0, edgeCount: 0, hasCycles: false, rootNodes: [], leafNodes: [] },
    }
    const r = validateExecutionDAG(empty)
    expect(r.valid).toBe(false)
    expect(r.violations.some(v => v.type === 'empty-dag')).toBe(true)
  })

  test('节点无 Capability 不通过', () => {
    const bad = {
      id: 'bad', sourcePlanId: '',
      nodes: [{ id: 'n1', type: 'film.test', label: '无能力', requiredCapabilities: [], metadata: { sourceShotId: '', fallbackStrategy: null, isOptional: false } }],
      edges: [],
      metadata: { createdAt: '', nodeCount: 1, edgeCount: 0, hasCycles: false, rootNodes: ['n1'], leafNodes: ['n1'] },
    }
    const r = validateExecutionDAG(bad)
    expect(r.valid).toBe(false)
    expect(r.violations.some(v => v.type === 'no-capability')).toBe(true)
  })

  test('broken dependency 不通过', () => {
    const bad = {
      id: 'bad', sourcePlanId: '',
      nodes: [{ id: 'n1', type: 'film.test', label: '存在节点', requiredCapabilities: ['film.test' as any], metadata: { sourceShotId: '', fallbackStrategy: null, isOptional: false } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n_nonexistent', type: 'depends-on' }],
      metadata: { createdAt: '', nodeCount: 1, edgeCount: 1, hasCycles: false, rootNodes: ['n1'], leafNodes: [] },
    }
    const r = validateExecutionDAG(bad)
    expect(r.valid).toBe(false)
    expect(r.violations.some(v => v.type === 'broken-dependency')).toBe(true)
  })
})

describe('DAG Simulator (S3.5)', () => {
  test('模拟执行无 Provider 调用', () => {
    // 模拟 DAG 的执行流程，不调任何 Provider
    const { dag } = buildExecutionDAG(makeTestPlan())
    const inDegree = new Map<string, number>()
    for (const node of dag.nodes) inDegree.set(node.id, 0)
    for (const edge of dag.edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    }

    // 拓扑排序模拟
    const order: string[] = []
    const queue: string[] = [...inDegree.entries()].filter(([_, d]) => d === 0).map(([id]) => id)
    while (queue.length > 0) {
      const current = queue.shift()!
      order.push(current)
      for (const edge of dag.edges.filter(e => e.source === current)) {
        const newDegree = (inDegree.get(edge.target) || 1) - 1
        inDegree.set(edge.target, newDegree)
        if (newDegree === 0) queue.push(edge.target)
      }
    }

    expect(order.length).toBe(dag.nodes.length)
    // 顺序验证：charRef 应在 keyframe 之前，keyframe 应在 shot 之前
    const nodesByType = new Map<string, string>()
    for (const node of dag.nodes) nodesByType.set(node.id, node.type)

    const charRefPos = order.findIndex(id => nodesByType.get(id) === 'film.character.reference')
    const keyframePos = order.findIndex(id => nodesByType.get(id) === 'film.keyframe')
    const renderPos = order.findIndex(id => nodesByType.get(id) === 'film.render.shot')

    expect(charRefPos).toBeLessThan(keyframePos)
    expect(keyframePos).toBeLessThan(renderPos)
  })

  test('模拟执行产生执行顺序记录', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())

    // 生成模拟执行结果
    const simulationSteps = dag.nodes.map((node, index) => ({
      step: index + 1,
      nodeId: node.id,
      type: node.type,
      label: node.label,
      requiredCapabilities: node.requiredCapabilities,
    }))

    expect(simulationSteps.length).toBe(dag.nodes.length)
    // 每个节点都有一个 step
    for (const step of simulationSteps) {
      expect(step.step).toBeGreaterThan(0)
      expect(step.requiredCapabilities.length).toBeGreaterThan(0)
    }
  })
})
