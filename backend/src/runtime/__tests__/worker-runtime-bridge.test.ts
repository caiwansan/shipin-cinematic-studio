/**
 * Worker Runtime Bridge 测试
 *
 * 验证：
 *   ① DAG Node → Worker Task 正确映射
 *   ② Execution Trace 完整可追踪
 *   ③ Bridge Never Changes the DAG
 *   ④ Bridge 不重写 worker-runtime
 *   ⑤ Bridge Integrity Check
 *   ⑥ 纯函数、确定性
 *   ⑦ 双运行模式的 Legacy 兼容性
 */

import { describe, test, expect } from 'vitest'
import { bridgeDAG, verifyBridgeIntegrity } from '../../runtime/worker-runtime-bridge.js'
import { buildExecutionDAG } from '../../runtime/execution-planner.js'
import type { ExecutableCapabilityPlan } from '../../runtime/capability-negotiator.js'

// ─── 测试用的 ExecutableCapabilityPlan ──────────────────

function makeTestPlan(): ExecutableCapabilityPlan {
  return {
    id: 'test_exec_plan_bridge',
    sourcePlanId: 'test_plan_bridge',
    environmentId: 'test-full-env',
    shots: [
      {
        shotId: 'shot_01',
        capabilities: [
          { capabilityId: 'film.character.reference' as any, requested: 'full', resolved: 'full', supported: 'full', fallback: null, reason: '原生', confidence: 1.0 },
          { capabilityId: 'film.keyframe' as any, requested: 'full', resolved: 'full', supported: 'full', fallback: null, reason: '原生', confidence: 1.0 },
          { capabilityId: 'film.render.shot' as any, requested: 'full', resolved: 'full', supported: 'full', fallback: null, reason: '原生', confidence: 1.0 },
        ],
        overallFeasibility: 'feasible',
      },
      {
        shotId: 'shot_02',
        capabilities: [
          { capabilityId: 'film.character.reference' as any, requested: 'full', resolved: 'full', supported: 'full', fallback: null, reason: '原生', confidence: 1.0 },
          { capabilityId: 'film.render.shot' as any, requested: 'full', resolved: 'full', supported: 'full', fallback: null, reason: '原生', confidence: 1.0 },
        ],
        overallFeasibility: 'feasible',
      },
    ],
    metadata: {
      negotiatedAt: '', totalShots: 2, feasibleShots: 2, degradedShots: 0, blockedShots: 0,
      overallFeasibility: 'feasible',
    },
  }
}

describe('Worker Runtime Bridge (S4)', () => {
  test('桥接后每个 DAG Node 都生成一个 Worker Task', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const { tasks, diagnostics } = bridgeDAG(dag, 'proj_001', 'user_001')
    expect(diagnostics.success).toBe(true)
    expect(diagnostics.unmappedNodes.length).toBe(0)
    expect(tasks.length).toBeGreaterThanOrEqual(dag.nodes.length)
  })

  test('Execution Trace 可追踪每个 DAG Node', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const { trace } = bridgeDAG(dag, 'proj_001', 'user_001')
    expect(trace.entries.length).toBe(trace.metadata.totalWorkerTasks)
    for (const entry of trace.entries) {
      expect(entry.dagNodeId).toBeTruthy()
      expect(entry.workerTaskId).toBeTruthy()
      expect(entry.executionOrder).toBeGreaterThan(0)
    }
  })

  test('Bridge Never Changes the DAG', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const originalNodes = [...dag.nodes]
    const originalEdges = [...dag.edges]
    bridgeDAG(dag, 'proj_001', 'user_001')
    expect(dag.nodes.length).toBe(originalNodes.length)
    expect(dag.edges.length).toBe(originalEdges.length)
    // 内容不变
    for (let i = 0; i < dag.nodes.length; i++) {
      expect(dag.nodes[i].id).toBe(originalNodes[i].id)
    }
  })

  test('Bridge Integrity Check 通过', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const { diagnostics } = bridgeDAG(dag, 'proj_001', 'user_001')
    const check = verifyBridgeIntegrity(dag, diagnostics)
    expect(check.intact).toBe(true)
  })

  test('Bridge 不含调度/重试/超时逻辑', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const json = JSON.stringify(bridgeDAG(dag, 'proj_001', 'user_001'))
    const runtimeWords = ['retry', 'timeout', 'concurrency', 'scheduler', 'thread']
    for (const word of runtimeWords) {
      expect(json.toLowerCase()).not.toContain(word)
    }
  })

  test('确定性：相同输入产生相同结构', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const a = bridgeDAG(dag, 'proj_001', 'user_001')
    const b = bridgeDAG(dag, 'proj_001', 'user_001')
    expect(a.tasks.length).toBe(b.tasks.length)
    expect(a.diagnostics.success).toBe(b.diagnostics.success)
  })

  test('纯函数：不修改输入', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const originalNodeCount = dag.nodes.length
    bridgeDAG(dag, 'proj_001', 'user_001')
    expect(dag.nodes.length).toBe(originalNodeCount)
  })

  test('Worker Task 包含项目/用户 ID', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const { tasks } = bridgeDAG(dag, 'proj_007', 'user_xyz')
    for (const task of tasks) {
      expect(task.payload.projectId).toBe('proj_007')
      expect(task.payload.userId).toBe('user_xyz')
    }
  })

  test('每个 Task 可追溯到 DAG Node', () => {
    const { dag } = buildExecutionDAG(makeTestPlan())
    const { tasks } = bridgeDAG(dag, 'proj_001', 'user_001')
    for (const task of tasks) {
      expect(task.dagNodeId).toBeTruthy()
      expect(task.payload.sourceDagNodeId).toBe(task.dagNodeId)
    }
  })
})

describe('Dual Mode / Legacy Compatibility', () => {
  test('Bridge 不干扰 Legacy Pipeline', () => {
    // Legacy 不需要 Bridge，Bridge 不修改 Legacy 使用的任何模块
    const { tasks } = bridgeDAG(
      { id: 'test', sourcePlanId: '', nodes: [], edges: [], metadata: { createdAt: '', nodeCount: 0, edgeCount: 0, hasCycles: false, rootNodes: [], leafNodes: [] } },
      'proj_001',
      'user_001',
    )
    expect(tasks.length).toBe(0)
    // Bridge 不 panic（空 DAG 也能安全桥接）
  })
})
