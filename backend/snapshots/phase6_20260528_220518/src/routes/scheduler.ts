import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Multi-Graph Scheduler API Routes
 *
 * 提供 scheduler 的外部调用接口
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { graphScheduler } from '../scheduler/graph-scheduler.js'
import { aggregateProjectResult, formatSchedulerResponse } from '../scheduler/aggregation-layer.js'

export default async function schedulerRoutes(fastify: FastifyInstance) {
  // ============================================================
  // POST /api/v1/scheduler/submit — 提交新 graph
  // ============================================================
  fastify.post('/api/v1/scheduler/submit', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any
    if (!body?.projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    const graphId = graphScheduler.submit({
      projectId: body.projectId,
      userId: body.userId || 'anonymous',
      priority: body.priority || 'medium',
      context: body.context || {},
    })

    return {
      success: true,
      data: {
        graphId,
        status: 'pending',
        projectId: body.projectId,
      },
    }
  })

  // ============================================================
  // GET /api/v1/scheduler/status/:graphId — 查询 graph 状态
  // ============================================================
  fastify.get('/api/v1/scheduler/status/:graphId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { graphId } = request.params as any
    const instance = graphScheduler.getStatus(graphId)

    if (!instance) {
      return reply.status(404).send({ success: false, error: 'graph 不存在' })
    }

    return {
      success: true,
      data: {
        graphId: instance.graphId,
        projectId: instance.projectId,
        status: instance.status,
        priority: instance.priority,
        nodesCompleted: instance.nodesCompleted,
        nodesFailed: instance.nodesFailed,
        startedAt: instance.startedAt,
        completedAt: instance.completedAt,
        traceId: instance.traceId,
      },
    }
  })

  // ============================================================
  // GET /api/v1/scheduler/project/:projectId — 获取项目所有 graph 输出
  // ============================================================
  fastify.get('/api/v1/scheduler/project/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as any
    const aggregated = aggregateProjectResult(projectId)

    return formatSchedulerResponse(aggregated)
  })

  // ============================================================
  // GET /api/v1/scheduler/graphs — 列出所有活跃 graph
  // ============================================================
  fastify.get('/api/v1/scheduler/graphs', async () => {
    const outputs = graphScheduler.getAllOutputs()

    return {
      success: true,
      data: {
        total: outputs.length,
        graphs: outputs.map(g => ({
          graphId: g.graphId,
          projectId: g.projectId,
          status: g.status,
          nodesCompleted: g.nodesCompleted,
          nodesFailed: g.nodesFailed,
        })),
      },
    }
  })
}
