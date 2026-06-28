import type { ApiResponse } from '../contracts/api/base.js';
/**
 * ExecutionGraph Routes
 *
 * ========= Query Layer (NEW) =========
 * GET    /api/v1/execution-graph/runtime/:projectId/nodes?type=scene&status=completed
 *   →  按 projectId + nodeType 查询语义化生产数据（Graph Query Layer）
 *   →  返回该类型最新的完成节点 output
 *
 * ========= Legacy API (existing) =========
 * POST   /api/v1/execution-graph/script-analysis   — 提交剧本分析，创建 Graph
 * GET    /api/v1/execution-graph/:graphId            — 查询 Graph 完整状态
 * POST   /api/v1/execution-graph/:graphId/replay     — 重放 Graph
 * POST   /api/v1/execution-graph/:graphId/nodes      — 追加节点
 * GET    /api/v1/execution-graph/:graphId/events     — SSE 事件流
 */

import { FastifyInstance } from 'fastify'
import { prisma, taskEventEmitter } from '../utils/index.js'

export default async function executionGraphRoutes(app: FastifyInstance) {
  // ── Lazy import scheduler (circular dep & long-load protection) ──
  async function getScheduler() {
    return import('../agents/scheduler.js') as Promise<typeof import('../agents/scheduler.js')>
  }

  // ──────────────────────────────────────────────────────────
  //  Graph Query Layer — 语义化生产数据查询
  //  GET /api/v1/execution-graph/runtime/:projectId/nodes?type=scene&status=completed
  // ──────────────────────────────────────────────────────────
  app.get('/api/v1/execution-graph/runtime/:projectId/nodes', async (request, reply) => {
    const { projectId } = request.params as any
    const { type, status, limit } = request.query as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    try {
      const graphs = await prisma.executionGraph.findMany({
        where: { type: 'script_analysis' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, input: true, type: true },
      })

      let targetGraphId: string | null = null
      for (const g of graphs) {
        const input = g.input as any
        if (input?.projectId === projectId || !targetGraphId) {
          targetGraphId = g.id
          if (input?.projectId === projectId) break
        }
      }

      if (!targetGraphId) {
        return reply.status(404).send({ success: false, error: '未找到该项目的 Graph' })
      }

      const where: any = { graphId: targetGraphId }
      if (type) where.nodeType = type
      if (status) {
        where.status = status
      } else {
        where.status = 'completed'
      }

      const nodes = await prisma.executionNode.findMany({
        where,
        orderBy: { completedAt: 'desc' },
        take: limit ? Math.min(parseInt(limit), 100) : 50,
      })

      if (type) {
        const latestNode = nodes[0] || null
        return {
          success: true,
          data: {
            projectId,
            type,
            nodes: latestNode ? [{
              id: latestNode.id,
              nodeType: latestNode.nodeType,
              agentId: latestNode.agentId,
              label: latestNode.label,
              status: latestNode.status,
              output: latestNode.output,
              input: latestNode.input,
              startedAt: latestNode.startedAt,
              completedAt: latestNode.completedAt,
            }] : [],
          },
        }
      }

      const grouped = new Map<string, any>()
      for (const node of nodes) {
        if (!grouped.has(node.nodeType)) {
          grouped.set(node.nodeType, {
            id: node.id,
            nodeType: node.nodeType,
            agentId: node.agentId,
            label: node.label,
            status: node.status,
            output: node.output,
            startedAt: node.startedAt,
            completedAt: node.completedAt,
          })
        }
      }

      return {
        success: true,
        data: {
          projectId,
          type: 'all',
          nodes: Array.from(grouped.values()),
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 提交剧本分析 ───
  app.post('/api/v1/execution-graph/script-analysis', async (request, reply) => {
    const { script, projectName, userId, projectId } = request.body as any
    if (!script || !script.trim()) {
      return reply.status(400).send({ success: false, error: '缺少剧本内容' })
    }

    try {
      const { createScriptAnalysisGraph } = await getScheduler()
      const graph = await createScriptAnalysisGraph(script.trim(), userId || 'anonymous')
      return {
        success: true,
        data: {
          graphId: graph.id,
          type: graph.type,
          status: graph.status,
          nodes: graph.nodes.map(n => ({
            id: n.id,
            nodeType: n.nodeType,
            agentId: n.agentId,
            label: n.label,
            status: n.status,
          })),
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 查询 Graph 状态 ───
  app.get('/api/v1/execution-graph/:graphId', async (request, reply) => {
    const { graphId } = request.params as any
    try {
      const graph = await prisma.executionGraph.findUnique({
        where: { id: graphId },
        include: { nodes: true },
      })

      if (!graph) {
        return reply.status(404).send({ success: false, error: 'Graph 不存在' })
      }

      return {
        success: true,
        data: {
          id: graph.id,
          type: graph.type,
          status: graph.status,
          progress: graph.progress,
          input: graph.input,
          output: graph.output,
          nodes: graph.nodes.map(n => ({
            id: n.id,
            nodeType: n.nodeType,
            agentId: n.agentId,
            label: n.label,
            status: n.status,
            output: n.output,
            input: n.input,
            dependencies: n.dependencies,
            errorMessage: n.errorMessage,
            startedAt: n.startedAt,
            completedAt: n.completedAt,
          })),
          createdAt: graph.createdAt,
          updatedAt: graph.updatedAt,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── SSE 事件流 ───
  app.get('/api/v1/execution-graph/:graphId/events', async (request, reply) => {
    const { graphId } = request.params as any

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    reply.raw.write(`event: connected\ndata: {"graphId":"${graphId}"}\n\n`)

    const graph = await prisma.executionGraph.findUnique({
      where: { id: graphId },
      include: { nodes: true },
    })
    if (graph) {
      reply.raw.write(`event: GRAPH_SNAPSHOT\ndata: ${JSON.stringify(graph)}\n\n`)
    }

    const heartbeat = setInterval(() => {
      try { reply.raw.write(`:heartbeat ${Date.now()}\n\n`) } catch { cleanup() }
    }, 30000)

    const onEvent = (data: any) => {
      if (data.graphId !== graphId) return
      try {
        reply.raw.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch { cleanup() }
    }

    taskEventEmitter.on('graph:event', onEvent)

    const cleanup = () => {
      clearInterval(heartbeat)
      taskEventEmitter.off('graph:event', onEvent)
    }

    request.raw.on('close', cleanup)
    request.raw.on('error', cleanup)
  })

  // ─── Graph Replay ───
  app.post('/api/v1/execution-graph/:graphId/replay', async (request, reply) => {
    const { graphId } = request.params as any
    try {
      const { replayGraph } = await getScheduler()
      await replayGraph(graphId)
      return { success: true, data: { graphId, status: 'replaying' } } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 追加节点 ───
  app.post('/api/v1/execution-graph/:graphId/nodes', async (request, reply) => {
    const { graphId } = request.params as any
    const { nodeType, agentId, label, dependencies, input } = request.body as any
    if (!nodeType || !agentId) {
      return reply.status(400).send({ success: false, error: '缺少 nodeType 或 agentId' })
    }

    try {
      const { appendNode } = await getScheduler()
      const node = await appendNode(graphId, nodeType, agentId, label || '', dependencies, input)
      return { success: true, data: { id: node.id, nodeType: node.nodeType, status: node.status } } satisfies ApiResponse<unknown>;

    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "execution-graph",
  "mode": "LEGACY"
};

