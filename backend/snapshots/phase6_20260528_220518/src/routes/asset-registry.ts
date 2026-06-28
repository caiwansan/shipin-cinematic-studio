/**
 * routes/asset-registry.ts — 资产注册中心路由
 */

import { FastifyInstance } from 'fastify'
import { assetRegistry } from '../services/asset-registry.service.js'
import { RuntimeValidator } from '../services/runtime-validator.js'
import { AssetStateMachine } from '../runtime/asset-state-machine.js'

const VALID_TYPES = ['character', 'scene', 'prop', 'storyboard', 'shot', 'keyframe'] as const
const VALID_STATUSES = ['draft', 'processing', 'optimized', 'approved', 'generating', 'partial_failed', 'generated', 'failed', 'locked', 'archived'] as const

export default async function assetRegistryRoutes(fastify: FastifyInstance) {
  // 获取项目所有注册资产
  fastify.get('/api/workflow/asset-registry/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const { type } = request.query as any

      if (type && !VALID_TYPES.includes(type)) {
        return reply.send(RuntimeValidator.fail({
          code: 'INVALID_TYPE',
          message: `不支持的资产类型: ${type}`,
        }))
      }

      const assets = await assetRegistry.listByProject(projectId, type)
      return RuntimeValidator.ok(assets)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 获取单个资产注册
  fastify.get('/api/workflow/asset-registry/detail/:id', async (request, reply) => {
    try {
      const { id } = request.params as any
      const asset = await assetRegistry.getById(id)
      const validated = RuntimeValidator.validateAssetExists(asset, id)
      if (!validated.success) {
        return reply.status(404).send(validated)
      }
      return RuntimeValidator.ok(asset)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 更新资产状态 — 必须走 StateMachine.transition()
  fastify.put('/api/workflow/asset-registry/:id/status', async (request, reply) => {
    try {
      const { id } = request.params as any
      const { status, actor, reason } = request.body as any

      if (!status) {
        return reply.send(RuntimeValidator.fail({
          code: 'MISSING_STATUS',
          message: '缺少 status 字段',
        }))
      }

      if (!VALID_STATUSES.includes(status)) {
        return reply.send(RuntimeValidator.fail({
          code: 'INVALID_STATUS',
          message: `不支持的状态: ${status}`,
        }))
      }

      // 走 StateMachine：所有状态变更的唯一入口
      await AssetStateMachine.transition({
        assetId: id,
        targetStatus: status,
        actor: actor || 'api',
        reason,
      })

      const asset = await assetRegistry.getById(id)
      return RuntimeValidator.ok(asset)
    } catch (err: any) {
      // 如果校验失败，格式化为标准错误结构
      return reply.send(RuntimeValidator.fail({
        code: 'TRANSITION_FAILED',
        message: err.message || '状态变更失败',
      }))
    }
  })
}
