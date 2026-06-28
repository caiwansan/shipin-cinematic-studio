/**
 * 混沌珠 Phase X — 叙事引擎新内核路由
 * Entity Registry + World State + Scene DAG 管理
 * Shadow 模式：仅记录，不阻断旧链路
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import * as entityRegistryService from '../../services/hdz/entity-registry.service.js'
import * as worldStateService from '../../services/hdz/world-state.service.js'
import { sceneCompiler } from '../../services/hdz/scene-compiler.service.js'
import { consistencyVerifier } from '../../services/hdz/consistency-verifier.service.js'
import { alignmentMetricService } from '../../services/hdz/alignment-metric.service.js'
import { alignmentBacktestService } from '../../services/hdz/alignment-backtest.service.js'
import { driftAnalyzerService } from '../../services/hdz/drift-analyzer.service.js'

export default async function hdzPhaseXRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // ════════════════════════════════════
  //  Entity Registry API
  // ════════════════════════════════════

  // GET /api/hdz/phasex/entities/:projectId — 获取项目所有实体
  app.get('/api/hdz/phasex/entities/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const entities = await entityRegistryService.getAllEntities(projectId)
    return { success: true, data: entities }
  })

  // POST /api/hdz/phasex/entities/:projectId — 注册实体
  app.post('/api/hdz/phasex/entities/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { name, entityType, aliases } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    if (!name?.trim() || !entityType) {
      return reply.status(400).send({ success: false, error: '缺少 name 或 entityType' })
    }

    const id = await entityRegistryService.resolveName(projectId, name, entityType)
    // 自动初始化世界状态
    await worldStateService.initEntityState(projectId, id)
    return { success: true, data: { id, name, entityType } }
  })

  // POST /api/hdz/phasex/entities/:projectId/migrate — 迁移已有角色到 EntityRegistry
  app.post('/api/hdz/phasex/entities/:projectId/migrate', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const charCount = await entityRegistryService.migrateAllCharacters(projectId)
    const wsCount = await worldStateService.migrateCharactersToWorldState(projectId)
    return { success: true, data: { charactersMigrated: charCount, statesInitialized: wsCount } }
  })

  // ════════════════════════════════════
  //  World State API
  // ════════════════════════════════════

  // GET /api/hdz/phasex/world-state/:projectId — 获取项目完整世界状态
  app.get('/api/hdz/phasex/world-state/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const state = await worldStateService.getWorldState(projectId)
    const result: any[] = []
    for (const [, entityState] of state) {
      const entity = await entityRegistryService.getEntityById(entityState.entityId)
      result.push({
        entityId: entityState.entityId,
        name: entity?.name || '未知',
        state: {
          health: entityState.health,
          location: entityState.location,
          inventory: entityState.inventory,
          relationships: entityState.relationships,
          statusFlags: entityState.statusFlags,
        },
        version: entityState.version,
        updatedAt: entityState.updatedAt,
      })
    }
    return { success: true, data: result }
  })

  // ════════════════════════════════════
  //  Scene Compiler API (Shadow Mode)
  // ════════════════════════════════════

  // POST /api/hdz/phasex/scene/compile — 编译 SceneGraph（Shadow 模式）
  app.post('/api/hdz/phasex/scene/compile', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterNo, sceneNo, outline } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const graph = await sceneCompiler.compile({
      projectId,
      chapterNo: chapterNo || 1,
      chapterTitle: '',
      sceneNo: sceneNo || 1,
      outline: outline || '',
    })

    return { success: true, data: graph }
  })

  // ════════════════════════════════════
  //  Consistency Verifier API (Shadow Mode)
  // ════════════════════════════════════

  // POST /api/hdz/phasex/verify — 执行一致性校验
  app.post('/api/hdz/phasex/verify', async (request, reply) => {
    const user = request.user as any
    const { projectId, deltas, chapterNo } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const result = await consistencyVerifier.verify(
      projectId,
      deltas || [],
      chapterNo || 1,
    )

    return { success: true, data: result }
  })

  // ════════════════════════════════════
  //  Plot DAG API
  // ════════════════════════════════════

  // GET /api/hdz/phasex/dag/:projectId — 获取项目的 Plot DAG
  app.get('/api/hdz/phasex/dag/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const scenes = await prisma.sceneDag.findMany({
      where: { projectId },
      orderBy: [{ chapterNo: 'asc' }, { sceneNo: 'asc' }],
      select: {
        sceneId: true,
        chapterNo: true,
        sceneNo: true,
        dagJson: true,
        createdAt: true,
      },
    })

    const edges = await prisma.plotDagEdge.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })

    return { success: true, data: { scenes, edges } }
  })

  // POST /api/hdz/phasex/dag/:projectId/edge — 添加 DAG 边
  app.post('/api/hdz/phasex/dag/:projectId/edge', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { sourceId, targetId, edgeType, metadata } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const edge = await prisma.plotDagEdge.create({
      data: {
        projectId,
        sourceId,
        targetId,
        edgeType: edgeType || 'causality',
        metadata: metadata || {},
      },
    })
    return { success: true, data: edge }
  })

  // ════════════════════════════════════
  //  Shadow Mode — Writer 旧/新上下文比较
  // ════════════════════════════════════

  // POST /api/hdz/phasex/shadow/context-diff — 记录旧/新上下文差异
  app.post('/api/hdz/phasex/shadow/context-diff', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterNo, legacySize, sceneSize } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    await sceneCompiler.logContextDivergence(projectId, chapterNo, legacySize, sceneSize)
    return { success: true }
  })

  // ════════════════════════════════════
  //  Phase X.3 — Alignment Metrics API
  // ════════════════════════════════════

  // POST /api/hdz/phasex/metrics/alignment — 提交对齐评分（Writer 双轨输出调用）
  app.post('/api/hdz/phasex/metrics/alignment', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterId, writerOutput, sceneGraph, worldStateSnapshot } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const sceneEntities = sceneGraph?.involvedEntities || []
    const delta = alignmentMetricService.extractDeltaFromText(
      writerOutput?.text || '',
      sceneEntities,
    )

    // 构建世界状态快照（从 writerOutput 中的 state_delta 提取）
    const worldSnapshot = new Map()
    if (delta.delta.length > 0) {
      for (const d of delta.delta) {
        worldSnapshot.set(d.entityId, { entityId: d.entityId, health: d.health, inventory: d.inventoryAdd || [], statusFlags: { isAlive: true } })
      }
    }

    const score = alignmentMetricService.calculateAlignmentScore(
      sceneEntities,
      delta.delta,
      worldSnapshot,
    )

    // 持久化
    await alignmentMetricService.persistAlignmentRecord(
      projectId, chapterId, 0, score, delta.delta,
    )

    // Shadow 校验
    const verifyResult = await consistencyVerifier.onShadowDeltaGenerated(
      projectId, delta.delta, 0,
    )

    return {
      success: true,
      data: {
        score,
        delta: delta.delta,
        parseConfidence: delta.confidence,
        shadowVerify: verifyResult,
      },
    }
  })

  // GET /api/hdz/phasex/metrics/alignment/:projectId — 获取对齐评分汇总
  app.get('/api/hdz/phasex/metrics/alignment/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const query = request.query as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const summary = await alignmentMetricService.getAlignmentSummary(
      projectId,
      query.startChapter ? parseInt(query.startChapter) : undefined,
      query.endChapter ? parseInt(query.endChapter) : undefined,
    )

    return { success: true, data: summary }
  })

  // ════════════════════════════════════
  //  Phase X.3.6 — Offline Backtest
  // ════════════════════════════════════

  // POST /api/hdz/phasex/metrics/backtest/:projectId — 运行回放分析
  app.post('/api/hdz/phasex/metrics/backtest/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { startChapter, endChapter } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    console.log(`[API] Backtest started: project=${projectId}, ch${startChapter}–${endChapter}`)

    const result = await alignmentBacktestService.runBacktest(
      projectId,
      startChapter || 1,
      endChapter || 500,
    )

    return { success: true, data: result }
  })

  // GET /api/hdz/phasex/metrics/backtest/:projectId — 获取最新回放结果
  app.get('/api/hdz/phasex/metrics/backtest/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 从 metrics 表中聚合展示
    const mcount = await prisma.$queryRaw`
      SELECT COUNT(*) AS cnt, ROUND(AVG(("scoreJson"->>'overall_score')::numeric), 3) AS avg_score
      FROM writer_alignment_metrics WHERE "projectId" = ${projectId}::uuid
    ` as any[]

    const chapterList = await prisma.$queryRaw`
      SELECT
        LEFT("chapterId"::text, 8) AS ch,
        ROUND((("scoreJson"->>'overall_score')::numeric), 3) AS score,
        "createdAt"
      FROM writer_alignment_metrics
      WHERE "projectId" = ${projectId}::uuid
      ORDER BY "createdAt" DESC
      LIMIT 60
    ` as any[]

    return {
      success: true,
      data: {
        totalRecords: mcount[0]?.cnt || 0,
        avgScore: mcount[0]?.avg_score || 0,
        recentChapters: chapterList,
      },
    }
  })

  // ════════════════════════════════════
  //  Phase X.3.8 — Drift Analysis
  // ════════════════════════════════════

  // GET /api/hdz/phasex/drift/:projectId — 运行漂移分析
  app.get('/api/hdz/phasex/drift/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const report = await driftAnalyzerService.analyzeProject(projectId)
    return { success: true, data: report }
  })
}
