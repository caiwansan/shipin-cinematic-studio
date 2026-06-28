/**
 * 昆仑镜 v2 — Human-in-the-loop API
 *
 * 人机协同工作流：
 * - 锁定/解锁 AssetVersion
 * - 用户编辑创建新版本 (userEdited = true)
 * - 上传参考图绑定到 AssetVersion
 * - Stage 进度控制 (角色/场景/分镜/视频)
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { RuntimeValidator } from '../services/runtime-validator.js'
import { StateMachine } from '../runtime/asset-state-machine.js'

export default async function hitlRoutes(fastify: FastifyInstance) {
  // ─── 锁定/解锁资产 ───

  fastify.post('/api/v1/asset/:assetId/lock', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      // 锁定当前版本
      const latest = await prisma.assetVersion.findFirst({
        where: { assetRegistryId: assetId },
        orderBy: { version: 'desc' },
      })
      if (!latest) return RuntimeValidator.fail({ code: 'NO_VERSION', message: '资产无版本' })

      await prisma.assetVersion.update({
        where: { id: latest.id },
        data: { locked: true },
      })

      // 标记 AssetRegistry 状态
      await prisma.assetRegistry.update({
        where: { id: assetId },
        data: { status: 'approved' },
      })

      return RuntimeValidator.ok({ assetId, version: latest.version, locked: true })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  fastify.post('/api/v1/asset/:assetId/unlock', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      const latest = await prisma.assetVersion.findFirst({
        where: { assetRegistryId: assetId },
        orderBy: { version: 'desc' },
      })
      if (!latest) return RuntimeValidator.fail({ code: 'NO_VERSION', message: '资产无版本' })

      await prisma.assetVersion.update({
        where: { id: latest.id },
        data: { locked: false },
      })

      await prisma.assetRegistry.update({
        where: { id: assetId },
        data: { status: 'draft' },
      })

      return RuntimeValidator.ok({ assetId, version: latest.version, locked: false })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // ─── 用户编辑 → 创建新版本 ───

  fastify.post('/api/v1/asset/:assetId/user-edit', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      const { content, prompt } = request.body as any

      const registry = await prisma.assetRegistry.findUnique({ where: { id: assetId } })
      if (!registry) return RuntimeValidator.fail({ code: 'NOT_FOUND', message: '资产不存在' })

      const newVersion = registry.currentVersion + 1

      // 获取当前 AI 版本号作为 parent
      const latest = await prisma.assetVersion.findFirst({
        where: { assetRegistryId: assetId },
        orderBy: { version: 'desc' },
      })

      await prisma.assetVersion.create({
        data: {
          assetRegistryId: assetId,
          version: newVersion,
          content: content || latest?.content || {},
          prompt: prompt ? JSON.parse(prompt) : latest?.prompt,
          userEdited: true,
          parentVersion: latest ? (latest.userEdited ? latest.parentVersion || latest.version : latest.version) : null,
          optimizationType: 'user_edit',
          agent: 'human',
          diffSummary: '用户手动编辑',
        },
      })

      await prisma.assetRegistry.update({
        where: { id: assetId },
        data: { currentVersion: newVersion, status: 'draft' },
      })

      return RuntimeValidator.ok({ assetId, version: newVersion, userEdited: true })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // ─── 上传参考图 → 绑定到版本 ───

  fastify.post('/api/v1/asset/:assetId/reference-image', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      const { imageUrl } = request.body as any

      const latest = await prisma.assetVersion.findFirst({
        where: { assetRegistryId: assetId },
        orderBy: { version: 'desc' },
      })
      if (!latest) return RuntimeValidator.fail({ code: 'NO_VERSION', message: '资产无版本' })

      const existing = (latest.referenceImages as string[]) || []
      existing.push(imageUrl)

      await prisma.assetVersion.update({
        where: { id: latest.id },
        data: { referenceImages: existing },
      })

      return RuntimeValidator.ok({ assetId, version: latest.version, referenceImages: existing })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // 删除参考图
  fastify.delete('/api/v1/asset/:assetId/reference-image', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      const { imageUrl } = request.body as any

      const latest = await prisma.assetVersion.findFirst({
        where: { assetRegistryId: assetId },
        orderBy: { version: 'desc' },
      })
      if (!latest) return RuntimeValidator.fail({ code: 'NO_VERSION', message: '资产无版本' })

      const existing = ((latest.referenceImages as string[]) || []).filter((u: string) => u !== imageUrl)

      await prisma.assetVersion.update({
        where: { id: latest.id },
        data: { referenceImages: existing },
      })

      return RuntimeValidator.ok({ assetId, version: latest.version, referenceImages: existing })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // ─── 获取资产所有版本的"版本树"（AI/用户/锁定） ───

  fastify.get('/api/v1/asset/:assetId/version-tree', async (request, reply) => {
    try {
      const { assetId } = request.params as any
      const versions = await prisma.assetVersion.findMany({
        where: { assetRegistryId: assetId },
        orderBy: { version: 'asc' },
        select: {
          id: true,
          version: true,
          userEdited: true,
          locked: true,
          parentVersion: true,
          optimizationType: true,
          referenceImages: true,
          createdAt: true,
        },
      })

      // 构建版本树
      const tree = versions.map(v => ({
        version: v.version,
        type: v.userEdited ? 'user' : 'ai',
        locked: v.locked,
        parentVersion: v.parentVersion,
        label: v.optimizationType === 'user_edit' ? '用户编辑'
          : v.optimizationType === 'optimize' ? 'AI 优化'
          : v.optimizationType === 'initial' ? 'AI 生成'
          : `v${v.version}`,
        hasReference: (v.referenceImages as string[] || []).length > 0,
      }))

      return RuntimeValidator.ok({ assetId, versions: tree })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })

  // ─── Stage 进度控制 ───

  // 获取项目 Stage 状态
  fastify.get('/api/v1/project/:projectId/stage', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      const stages = ['character', 'scene', 'storyboard', 'video']

      // 统计每个 stage 已锁定的资产数
      const assets = await prisma.assetRegistry.findMany({
        where: { projectId, type: { in: stages } },
        select: { type: true, status: true },
      })

      const stageStats: Record<string, { total: number; locked: number }> = {}
      for (const s of stages) {
        const typeAssets = assets.filter(a => a.type === s)
        stageStats[s] = {
          total: typeAssets.length,
          locked: typeAssets.filter(a => a.status === 'approved').length,
        }
      }

      // 计算当前阶段
      let currentStage = 'character'
      for (const s of stages) {
        if (stageStats[s] && stageStats[s].total > 0 && stageStats[s].locked === stageStats[s].total) {
          currentStage = s
        } else if (stageStats[s] && stageStats[s].total > 0) {
          currentStage = s
          break
        } else {
          currentStage = s
          break
        }
      }

      return RuntimeValidator.ok({ projectId, stages: stageStats, currentStage })
    } catch (err: any) {
      return reply.status(500).send(RuntimeValidator.internalError(err))
    }
  })
}
