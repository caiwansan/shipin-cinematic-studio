import type { ApiResponse } from '../contracts/api/base.js';
/**
 * P4 — Async Runtime API Routes
 *
 *  - POST /api/v2/async/graph/start   — 异步启动图执行
 *  - GET  /api/v2/async/graph/:id     — 图执行状态
 *  - POST /api/v2/async/graph/:id/resume — 恢复图执行
 *  - GET  /api/v2/async/graphs        — 列出所有图
 */

import { FastifyInstance } from 'fastify'
import { asyncExecutor } from '../core/async-runtime/async-executor.js'
import { executionStateStore } from '../core/async-runtime/execution-state-store.js'
import { resumeEngine } from '../core/async-runtime/resume-engine.js'
import { AgentGraph } from '../core/agent-graph/agent-graph.js'

export default async function asyncRuntimeRoutes(app: FastifyInstance) {
  // 异步启动图执行
  app.post('/api/v2/async/graph/start', async (request: any, reply) => {
    const { graphName, nodes, context } = request.body

    if (!graphName || !nodes || !Array.isArray(nodes)) {
      return reply.status(400).send({ success: false, error: '需要 graphName 和 nodes 数组' })
    }

    const graphId = `async-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const topology = nodes.map((n: any) => n.id)
    const ctx = new Map<string, any>()

    ctx.set('__userId__', request.user?.id || 'anonymous')
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        ctx.set(key, value)
      }
    }

    // 存节点信息供 AsyncExecutor 读取
    for (const node of nodes) {
      ctx.set(`__node__${node.id}`, node)
    }

    // 异步执行（不 await）
    asyncExecutor.startGraphExecution(graphId, graphName, topology, ctx)

    return {
      success: true,
      data: {
        graphId,
        message: '图已异步启动',
        status: 'running',
      },
    }
  })

  // 获取图执行状态
  app.get('/api/v2/async/graph/:id', async (request: any, reply) => {
    const graphId = request.params.id
    const graph = executionStateStore.getGraph(graphId)

    if (!graph) {
      return reply.status(404).send({ success: false, error: '图不存在' })
    }

    const nodes = Array.from(graph.nodes.entries()).map(([id, state]) => ({
      id,
      status: state.status,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      error: state.error,
      retryCount: state.retryCount,
    }))

    return {
      success: true,
      data: {
        graphId,
        name: graph.name,
        status: graph.status,
        startedAt: graph.startedAt,
        completedAt: graph.completedAt,
        checkpointCount: graph.checkpointCount,
        nodes,
      },
    }
  })

  // 恢复图执行
  app.post('/api/v2/async/graph/:id/resume', async (request: any, reply) => {
    const graphId = request.params.id
    const result = await resumeEngine.resume(graphId)

    return {
      success: result,
      data: { graphId, resumed: result },
    }
  })

  // 列出所有图
  app.get('/api/v2/async/graphs', async () => {
    const graphs = executionStateStore.listGraphs()
    const resumable = resumeEngine.listResumable()

    return {
      success: true,
      data: { graphs, resumable },
    }
  })
}
