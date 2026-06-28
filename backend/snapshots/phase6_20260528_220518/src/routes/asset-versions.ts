/**
 * routes/asset-versions.ts — 版本系统 API
 *
 * 前缀 /api/workflow/asset-versions（不与 asset-registry 的 :projectId 冲突）
 *
 * API 规则：
 *   - 所有 GET 只读
 *   - POST rollback 调用 VersionWriter + StateMachine
 */

import { FastifyInstance } from 'fastify'
import { assetVersionService } from '../services/asset-version.service.js'
import { assetRollbackService } from '../services/asset-rollback.service.js'
import { RuntimeValidator } from '../services/runtime-validator.js'
import { diffObjects, summarizeDiff } from '../services/asset-diff-schema.js'

export default async function assetVersionRoutes(fastify: FastifyInstance) {
  // 获取资产的所有版本
  fastify.get('/api/workflow/asset-versions/:id/versions', async (request, reply) => {
    try {
      const { id } = request.params as any
      const versions = await assetVersionService.listVersions(id)
      return RuntimeValidator.ok(versions)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 获取指定版本快照
  fastify.get('/api/workflow/asset-versions/:id/versions/:version', async (request, reply) => {
    try {
      const { id, version } = request.params as any
      const vNum = parseInt(version, 10)
      const versionData = await assetVersionService.getVersion(id, vNum)
      const validated = RuntimeValidator.validateAssetExists(versionData, `v${vNum}`)
      if (!validated.success) {
        return reply.status(404).send(validated)
      }
      return RuntimeValidator.ok(versionData)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 版本 lineage
  fastify.get('/api/workflow/asset-versions/:id/lineage', async (request, reply) => {
    try {
      const { id } = request.params as any
      const lineage = await assetVersionService.getLineage(id)
      return RuntimeValidator.ok(lineage)
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 比较两个版本
  fastify.get('/api/workflow/asset-versions/:id/diff', async (request, reply) => {
    try {
      const { id } = request.params as any
      const { v1, v2 } = request.query as any

      const versionA = await assetVersionService.getVersion(id, parseInt(v1, 10))
      const versionB = await assetVersionService.getVersion(id, parseInt(v2, 10))

      if (!versionA || !versionB) {
        return RuntimeValidator.fail({
          code: 'VERSION_NOT_FOUND',
          message: '指定版本不存在',
        })
      }

      const diff = diffObjects(
        versionA.content as Record<string, any>,
        versionB.content as Record<string, any>,
        parseInt(v1, 10),
        parseInt(v2, 10),
      )

      return RuntimeValidator.ok({
        diff,
        summary: summarizeDiff(diff),
      })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 回滚到指定版本
  fastify.post('/api/workflow/asset-versions/:id/versions/:version/rollback', async (request, reply) => {
    try {
      const { id, version } = request.params as any
      const { actor } = request.body as any

      const result = await assetRollbackService.rollback({
        assetRegistryId: id,
        targetVersion: parseInt(version, 10),
        actor: ['user', 'system', 'agent'].includes(actor) ? actor : 'user',
      })

      return RuntimeValidator.ok({
        newVersion: result.newVersion.version,
        diff: result.diff,
        summary: result.diff ? summarizeDiff(result.diff) : '无变化',
      })
    } catch (err: any) {
      if (err.message?.includes('状态不允许')) {
        return reply.send(RuntimeValidator.fail({
          code: 'TRANSITION_FAILED',
          message: err.message,
        }))
      }
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
