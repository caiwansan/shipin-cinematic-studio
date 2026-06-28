/**
 * routes/asset-cards.ts — 卡片系统 API
 *
 * C1: 卡片渲染
 * C2: 优化触发
 */

import { FastifyInstance } from 'fastify'
import { cardRenderEngine } from '../services/card-render.engine.js'
import { optimizationEngine } from '../services/optimization-engine.js'
import { RuntimeValidator } from '../services/runtime-validator.js'

export default async function assetCardRoutes(fastify: FastifyInstance) {
  // C1: 获取项目所有卡片
  fastify.get('/api/v1/cards/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const { type } = request.query as any

      const cards = type
        ? await cardRenderEngine.renderCardsByType(projectId, type as any)
        : await cardRenderEngine.renderProjectCards(projectId)

      return RuntimeValidator.ok(cards)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // C1: 获取单个卡片
  fastify.get('/api/v1/cards/:projectId/:assetId', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      const card = await cardRenderEngine.renderCard(assetId)
      const validated = RuntimeValidator.validateAssetExists(card, 'card')
      if (!validated.success) {
        return reply.status(404).send(validated)
      }
      return RuntimeValidator.ok(card)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // C2: 优化指定卡片
  fastify.post('/api/v1/cards/:projectId/:assetId/optimize', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      const body = request.body as any

      const result = await optimizationEngine.optimize({
        assetRegistryId: assetId,
        userId: body.userId || 'default',
        projectId: body.projectId || (request.params as any).projectId,
        agentType: body.agentType || 'optimization_agent',
        optimizationTarget: body.target,
      })

      return RuntimeValidator.ok({
        newVersion: result.newVersion,
        diffSummary: result.diffSummary,
        traceId: result.traceId,
      })
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('不存在')) {
        return reply.status(404).send(RuntimeValidator.fail({ code: 'NOT_FOUND', message: msg }))
      }
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // C2: 批量优化
  fastify.post('/api/v1/cards/:projectId/batch-optimize', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const body = request.body as any
      const assetIds: string[] = body.assetIds || []

      if (!assetIds.length) {
        return RuntimeValidator.fail({ code: 'INVALID_INPUT', message: '请指定要优化的资产 ID' })
      }

      const results: any[] = []
      for (const assetId of assetIds) {
        try {
          const result = await optimizationEngine.optimize({
            assetRegistryId: assetId,
            userId: body.userId || 'default',
            projectId,
            agentType: body.agentType || 'optimization_agent',
            optimizationTarget: body.target,
          })
          results.push({ assetId, success: true, ...result })
        } catch (err: any) {
          results.push({ assetId, success: false, error: err.message })
        }
      }

      return RuntimeValidator.ok({ batch: results, total: results.length, succeeded: results.filter(r => r.success).length })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
