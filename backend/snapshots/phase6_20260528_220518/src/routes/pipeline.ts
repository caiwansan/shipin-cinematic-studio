import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Pipeline Stage API
 *
 * 数据库表驱动的组件生产流水线。
 * DAG 定义和 Resolver 位于 dag-runtime.ts，此处只做路由注册。
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { STAGE_GRAPH, STAGE_ORDER, resolveGraph, loadDbStages, recalcBlockedStages } from '../services/dag-runtime.js'

// ══════════════════════════════════════════════════════════
// Routes
// ══════════════════════════════════════════════════════════

export default async function pipelineRoutes(fastify: FastifyInstance) {

  // ── GET /api/pipeline/graph/:projectId — DAG 全图状态
  fastify.get('/api/pipeline/graph/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const dbStages = await loadDbStages(projectId)
    const graph = resolveGraph(STAGE_GRAPH, dbStages)
    return { success: true, data: graph } satisfies ApiResponse<unknown>;

  })

  // ── GET /api/pipeline/stages/:projectId — 兼容旧版：线性排列的状态
  fastify.get('/api/pipeline/stages/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const stages = await prisma.pipelineStage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    const result = STAGE_ORDER.map(key => {
      const found = stages.find(s => s.stageKey === key)
      return {
        stageKey: key,
        status: found?.status || 'pending',
        inputData: found?.inputData,
        outputData: found?.outputData,
        referenceUrls: found?.referenceUrls,
        error: found?.error,
        startedAt: found?.startedAt,
        completedAt: found?.completedAt,
      }
    })

    return { success: true, data: result } satisfies ApiResponse<unknown>;

  })

  // ── GET /api/pipeline/stage/:projectId/:stageKey — 获取单个 stage
  fastify.get('/api/pipeline/stage/:projectId/:stageKey', async (request, reply) => {
    const { projectId, stageKey } = request.params as any
    const stage = await prisma.pipelineStage.findUnique({
      where: { projectId_stageKey: { projectId, stageKey } },
    })
    return {
      success: true,
      data: stage || { stageKey, status: 'pending' },
    }
  })

  // ── PUT /api/pipeline/stage/:projectId/:stageKey — 更新 stage
  fastify.put('/api/pipeline/stage/:projectId/:stageKey', async (request, reply) => {
    const { projectId, stageKey } = request.params as any
    const body = request.body as {
      status?: string
      inputData?: any
      outputData?: any
      referenceUrls?: any
      error?: string
      runtimeVersion?: string
    }

    const now = new Date()
    const updateData: any = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.inputData !== undefined) updateData.inputData = body.inputData
    if (body.outputData !== undefined) updateData.outputData = body.outputData
    if (body.referenceUrls !== undefined) updateData.referenceUrls = body.referenceUrls
    if (body.error !== undefined) updateData.error = body.error
    if (body.runtimeVersion !== undefined) updateData.runtimeVersion = body.runtimeVersion
    if (body.status === 'processing' || body.status === 'pending') updateData.startedAt = now
    if (body.status === 'done' || body.status === 'failed') updateData.completedAt = now

    const stage = await prisma.pipelineStage.upsert({
      where: { projectId_stageKey: { projectId, stageKey } },
      create: {
        projectId,
        stageKey,
        status: body.status || 'pending',
        inputData: body.inputData,
        outputData: body.outputData,
        referenceUrls: body.referenceUrls,
        runtimeVersion: body.runtimeVersion || '0.4',
        error: body.error,
        startedAt: body.status === 'processing' ? now : undefined,
        completedAt: body.status === 'done' || body.status === 'failed' ? now : undefined,
      },
      update: updateData,
    })

    if (body.status === 'done' || body.status === 'failed' || body.status === 'skipped') {
      await recalcBlockedStages(projectId)
    }

    return { success: true, data: stage } satisfies ApiResponse<unknown>;

  })

  // ── GET /api/pipeline/prerequisites/:projectId/:stageKey — 前置依赖检查
  fastify.get('/api/pipeline/prerequisites/:projectId/:stageKey', async (request, reply) => {
    const { projectId, stageKey } = request.params as any
    const def = STAGE_GRAPH[stageKey]
    if (!def) {
      return { success: true, data: { ready: true, missing: [] } } satisfies ApiResponse<unknown>;

    }

    const stages = await prisma.pipelineStage.findMany({
      where: { projectId, stageKey: { in: def.dependsOn } },
    })

    const missing: string[] = []
    for (const dep of def.dependsOn) {
      const found = stages.find(s => s.stageKey === dep)
      if (!found || (found.status !== 'done' && found.status !== 'skipped')) {
        missing.push(dep)
      }
    }

    const dbMap = await loadDbStages(projectId)
    const graph = resolveGraph(STAGE_GRAPH, dbMap)
    const resolved = graph.find(s => s.key === stageKey)

    return {
      success: true,
      data: {
        ready: missing.length === 0,
        missing,
        stageKey,
        def,
        blockedBy: resolved?.blockedBy || [],
        blockReason: resolved?.blockReason,
        graphStatus: resolved?.status,
      },
    }
  })

  // ── POST /api/pipeline/graph/recalc — 手动重算阻塞信息
  fastify.post('/api/pipeline/graph/recalc', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.body as any
    if (!projectId) return reply.status(400).send({ success: false, error: 'projectId required' })
    await recalcBlockedStages(projectId)
    return { success: true } satisfies ApiResponse<unknown>;

  })

  // ── GET /api/pipeline/references/:projectId/:type
  fastify.get('/api/pipeline/references/:projectId/:type', async (request, reply) => {
    const { projectId, type } = request.params as any

    let images: any[] = []
    switch (type) {
      case 'character_image':
        images = await prisma.characterImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
        break
      case 'scene_image':
        images = await prisma.sceneImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
        break
      case 'storyboard_image':
        images = await prisma.storyboardImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
        break
      case 'frame_image':
        images = await prisma.frameImage.findMany({ where: { projectId } })
        break
      default:
        return reply.status(400).send({ success: false, error: `unknown type: ${type}` })
    }

    return { success: true, data: images } satisfies ApiResponse<unknown>;

  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

