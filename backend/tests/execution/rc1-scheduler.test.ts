// ============================================================
// RC1 DAGScheduler — 7 个测试场景
// ============================================================

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import {
  createExecutionContext,
  createExecutionGraph,
  createExecutionNode,
  addEdge,
  DAGScheduler,
  NodeStateMachine,
  InMemoryExecutionTraceRepository,
  createExecutionArtifact,
  createExecutionEvent,
  getReadyNodes,
  getDependents,
} from '../../src/services/geo/execution/index'

import type {
  ExecutionGraph,
  ExecutionNode,
  ExecutionEventType,
  NodeStatus,
  GraphStatus,
} from '../../src/services/geo/execution/types'

// ─── 辅助：创建基本上下文 ───

function makeContext(overrides?: Partial<{
  brandId: string
  tenantId: string
  sourceType: string
  sourceId: string
}>) {
  return createExecutionContext({
    brandId: overrides?.brandId ?? 'brand-1',
    tenantId: overrides?.tenantId ?? 'tenant-1',
    sourceType: overrides?.sourceType ?? 'test',
    sourceId: overrides?.sourceId ?? 'src-1',
  })
}

// ─── 辅助：创建图 ───

function makeLinearGraph(nodeCount: number): ExecutionGraph {
  const ctx = makeContext()
  const nodes: ExecutionNode[] = []
  for (let i = 0; i < nodeCount; i++) {
    nodes.push(
      createExecutionNode({
        label: `N${i + 1}`,
        type: 'custom',
        capability: 'test',
      }),
    )
  }
  const edges: { from: string; to: string }[] = []
  for (let i = 0; i < nodeCount - 1; i++) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id })
  }
  let graph = createExecutionGraph({ context: ctx, nodes, edges })
  for (const e of edges) {
    graph = addEdge(graph, e.from, e.to)
  }
  return graph
}

function makeDiamondGraph(): ExecutionGraph {
  const ctx = makeContext()
  const A = createExecutionNode({ label: 'A', type: 'custom', capability: 'test' })
  const B = createExecutionNode({ label: 'B', type: 'custom', capability: 'test' })
  const C = createExecutionNode({ label: 'C', type: 'custom', capability: 'test' })
  const D = createExecutionNode({ label: 'D', type: 'custom', capability: 'test' })

  let graph = createExecutionGraph({ context: ctx, nodes: [A, B, C, D], edges: [] })
  graph = addEdge(graph, A.id, B.id)
  graph = addEdge(graph, A.id, C.id)
  graph = addEdge(graph, B.id, D.id)
  graph = addEdge(graph, C.id, D.id)
  return graph
}

// ─── 辅助：收集执行顺序 ───

function collectExecutionOrder(graph: ExecutionGraph): string[] {
  const events = graph.nodes
    .filter((n) => n.startedAt)
    .sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime())
    .map((n) => n.label)
  return events
}

// ─── 测试 ───

