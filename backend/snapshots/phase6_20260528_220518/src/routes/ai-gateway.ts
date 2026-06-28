/**
 * routes/ai-gateway.ts — AI Gateway API 路由
 *
 * 提供 REST 接口调用 UnifiedAIGateway
 * 所有内部调用也走此路由（确保追踪 + 审计）
 */

import { FastifyInstance } from 'fastify'
import { unifiedAIGateway } from '../services/unified-ai-gateway.js'
import { invocationLogService } from '../services/invocation-log.service.js'
import { RuntimeValidator } from '../services/runtime-validator.js'

export default async function aiGatewayRoutes(fastify: FastifyInstance) {
  // 调用 AI（带完整信封）
  fastify.post('/api/v1/ai/invoke', async (request, reply) => {
    try {
      const body = request.body as any
      const result = await unifiedAIGateway.invokeAI({
        userId: body.userId || 'default',
        projectId: body.projectId,
        agentType: body.agentType || 'orchestrator',
        capability: body.capability || 'llm',
        input: body.input,
        assetRegistryId: body.assetRegistryId,
        parentTraceId: body.parentTraceId,
      })
      return RuntimeValidator.ok({
        traceId: result.traceId,
        status: result.status,
        output: result.output,
        latencyMs: result.latencyMs,
        error: result.error,
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 获取调用日志
  fastify.get('/api/v1/ai/logs', async (request, reply) => {
    try {
      const query = request.query as any
      const logs = await invocationLogService.getLogs({
        projectId: query.projectId,
        userId: query.userId,
        traceId: query.traceId,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      })
      return RuntimeValidator.ok(logs)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 获取 trace 链
  fastify.get('/api/v1/ai/trace/:traceId', async (request, reply) => {
    try {
      const { traceId } = request.params as any
      const logs = await invocationLogService.getLogs({ traceId })
      return RuntimeValidator.ok(logs)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 获取资产的 AI 调用链
  fastify.get('/api/v1/ai/asset-trace/:assetRegistryId', async (request, reply) => {
    try {
      const { assetRegistryId } = request.params as any
      const trace = await invocationLogService.getAssetTrace(assetRegistryId)
      return RuntimeValidator.ok(trace)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
