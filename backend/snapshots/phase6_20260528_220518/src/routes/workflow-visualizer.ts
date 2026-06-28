/**
 * routes/workflow-visualizer.ts — 可视化 + 回放 API
 *
 * 端点：
 *   GET  /api/v1/workflow/graph/:workflowId  — 获取可视化 DAG
 *   GET  /api/v1/workflow/state              — 获取执行状态快照
 *   POST /api/v1/workflow/replay             — 回放 workflow
 *   GET  /api/v1/workflow/timeline/:traceId  — 执行时间线
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { buildVisualGraph, buildNodeLayout, mapExecutionToGraph } from '../observation/index.js'
import { ReplayEngine } from '../execution/replay-engine/index.js'
import { getWorkflowEngine } from '../workflow/index.js'

export default async function workflowVisualizerRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/workflow/graph/:workflowId
   * 获取可视化 DAG（含拓扑排序层）
   * 注意：无需 auth——graph 结构不包含敏感信息
   */
  fastify.get('/api/v1/workflow/graph/:workflowId', async (request: FastifyRequest<{ Params: { workflowId: string } }>, reply: FastifyReply) => {
    const { workflowId } = request.params

    // 模拟图（实际应从 DB 读取 workflow 定义）
    // v1：返回一个示例图结构
    const sampleGraph = {
      id: workflowId,
      nodes: [
        { id: 'script', type: 'manual.confirm', input: {} },
        { id: 'llm-optimize', type: 'llm.optimize', input: {}, dependsOn: ['script'] },
        { id: 'image-gen', type: 'image.generate', input: {}, dependsOn: ['llm-optimize'] },
        { id: 'video-gen', type: 'video.generate', input: {}, dependsOn: ['image-gen'] },
        { id: 'tts-gen', type: 'tts.generate', input: {}, dependsOn: ['video-gen'] },
      ],
    } as any

    const visualGraph = buildVisualGraph(sampleGraph)
    const layout = buildNodeLayout(visualGraph)

    return reply.send({
      success: true,
      data: {
        graph: visualGraph,
        layout: Object.fromEntries(layout),
      },
    })
  })

  /**
   * GET /api/v1/workflow/state
   * 获取执行状态快照
   * Query: traceId, workflowId
   */
  fastify.get('/api/v1/workflow/state', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Querystring: { traceId?: string; workflowId?: string } }>, reply: FastifyReply) => {
    const { traceId, workflowId } = request.query

    // 模拟：如果有 traceId，从 trace 解析状态
    let statusList: any[] = [
      { id: 'script', status: 'success' },
      { id: 'llm-optimize', status: 'success' },
      { id: 'image-gen', status: 'pending' },
      { id: 'video-gen', status: 'pending' },
      { id: 'tts-gen', status: 'pending' },
    ]

    return reply.send({
      success: true,
      data: {
        workflowId: workflowId || 'default',
        traceId: traceId || null,
        nodes: statusList,
      },
    })
  })

  /**
   * POST /api/v1/workflow/replay
   * 回放 workflow
   * Body: { traceId }
   */
  fastify.post('/api/v1/workflow/replay', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Body: { traceId: string; skipSuccessNodes?: boolean } }>, reply: FastifyReply) => {
    const { traceId, skipSuccessNodes } = request.body
    const userId = (request.user as any)?.id

    // 加载用户配置
    const userConfig = await loadFullConfigV2(userId)
    if (!userConfig) {
      return reply.status(400).send({ success: false, error: '请先配置 API Key' })
    }

    // 读取 trace（目前从 execution-trace 服务获取）
    // v1: 从 DB 或 mock 数据
    const { getTraceService } = await import('../runtime/execution-trace/index.js')
    const traceService = getTraceService()
    const trace = await traceService.getTrace(traceId).catch(() => null)

    // 样本 workflow graph
    const sampleGraph = {
      id: 'replay-' + traceId,
      nodes: [
        { id: 'script', type: 'manual.confirm', input: {} },
        { id: 'llm-optimize', type: 'llm.optimize', input: {}, dependsOn: ['script'] },
        { id: 'image-gen', type: 'image.generate', input: {}, dependsOn: ['llm-optimize'] },
        { id: 'video-gen', type: 'video.generate', input: {}, dependsOn: ['image-gen'] },
      ],
    } as any

    const engine = getWorkflowEngine()
    const replayAdapter = new ReplayEngine(engine)
    const result = await replayAdapter.replay(
      sampleGraph,
      trace,
      userConfig,
      userId,
      { skipSuccessNodes },
    )

    return reply.send({
      success: result.success,
      data: result,
    })
  })

  /**
   * GET /api/v1/workflow/timeline/:traceId
   * 执行时间线
   */
  fastify.get('/api/v1/workflow/timeline/:traceId', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ Params: { traceId: string } }>, reply: FastifyReply) => {
    const { traceId } = request.params

    // 从 execution-trace 读取
    const { getTraceService } = await import('../runtime/execution-trace/index.js')
    const traceService = getTraceService()
    const trace = await traceService.getTrace(traceId).catch(() => null)

    if (!trace) {
      return reply.send({
        success: true,
        data: {
          traceId,
          nodes: [],
        },
      })
    }

    // 构建时间线
    const timeline = trace.steps
      .filter(s => s.data?.nodeId)
      .map(s => {
        const nodeType = (s.data as any)?.type || s.name
        return {
          nodeId: s.data?.nodeId || '',
          type: nodeType,
          label: nodeType,
          status: s.name.includes('fail') ? 'failed' as const : s.name.includes('success') ? 'success' as const : 'running' as const,
          durationMs: s.data?.durationMs,
          startTime: s.data?.timestamp,
          error: s.data?.error,
        }
      })

    return reply.send({
      success: true,
      data: {
        traceId,
        nodes: timeline,
      },
    })
  })
}