describe('RC1 — DAGScheduler', () => {
  // ──────────────────────────────
  // 场景 1: 线性链 A → B → C
  // ──────────────────────────────
  describe('1. 线性链 (A → B → C)', () => {
    it('应按顺序执行 A → B → C', async () => {
      const repo = new InMemoryExecutionTraceRepository()
      const graph = makeLinearGraph(3)
      repo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo: repo })
      const result = await scheduler.execute(graph)

      // 所有节点应完成
      assert.equal(result.status, 'completed')
      for (const node of result.nodes) {
        assert.equal(node.status, 'completed', `节点 ${node.label} 应完成`)
      }

      // 顺序应为 A, B, C
      const order = collectExecutionOrder(result)
      assert.equal(order.length, 3)
      assert.deepEqual(order, ['N1', 'N2', 'N3'])
    })
  })

  // ──────────────────────────────
  // 场景 2: 可并行节点 A → B, A → C
  // ──────────────────────────────
  describe('2. 可并行节点 (A → B, A → C)', () => {
    it('应正确解析依赖，B 和 C 都依赖于 A', async () => {
      const ctx = makeContext()
      const A = createExecutionNode({ label: 'A', type: 'custom', capability: 'test' })
      const B = createExecutionNode({ label: 'B', type: 'custom', capability: 'test' })
      const C = createExecutionNode({ label: 'C', type: 'custom', capability: 'test' })

      let graph = createExecutionGraph({ context: ctx, nodes: [A, B, C], edges: [] })
      graph = addEdge(graph, A.id, B.id)
      graph = addEdge(graph, A.id, C.id)

      const repo = new InMemoryExecutionTraceRepository()
      repo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo: repo })
      const result = await scheduler.execute(graph)

      assert.equal(result.status, 'completed')

      // A 先完成
      const aNode = result.nodes.find((n) => n.label === 'A')!
      assert.equal(aNode.status, 'completed')

      // B 和 C 都完成
      const bNode = result.nodes.find((n) => n.label === 'B')!
      const cNode = result.nodes.find((n) => n.label === 'C')!
      assert.equal(bNode.status, 'completed')
      assert.equal(cNode.status, 'completed')

      // B 和 C 应依赖于 A
      assert.ok(bNode.dependencies.includes(A.id))
      assert.ok(cNode.dependencies.includes(A.id))

      // A 应在 B 和 C 之前
      const order = collectExecutionOrder(result)
      const aIdx = order.indexOf('A')
      const bIdx = order.indexOf('B')
      const cIdx = order.indexOf('C')
      assert.ok(aIdx < bIdx, 'A 应在 B 前')
      assert.ok(aIdx < cIdx, 'A 应在 C 前')
    })
  })

  // ──────────────────────────────
  // 场景 3: Diamond A → B → D, A → C → D
  // ──────────────────────────────
  describe('3. Diamond (A → B → D, A → C → D)', () => {
    it('应在 D 之前完成 B 和 C', async () => {
      const graph = makeDiamondGraph()
      const repo = new InMemoryExecutionTraceRepository()
      repo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo: repo })
      const result = await scheduler.execute(graph)

      assert.equal(result.status, 'completed')

      // 所有节点完成
      for (const node of result.nodes) {
        assert.equal(node.status, 'completed', `节点 ${node.label} 应完成`)
      }

      const order = collectExecutionOrder(result)

      // A 最先
      assert.equal(order[0], 'A')

      // D 最后 (因为依赖于 B 和 C)
      const dIdx = order.indexOf('D')
      const bIdx = order.indexOf('B')
      const cIdx = order.indexOf('C')
      assert.ok(bIdx < dIdx, 'B 应在 D 前')
      assert.ok(cIdx < dIdx, 'C 应在 D 前')
    })
  })

  // ──────────────────────────────
  // 场景 4: Cancellation
  // ──────────────────────────────
  describe('4. Cancellation', () => {
    it('应在取消后产生 cancelled 事件并终止所有节点', async () => {
      const ctx = makeContext()
      const A = createExecutionNode({ label: 'A', type: 'custom', capability: 'test' })
      const B = createExecutionNode({ label: 'B', type: 'custom', capability: 'test' })
      const C = createExecutionNode({ label: 'C', type: 'custom', capability: 'test' })

      let graph = createExecutionGraph({ context: ctx, nodes: [A, B, C], edges: [] })
      graph = addEdge(graph, A.id, B.id)
      graph = addEdge(graph, B.id, C.id)

      const repo = new InMemoryExecutionTraceRepository()
      repo.saveGraph(graph)

      // 让节点 A 执行慢一些，确保 B 保持 queued
      let nodeAStarted = false
      const scheduler = new DAGScheduler({
        traceRepo: repo,
        nodeExecute: async (node) => {
          if (node.label === 'A') {
            nodeAStarted = true
            // A 执行中触发取消
            await scheduler.cancel(ctx.executionId)
            return { success: true, output: null, duration: 0 }
          }
          return { success: true, output: null, duration: 0 }
        },
      })

      const result = await scheduler.execute(graph)

      assert.equal(result.status, 'cancelled')

      // A 可能 completed，B 和 C 应 cancelled
      const aNode = result.nodes.find((n) => n.label === 'A')!
      const bNode = result.nodes.find((n) => n.label === 'B')!
      const cNode = result.nodes.find((n) => n.label === 'C')!

      // A 应该 completed（因为模拟执行中 cancel 被延迟到 A 完成后）
      // 但 B 和 C 应该是 cancelled
      assert.ok(
        bNode.status === 'cancelled' || bNode.status === 'failed',
        `B 应被取消，当前: ${bNode.status}`,
      )
      assert.ok(
        cNode.status === 'cancelled' || cNode.status === 'failed',
        `C 应被取消，当前: ${cNode.status}`,
      )

      // Events 中应有 graph_cancelled
      const events = await repo.getEvents(ctx.executionId)
      const cancelledEvent = events.find((e) => e.type === 'graph_cancelled')
      assert.ok(cancelledEvent, '应有 graph_cancelled event')
    })
  })

  // ──────────────────────────────
  // 场景 5: 状态机所有允许的转换路径
  // ──────────────────────────────
  describe('5. 状态机 — 所有转换路径', () => {
    const sm = new NodeStateMachine()

    it('pending → node_queued → queued', () => {
      const result = sm.transition(
        { status: 'pending' } as ExecutionNode,
        'node_queued' as ExecutionEventType,
      )
      assert.equal(result, 'queued')
    })

    it('queued → node_started → running', () => {
      const result = sm.transition(
        { status: 'queued' } as ExecutionNode,
        'node_started' as ExecutionEventType,
      )
      assert.equal(result, 'running')
    })

    it('running → node_completed → completed', () => {
      const result = sm.transition(
        { status: 'running' } as ExecutionNode,
        'node_completed' as ExecutionEventType,
      )
      assert.equal(result, 'completed')
    })

    it('running → node_failed → failed', () => {
      const result = sm.transition(
        { status: 'running' } as ExecutionNode,
        'node_failed' as ExecutionEventType,
      )
      assert.equal(result, 'failed')
    })

    it('running → node_retry → retrying', () => {
      const result = sm.transition(
        { status: 'running' } as ExecutionNode,
        'node_retry' as ExecutionEventType,
      )
      assert.equal(result, 'retrying')
    })

    it('retrying → node_started → running', () => {
      const result = sm.transition(
        { status: 'retrying' } as ExecutionNode,
        'node_started' as ExecutionEventType,
      )
      assert.equal(result, 'running')
    })

    it('retrying → node_failed → failed', () => {
      const result = sm.transition(
        { status: 'retrying' } as ExecutionNode,
        'node_failed' as ExecutionEventType,
      )
      assert.equal(result, 'failed')
    })

    it('running → node_timeout → timeout', () => {
      const result = sm.transition(
        { status: 'running' } as ExecutionNode,
        'node_timeout' as ExecutionEventType,
      )
      assert.equal(result, 'timeout')
    })

    it('running → node_fallback → fallback', () => {
      const result = sm.transition(
        { status: 'running' } as ExecutionNode,
        'node_fallback' as ExecutionEventType,
      )
      assert.equal(result, 'fallback')
    })

    it('fallback → node_started → running', () => {
      const result = sm.transition(
        { status: 'fallback' } as ExecutionNode,
        'node_started' as ExecutionEventType,
      )
      assert.equal(result, 'running')
    })

    it('fallback → node_failed → failed', () => {
      const result = sm.transition(
        { status: 'fallback' } as ExecutionNode,
        'node_failed' as ExecutionEventType,
      )
      assert.equal(result, 'failed')
    })

    it('any pending/queued/running → node_cancelled → cancelled', () => {
      // pending → cancelled not directly allowed
      // queued → cancelled
      const fromQueued = sm.transition(
        { status: 'queued' } as ExecutionNode,
        'node_cancelled' as ExecutionEventType,
      )
      assert.equal(fromQueued, 'cancelled')

      // running → cancelled
      const fromRunning = sm.transition(
        { status: 'running' } as ExecutionNode,
        'node_cancelled' as ExecutionEventType,
      )
      assert.equal(fromRunning, 'cancelled')

      // retrying → cancelled
      const fromRetrying = sm.transition(
        { status: 'retrying' } as ExecutionNode,
        'node_cancelled' as ExecutionEventType,
      )
      assert.equal(fromRetrying, 'cancelled')
    })

    it('canTransition 验证合法和非法转换', () => {
      assert.ok(sm.canTransition('queued', 'running'))
      assert.ok(sm.canTransition('running', 'completed'))
      assert.ok(sm.canTransition('running', 'failed'))
      assert.ok(!sm.canTransition('pending', 'running')) // pending 不能直接到 running
      assert.ok(!sm.canTransition('completed', 'running')) // 最终状态不可逆
      assert.ok(!sm.canTransition('failed', 'running'))
      assert.ok(!sm.canTransition('cancelled', 'running'))
    })

    it('getAllowedTransitions 返回正确的事件列表', () => {
      const pendingEvents = sm.getAllowedTransitions('pending')
      assert.deepEqual(pendingEvents, ['node_queued'])

      const runningEvents = sm.getAllowedTransitions('running')
      assert.ok(runningEvents.includes('node_completed'))
      assert.ok(runningEvents.includes('node_failed'))
      assert.ok(runningEvents.includes('node_retry'))
      assert.ok(runningEvents.includes('node_timeout'))
      assert.ok(runningEvents.includes('node_fallback'))
      assert.ok(runningEvents.includes('node_cancelled'))

      const completedEvents = sm.getAllowedTransitions('completed')
      assert.equal(completedEvents.length, 0) // 最终状态
    })
  })

  // ──────────────────────────────
  // 场景 6: Deadlock 检测
  // ──────────────────────────────
  describe('6. Deadlock 检测', () => {
    it('缺失依赖导致 deadlock 时应标记为 failed', async () => {
      const ctx = makeContext()
      // 创建一个不存在的依赖
      const A = createExecutionNode({
        label: 'A',
        type: 'custom',
        capability: 'test',
      })
      // 手动篡改依赖
      A.dependencies = ['non-existent-node']

      let graph = createExecutionGraph({ context: ctx, nodes: [A], edges: [] })

      const repo = new InMemoryExecutionTraceRepository()
      repo.saveGraph(graph)

      const scheduler = new DAGScheduler({ traceRepo: repo })
      const result = await scheduler.execute(graph)

      assert.equal(result.status, 'failed')
      assert.equal(
        result.nodes.find((n) => n.id === A.id)?.status,
        'queued', // 从未变为 running，因为依赖永不满足
      )
    })
  })

  // ──────────────────────────────
  // 场景 7: 确定性调度
  // ──────────────────────────────
  describe('7. 确定性调度', () => {
    it('相同 DAG 在相同配置下应产生一致的执行顺序', async () => {
      const runOnce = async (): Promise<string[]> => {
        // 每次都创建新的 graph（ID 会不同但结构相同）
        const ctx = makeContext()
        const nodes = [
          createExecutionNode({ label: 'X', type: 'custom', capability: 'test' }),
          createExecutionNode({ label: 'Y', type: 'custom', capability: 'test' }),
          createExecutionNode({ label: 'Z', type: 'custom', capability: 'test' }),
        ]
        let graph = createExecutionGraph({ context: ctx, nodes, edges: [] })
        graph = addEdge(graph, nodes[0].id, nodes[1].id)
        graph = addEdge(graph, nodes[1].id, nodes[2].id)

        const repo = new InMemoryExecutionTraceRepository()
        repo.saveGraph(graph)

        const scheduler = new DAGScheduler({ traceRepo: repo })
        const result = await scheduler.execute(graph)
        return collectExecutionOrder(result)
      }

      const order1 = await runOnce()
      const order2 = await runOnce()

      // 两次执行顺序应一致
      assert.deepEqual(order1, order2)
    })
  })
})
