/**
 * routes/continuity.ts — 连续性与视频流水线 API
 *
 * ETFL-EDCL: ORCHESTRATION DOMAIN
 * - 禁止直接调用 model/provider/adapter
 * - 仅允许生成 execution plan
 * - 不得 bypass SECS/queue 执行
 */

import { FastifyInstance } from 'fastify'
import { continuityLinkEngine } from '../services/continuity-link.service.js'
import { temporalGraphEngine } from '../services/temporal-graph.engine.js'
import { videoPipelineEngine } from '../services/video-pipeline.engine.js'
import { shotResolver } from '../services/shot-resolver.service.js'
import { RuntimeValidator } from '../services/runtime-validator.js'

export default async function continuityRoutes(fastify: FastifyInstance) {
  // D1: 创建连续性链接
  fastify.post('/api/v1/continuity/link', async (request, reply) => {
    try {
      const body = request.body as any
      const link = await continuityLinkEngine.createLink({
        projectId: body.projectId,
        fromSegmentId: body.fromSegmentId || body.fromAssetId,
        toSegmentId: body.toSegmentId || body.toAssetId,
        linkType: body.linkType || body.type || 'next_scene',
        fromType: body.fromType,
        toType: body.toType,
        inheritedContent: body.inheritedContent,
      })
      return RuntimeValidator.ok(link)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // D1: 获取时间线
  fastify.get('/api/v1/continuity/timeline/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const timeline = await temporalGraphEngine.rebuildTimeline(projectId)
      return RuntimeValidator.ok(timeline)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // D1: 获取有向序列
  fastify.get('/api/v1/continuity/sequence/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const sequence = await continuityLinkEngine.getOrderedSequence(projectId)
      return RuntimeValidator.ok(sequence)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // D2: 获取镜头计划
  fastify.get('/api/v1/continuity/shot-plan/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const plan = await shotResolver.resolveShotPlan(projectId)
      return RuntimeValidator.ok({
        totalShots: plan.shots.length,
        shots: plan.shots.map(s => ({
          shotIndex: s.shotIndex,
          assetId: s.assetId,
          content: s.content,
        })),
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // D2: 执行视频生成流水线
  fastify.post('/api/v1/continuity/generate', async (request, reply) => {
    try {
      const body = request.body as any
      const result = await videoPipelineEngine.generate({
        projectId: body.projectId,
        userId: body.userId,
      })
      return RuntimeValidator.ok(result)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // D2: 组装最终视频
  fastify.post('/api/v1/continuity/assemble', async (request, reply) => {
    try {
      const body = request.body as any
      const result = await videoPipelineEngine.assemble(body.projectId)
      return RuntimeValidator.ok(result)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
