/**
 * Graph Scheduler — 多图谱调度系统核心
 * 
 * 职责：
 * - 管理多个 AIGC Graph 实例
 * - 调度执行顺序 (priority-based)
 * - 分配 LLM / render / queue 资源
 * - 控制并发限制
 * - 独立 degrade 处理
 */

import { GraphRuntime } from '../graph-runtime/runtime/graph.runtime.js'
import { type ExecutionPlan } from '../graph-runtime/compiler/graph.compiler.js'
import { registerBuiltinExecutors } from '../graph-runtime/registry/node.registry.js'
import { createGraphInstance, type GraphInstance, type GraphPriority } from './graph.instance.js'
import { agentPool } from './agent-pool.js'
import { resourceRouter } from './resource-router.js'

// ============================================================
// Scheduler Result
// ============================================================

export interface GraphOutput {
  graphId: string
  projectId: string
  status: string
  result: any
  cost: number
  latency: number
  nodesCompleted: number
  nodesFailed: number
}

// ============================================================
// Graph Scheduler
// ============================================================

class GraphScheduler {
  private graphs: Map<string, GraphInstance> = new Map()
  private queue: GraphInstance[] = []
  private maxConcurrency = 3
  private running = 0
  private runtimes: Map<string, GraphRuntime> = new Map()

  constructor() {
    registerBuiltinExecutors()
  }

  /**
   * 提交一个新 graph 到调度队列
   */
  submit(params: {
    projectId: string
    userId?: string
    priority?: GraphPriority
    context?: Record<string, any>
  }): string {
    const instance = createGraphInstance(params)
    this.graphs.set(instance.graphId, instance)
    this.queue.push(instance)

    console.log(`[Scheduler] 🆕 graph ${instance.graphId} 已入队 (priority=${instance.priority})`)
    this.dispatch()
    return instance.graphId
  }

  /**
   * 获取 graph 状态
   */
  getStatus(graphId: string): GraphInstance | undefined {
    return this.graphs.get(graphId)
  }

  /**
   * 获取所有 graph 输出
   */
  getAllOutputs(): GraphOutput[] {
    const outputs: GraphOutput[] = []
    for (const [graphId, instance] of this.graphs) {
      outputs.push({
        graphId,
        projectId: instance.projectId,
        status: instance.status,
        result: instance.context,
        cost: 0,
        latency: instance.completedAt && instance.startedAt
          ? instance.completedAt - instance.startedAt : 0,
        nodesCompleted: instance.nodesCompleted,
        nodesFailed: instance.nodesFailed,
      })
    }
    return outputs
  }

  /**
   * 调度器主循环
   */
  private async dispatch() {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const next = this.selectNextGraph()
      if (!next) break

      this.queue = this.queue.filter(g => g.graphId !== next.graphId)
      this.running++
      this.executeGraph(next).finally(() => {
        this.running--
        this.dispatch()
      })
    }
  }

  /**
   * 选择下一个要执行的 graph
   * 优先级: high > medium > low
   * 同优先级 FIFO
   */
  private selectNextGraph(): GraphInstance | null {
    const priorityOrder: GraphPriority[] = ['high', 'medium', 'low']
    for (const p of priorityOrder) {
      const found = this.queue.find(g => g.priority === p)
      if (found) return found
    }
    return this.queue[0] || null
  }

  /**
   * 执行单个 graph
   */
  private async executeGraph(instance: GraphInstance) {
    instance.status = 'running'
    instance.startedAt = Date.now()

    console.log(`[Scheduler] ▶️ graph ${instance.graphId} 开始执行`)

    const runtime = new GraphRuntime()
    this.runtimes.set(instance.graphId, runtime)

    try {
      // 构建执行计划（实际项目中从 compiler 生成）
      const plan: ExecutionPlan = {
        pipelineId: instance.graphId,
        totalSteps: 4,
        topologicalLevels: 3,
        maxParallel: 2,
        steps: [
          {
            nodeId: 'story_analysis',
            nodeType: 'llm',
            label: '故事分析',
            phase: 0,
            inputs: [],
            outputs: ['text'],
            dependencies: [],
            runtime: 'async',
          },
          {
            nodeId: 'character_design',
            nodeType: 'character',
            label: '角色设计',
            phase: 1,
            inputs: [{ port: 'text', type: 'data', sourceNodeId: 'story_analysis', sourcePort: 'text', required: false }],
            outputs: ['characters'],
            dependencies: ['story_analysis'],
            runtime: 'async',
          },
          {
            nodeId: 'scene_design',
            nodeType: 'scene',
            label: '场景设计',
            phase: 1,
            inputs: [{ port: 'text', type: 'data', sourceNodeId: 'story_analysis', sourcePort: 'text', required: false }],
            outputs: ['scenes'],
            dependencies: ['story_analysis'],
            runtime: 'async',
          },
          {
            nodeId: 'storyboard',
            nodeType: 'storyboard',
            label: '分镜生成',
            phase: 2,
            inputs: [{ port: 'characters', type: 'data', sourceNodeId: 'character_design', sourcePort: 'characters', required: false }],
            outputs: ['storyboards'],
            dependencies: ['character_design', 'scene_design'],
            runtime: 'async',
          },
        ],
      }

      const result = await runtime.execute(plan)

      instance.nodesCompleted = result.succeededSteps
      instance.nodesFailed = result.degradedSteps
      instance.status = result.allDegraded ? 'degraded' : 'completed'
      instance.context = {
        runtimeResult: {
          ok: result.ok,
          totalSteps: result.totalSteps,
          succeeded: result.succeededSteps,
          degraded: result.degradedSteps,
          executionTimeMs: result.executionTimeMs,
        },
      }

      console.log(`[Scheduler] ✅ graph ${instance.graphId} 完成 (status=${instance.status}, ${result.executionTimeMs}ms)`)
    } catch (err: any) {
      instance.status = 'degraded'
      console.log(`[Scheduler] ⚠️ graph ${instance.graphId} 降级: ${err.message}`)
    } finally {
      instance.completedAt = Date.now()
      this.runtimes.delete(instance.graphId)
    }
  }
}

export const graphScheduler = new GraphScheduler()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

