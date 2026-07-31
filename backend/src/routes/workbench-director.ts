/**
 * routes/workbench-director.ts
 * @deprecated 未注册到 app，不可进入生产路径。
 * 使用 routes/director-v2.ts 和 routes/director-execution.route.ts 替代。
 * （2026-07-31 Task 01.5 Reality Verification 确认）
 * （Phase5 Runtime Boundary Cleanup：/api/workbench/* 运行时实测 404，前端 6 处调用全部落空）
 *
 * 🎬 昆仑镜叙事导演工作台 — 产品化 API 层
 *
 * 每个路由封装 "一步产品操作 = 多步 OS 流程"。
 *
 * 设计原则：
 *   - 用户输入 → 可追踪的渲染任务（端到端闭环）
 *   - 每条请求都有 traceId
 *   - 所有 mock 数据在第一步移除后即可用也能跑
 */

import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { requireMemberTierByPolicy } from '../middleware/require-member-tier.js'
import { directorRuntime, logDirectorEvent } from '../director-runtime/core.js'
import { compileBlueprint } from '../director-runtime/director-to-blueprint-compiler.js'
import { matchDirector } from '../director-registry/index.js'
import { freezeBlueprint } from '../production-loop/blueprint-freeze.js'
import { JobStateMachine } from '../production-loop/job-state-machine.js'
import { RealTaskRenderer } from '../production-loop/real-task-adapter.js'
import { RenderJob } from '../production-loop/job-types.js'
import { DAGBuilder } from '../production-loop/dag-builder.js'
import { ReplayEngine } from '../production-loop/replay-engine.js'
import { ObservatoryMapper } from '../execution-observatory/obs-mapper.js'
import { traceCollector } from '../replay-engine/director-trace-collector.js'
import { replayEmitter } from '../replay-engine/replay-data-emitter.js'
import { handleBuildGraph, handleEditNode, handleGetShotChain, handleGetTopology, handleClearCache } from '../causal-graph/causal-api-handler.js'
import { handleValidateNarrative, handleDualPassGate, handleNarrativeSummary } from '../narrative-constraint/narrative-api-handler.js'
import { handleCreateIR, handleCompile, handleGetIR, handleMigrateFromLegacy, handleClearIR } from '../director-ir/director-ir-api-handler.js'
import { handleParseTIR, handleSerializeTIR, handleValidateTIR } from '../tir/tir-api-handler.js'
import { handleTIRFreezeStatus } from '../tir/tir-freeze-api.js'

// ── 简易 traceId ──
function traceId(): string {
  return `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Mock Job Store（已接入 production-loop） ──
export const mockJobs = new Map<string, RenderJob>()
const stateMachine = new JobStateMachine()
const realRenderer = new RealTaskRenderer()
const dagBuilder = new DAGBuilder()
const replayEngine = new ReplayEngine()
const obsMapper = new ObservatoryMapper()

// ── 路由 ──

export default async function workbenchRoutes(app: FastifyInstance) {
  // ============================================
  // POST /api/workbench/generate-director
  // 产品操作: "输入故事 → 生成导演方案"
  // OS 链路: Director Runtime → Convergence → NarrativeGraph
  // ============================================
  app.post('/api/workbench/generate-director', { preHandler: requireMemberTierByPolicy('director.generate') }, async (req, reply) => {
    const tid = traceId()
    const { story } = req.body as { story: string }

    if (!story || story.trim().length === 0) {
      return reply.status(400).send({ traceId: tid, error: '请输入故事内容' })
    }

    req.log.info(`[${tid}] generate-director: story="${story.slice(0, 50)}..."`)

    try {
      const plan = await directorRuntime.analyze({
        userIntent: story,
        constraints: { pacing: 'normal' as const },
      })

      const graph = (plan as any).narrativeGraph ?? { nodes: [], edges: [] }

      req.log.info(`[${tid}] Director 完成: ${plan.sceneSegmentation.length} scenes, ${graph.nodes?.length ?? 0} causal nodes`)

      return {
        traceId: tid,
        directorPlan: plan,
        narrativeGraph: graph,
      }
    } catch (e) {
      req.log.error(`[${tid}] generate-director 失败: ${(e as Error).message}`)
      return reply.status(500).send({ traceId: tid, error: '导演方案生成失败，请调整故事描述' })
    }
  })

  // ============================================
  // POST /api/workbench/compile-blueprint
  // 产品操作: "确认叙事结构 → 生成分镜"
  // OS 链路: compileBlueprint
  // ============================================
  app.post('/api/workbench/compile-blueprint', { preHandler: requireMemberTierByPolicy('director.compileBlueprint') }, async (req, reply) => {
    const tid = traceId()
    const { directorPlan, narrativeGraph } = req.body as { directorPlan: any; narrativeGraph: any }

    if (!directorPlan || !narrativeGraph) {
      return reply.status(400).send({ traceId: tid, error: '缺少 DirectorPlan 或 NarrativeGraph' })
    }

    req.log.info(`[${tid}] compile-blueprint: ${directorPlan.sceneSegmentation?.length ?? 0} scenes`)

    try {
      const blueprint = compileBlueprint(directorPlan, narrativeGraph)

      req.log.info(`[${tid}] Blueprint 编译完成: shots=${blueprint.shotGraph?.shots?.length ?? 0}`)

      return { traceId: tid, blueprint }
    } catch (e) {
      req.log.error(`[${tid}] compile-blueprint 失败: ${(e as Error).message}`)
      return reply.status(500).send({ traceId: tid, error: '分镜生成失败' })
    }
  })

  // ============================================
  // POST /api/workbench/render
  // 产品操作: "一键生成视频"
  // OS 链路: → Job Queue（mocked for now）→ mock video URL
  // ============================================
  app.post('/api/workbench/render', { preHandler: requireMemberTierByPolicy('director.render') }, async (req, reply) => {
    const tid = traceId()
    const { blueprint } = req.body as { blueprint: any }

    if (!blueprint) {
      return reply.status(400).send({ traceId: tid, error: '缺少 Blueprint' })
    }

    req.log.info(`[${tid}] render: blueprint=${blueprint.compiledPrompt?.slice(0, 40) ?? 'no-prompt'}...`)

    try {
      // 1. freeze raw blueprint → 不可变契约
      const frozen = freezeBlueprint(blueprint)
      req.log.info(`[${tid}] blueprint frozen: ${frozen.blueprintId.slice(0, 12)}...`)

      // 2. create job (PENDING)
      const job: RenderJob = {
        id: `${tid}-${Date.now()}`,
        traceId: tid,
        state: 'PENDING',
        blueprint: frozen,
        updatedAt: Date.now(),
      }
      mockJobs.set(job.id, job)
      mockJobs.set(job.traceId, job)

      // 3. 通过真实 Task Adapter 提交到 BullMQ
      const result = await realRenderer.render({ traceId: tid, blueprint: frozen })

      // 4. 更新 job 状态
      const dispatched = stateMachine.transition(job, 'DISPATCHED')
      const done = stateMachine.transition(dispatched, result.meta?.taskIds?.length ? 'DONE' : 'FAILED')
      done.result = result
      mockJobs.set(job.id, done)
      mockJobs.set(job.traceId, done)

      req.log.info(`[${tid}] render done: ${result.meta?.taskCount || 0} real tasks queued`)

      return {
        jobId: done.id,
        traceId: done.traceId,
        state: done.state,
        result: result,
      }
    } catch (e) {
      req.log.error(`[${tid}] render 失败: ${(e as Error).message}`)
      return reply.status(500).send({ traceId: tid, error: '渲染任务创建失败' })
    }
  })

  // ============================================
  // GET /api/workbench/jobs/:id
  // 产品操作: "查看渲染状态"
  // ============================================
  app.get('/api/workbench/jobs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const tid = traceId()

    const job = mockJobs.get(id)
    if (!job) {
      return reply.status(404).send({ traceId: tid, error: '渲染任务不存在' })
    }

    req.log.info(`[${tid}] 查询任务 ${id}: state=${job.state}`)

    return {
      ...job,
      // 不返回完整 blueprint（太大了）
      blueprint: undefined,
    }
  })

  // ============================================
  // POST /api/workbench/jobs/:id/retry
  // 产品操作: "重试失败的渲染任务"
  // ============================================
  app.post('/api/workbench/jobs/:id/retry', async (req, reply) => {
    const { id } = req.params as { id: string }
    const tid = traceId()

    const existing = mockJobs.get(id)
    if (!existing) {
      return reply.status(404).send({ traceId: tid, error: '渲染任务不存在' })
    }

    const updated = stateMachine.transition(existing, 'DISPATCHED')
    mockJobs.set(id, updated)

    // 重新执行（通过真实 Task Adapter 再次提交）
    const retryResult = await realRenderer.render({ traceId: tid, blueprint: existing.blueprint })
    const reDone = stateMachine.transition(updated, retryResult.meta?.taskIds?.length ? 'DONE' : 'FAILED')
    reDone.result = retryResult
    mockJobs.set(id, reDone)
    mockJobs.set(reDone.traceId, reDone)

    req.log.info(`[${tid}] 重试任务 ${id}: ${retryResult.meta?.taskCount || 0} real tasks re-queued`)

    return {
      traceId: tid,
      success: true,
      message: `任务 ${id} 已重新执行`,
      state: reDone.state,
      result: retryResult,
    }
  })

  // ============================================
  // GET /api/workbench/trace/:id
  // 产品操作: "查看全链路日志"
  // ============================================
  app.get('/api/workbench/trace/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const tid = traceId()

    req.log.info(`[${tid}] trace query: ${id}`)

    // 1. find job by traceId
    const job = Array.from(mockJobs.values()).find(j => j.traceId === id)
    if (!job) {
      return reply.status(404).send({ traceId: tid, error: 'trace 未找到' })
    }

    // 2. build DAG from frozen blueprint
    const timeline = dagBuilder.build(id, job.blueprint.data)

    // 3. linearized execution view
    const linear = replayEngine.linearize(timeline)

    // 4. causal path
    const lastNode = linear[linear.length - 1]
    const path = lastNode ? replayEngine.tracePath(lastNode.id, timeline) : []

    return {
      traceId: id,
      timeline,
      linear,
      path,
    }
  })

  // ============================================
  // GET /api/workbench/observatory/:traceId
  // 产品操作: "查看 DAG 执行天文台（可视化图谱）"
  // ============================================
  app.get('/api/workbench/observatory/:traceId', { preHandler: requireMemberTierByPolicy('director.observatory') }, async (req, reply) => {
    const { traceId: traceIdParam } = req.params as { traceId: string }
    const tid = traceId()

    req.log.info(`[${tid}] observatory query: ${traceIdParam}`)

    const job = Array.from(mockJobs.values()).find(j => j.traceId === traceIdParam)
    if (!job) {
      return reply.status(404).send({ traceId: tid, error: 'trace 未找到' })
    }

    const timeline = dagBuilder.build(traceIdParam, job.blueprint.data)
    const observatory = obsMapper.build(timeline)

    return { traceId: traceIdParam, observatory }
  })

  // ═══════════════════════════════════════════
  // 🗡️ Phase 4 — Execution Control Layer
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/retry-node
  // 产品操作: "选中节点 → 局部重跑"
  // OS 链路: NodeSelector → SubtreeExtractor → ReExecutionEngine
  // ─────────────────────────────────────────────
  app.post('/api/workbench/retry-node', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam, nodeId } = req.body as { traceId: string; nodeId: string }

    req.log.info(`[${tid}] retry-node: ${traceIdParam}/${nodeId}`)

    const { handleRetryNode } = await import('../control-layer/control-api-handler.js')
    const result = await handleRetryNode({ traceId: traceIdParam, nodeId }, mockJobs)

    return {
      traceId: tid,
      payload: result,
    }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/patch-node
  // 产品操作: "选中节点 → 运行时改值"
  // OS 链路: NodeSelector → DAGPatchEngine → Blueprint update
  // ─────────────────────────────────────────────
  app.post('/api/workbench/patch-node', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam, nodeId, patch } = req.body as {
      traceId: string
      nodeId: string
      patch: Record<string, unknown>
    }

    req.log.info(`[${tid}] patch-node: ${traceIdParam}/${nodeId}`)

    const { handlePatchNode } = await import('../control-layer/control-api-handler.js')
    const result = await handlePatchNode({ traceId: traceIdParam, nodeId, patch }, mockJobs)

    return {
      traceId: tid,
      payload: result,
    }
  })

  // ═══════════════════════════════════════════
  // 🧬 Phase 5 — Causal Consistency Engine
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/causal-check
  // 产品操作: "检查修改的因果影响范围（不改动）"
  // OS 链路: CausalGraphIndex → InvalidationEngine → RecomputePlanner
  // ─────────────────────────────────────────────
  app.post('/api/workbench/causal-check', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam, nodeId } = req.body as { traceId: string; nodeId: string }

    req.log.info(`[${tid}] causal-check: ${traceIdParam}/${nodeId}`)

    const { handleCausalCheck } = await import('../causal-engine/causal-api-handler.js')
    const result = await handleCausalCheck({ traceId: traceIdParam, nodeId }, mockJobs)

    return { traceId: tid, payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/causal-apply
  // 产品操作: "检查因果影响 + 自动修复"
  // OS 链路: CausalConsistencyEngine → CausalRepairEngine
  // ─────────────────────────────────────────────
  app.post('/api/workbench/causal-apply', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam, nodeId } = req.body as { traceId: string; nodeId: string }

    req.log.info(`[${tid}] causal-apply: ${traceIdParam}/${nodeId}`)

    const { handleCausalApply } = await import('../causal-engine/causal-api-handler.js')
    const result = await handleCausalApply({ traceId: traceIdParam, nodeId }, mockJobs)

    return { traceId: tid, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🧠 Phase 6 — Execution Memory Layer
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/memory-record
  // 产品操作: "记录当前版本快照"
  // OS 链路: ExecutionMemoryLayer.recordVersion
  // ─────────────────────────────────────────────
  app.post('/api/workbench/memory-record', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam, reason, parentVersionId, changedNodes, invalidatedNodes } =
      req.body as {
        traceId: string
        reason: string
        parentVersionId?: string
        changedNodes?: string[]
        invalidatedNodes?: string[]
      }

    req.log.info(`[${tid}] memory-record: ${traceIdParam} — ${reason}`)

    const { handleMemoryRecord } = await import('../execution-memory/memory-api-handler.js')
    const result = await handleMemoryRecord(
      { traceId: traceIdParam, reason, parentVersionId, changedNodes, invalidatedNodes },
      mockJobs,
    )

    return { traceId: tid, payload: result }
  })

  // ─────────────────────────────────────────────
  // GET /api/workbench/memory-history/:traceId
  // 产品操作: "查看执行历史版本链"
  // OS 链路: ExecutionReplayEngine.replay → StoryGenerator
  // ─────────────────────────────────────────────
  app.get('/api/workbench/memory-history/:traceId', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam } = req.params as { traceId: string }

    req.log.info(`[${tid}] memory-history: ${traceIdParam}`)

    const { handleMemoryHistory } = await import('../execution-memory/memory-api-handler.js')
    const result = await handleMemoryHistory({ traceId: traceIdParam })

    return { traceId: tid, payload: result }
  })

  // ─────────────────────────────────────────────
  // GET /api/workbench/memory-stats
  // 产品操作: "查看执行记忆全局统计"
  // OS 链路: ExecutionMemoryLayer.getStats + getLineage
  // ─────────────────────────────────────────────
  app.get('/api/workbench/memory-stats', async (req, reply) => {
    const tid = traceId()

    const { handleMemoryStats } = await import('../execution-memory/memory-api-handler.js')
    const result = await handleMemoryStats()

    return { traceId: tid, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🧠 Phase 7 — Execution Intelligence Layer
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/intel-optimize
  // 产品操作: "让系统自动优化执行方案"
  // OS 链路: IntelligenceLoop.run
  // ─────────────────────────────────────────────
  app.post('/api/workbench/intel-optimize', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam, mode } = req.body as {
      traceId: string
      mode?: string
    }

    req.log.info(`[${tid}] intel-optimize: ${traceIdParam} mode=${mode || 'default'}`)

    const { intelligenceAPI } = await import('../execution-intelligence/intelligence-api-handler.js')
    const result = await intelligenceAPI.handleOptimize(
      { traceId: traceIdParam, mode: mode as any },
      mockJobs,
    )

    return { traceId: tid, payload: result }
  })

  // ─────────────────────────────────────────────
  // GET /api/workbench/cost-estimate/:traceId
  // 产品操作: "查看执行成本预估"
  // OS 链路: CostModel.estimateBlueprint
  // ─────────────────────────────────────────────
  app.get('/api/workbench/cost-estimate/:traceId', async (req, reply) => {
    const tid = traceId()
    const { traceId: traceIdParam } = req.params as { traceId: string }

    req.log.info(`[${tid}] cost-estimate: ${traceIdParam}`)

    const { intelligenceAPI } = await import('../execution-intelligence/intelligence-api-handler.js')
    const result = await intelligenceAPI.handleCostEstimate(
      { traceId: traceIdParam },
      mockJobs,
    )

    return { traceId: tid, payload: result }
  })

  // ════════════════════════════════════════════
  // 🎬 Phase 8 — Autonomous Director Layer
  // ════════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/auto-direct
  // 产品操作: "给定目标，系统自动生成完整执行方案"
  // OS 链路: AutonomousDirector.run
  // ─────────────────────────────────────────────
  app.post('/api/workbench/auto-direct', async (req, reply) => {
    const tid = traceId()
    const { goal, style, duration, mood } = req.body as {
      goal: string
      style?: string
      duration?: string
      mood?: string
    }

    req.log.info(`[${tid}] auto-direct: "${goal?.slice(0, 30)}..."`)

    const { handleAutoDirect } = await import('../autonomous-director/auto-direct-api-handler.js')
    const result = await handleAutoDirect({ goal, style, duration, mood })

    return { traceId: tid, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🎥 Cinematic Compiler — Prompt Engineering
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/compile-shot
  // 产品操作: "将自然语言描述编译为摄影指令"
  // OS 链路: CinematicCompiler.compile
  // ─────────────────────────────────────────────
  app.post('/api/workbench/compile-shot', async (req, reply) => {
    const tid = traceId()
    const { text, shots } = req.body as { text?: string; shots?: string[] }

    req.log.info(`[${tid}] compile-shot: "${text?.slice(0, 40) ?? shots?.length + ' shots'}..."`)

    const { handleCompile, handleBatchCompile } = await import(
      '../cinematic-compiler/cinematic-api-handler.js'
    )

    if (shots) {
      return { traceId: tid, payload: handleBatchCompile(shots) }
    }
    return { traceId: tid, payload: handleCompile(text || '') }
  })

  // ═══════════════════════════════════════════
  // 🎬 Temporal Consistency Engine
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/temporal-analyze
  // 产品操作: "分析镜头间的连续性"
  // OS 链路: TemporalConsistencyEngine.run
  // ─────────────────────────────────────────────
  app.post('/api/workbench/temporal-analyze', async (req, reply) => {
    const tid = traceId()
    const { shotTexts } = req.body as { shotTexts: string[] }

    req.log.info(`[${tid}] temporal-analyze: ${shotTexts?.length || 0} shots`)

    const { handleTemporalAnalyze } = await import(
      '../temporal-engine/temporal-api-handler.js'
    )
    const result = handleTemporalAnalyze({ shotTexts })

    const causalTraceId = (result as any).traceId || tid

    return { traceId: causalTraceId, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🎭 Character Persistence System
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/persistence-analyze
  // 产品操作: "分析并修复跨镜头的角色一致性"
  // OS 链路: CharacterPersistenceEngine.run
  // ─────────────────────────────────────────────
  app.post('/api/workbench/persistence-analyze', async (req, reply) => {
    const tid = traceId()
    const { shotTexts, character } = req.body as {
      shotTexts: string[]
      character?: any
    }

    req.log.info(`[${tid}] persistence-analyze: ${shotTexts?.length || 0} shots`)

    const { handlePersistenceAnalyze } = await import(
      '../character-persistence/character-api-handler.js'
    )
    const result = handlePersistenceAnalyze({ shotTexts, character })

    return { traceId: tid, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🎬 Cinematic Grammar System
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/grammar-analyze
  // 产品操作: "分析镜头序列的语法结构"
  // OS 链路: CinematicGrammarSystem.run
  // ─────────────────────────────────────────────
  app.post('/api/workbench/grammar-analyze', async (req, reply) => {
    const tid = traceId()
    const { shotTexts, preset } = req.body as {
      shotTexts: string[]
      preset?: string
    }

    req.log.info(`[${tid}] grammar-analyze: ${shotTexts?.length || 0} shots`)

    const { handleGrammarAnalyze } = await import(
      '../cinematic-grammar/grammar-api-handler.js'
    )
    const result = handleGrammarAnalyze({ shotTexts, preset })

    // 传递内部 traceId 给因果图系统
    const causalTraceId = (result as any).traceId || tid

    return { traceId: causalTraceId, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🎥 Live Replay Stream (SSE)
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // GET /api/workbench/replay/stream/:traceId
  // SSE 流 — 导演执行过程实时回放
  // ─────────────────────────────────────────────
  app.get('/api/workbench/replay/stream/:traceId', async (req, reply) => {
    const { traceId } = req.params as { traceId: string }

    // 设置 SSE 头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // 注册客户端
    replayEmitter.registerSSE(traceId, reply.raw)

    // 立即发送当前状态
    const status = traceCollector.getStatus(traceId)
    if (status) {
      reply.raw.write(
        `event: status\ndata: ${JSON.stringify(status)}\n\n`,
      )

      // 如果有缓存的 events，立即回放
      const events = traceCollector.getEvents(traceId)
      for (const event of events) {
        reply.raw.write(
          `event: trace\ndata: ${JSON.stringify({ seq: event.seq, layer: event.layer, type: event.type, payload: event.payload })}\n\n`,
        )
      }
    }

    // 保持心跳
    const keepAlive = setInterval(() => {
      reply.raw.write(': keepalive\n\n')
    }, 15000)

    req.raw.on('close', () => {
      clearInterval(keepAlive)
    })

    // 不返回 response body（SSE 模式）
    return reply.hijack()
  })

  // ═══════════════════════════════════════════
  // 🏃 Cinematic Motion System
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/motion-plan
  // 产品操作: "生成镜头运动规划"
  // OS 链路: CinematicMotionSystem.generateMotionPlan
  // ─────────────────────────────────────────────
  app.post('/api/workbench/motion-plan', async (req, reply) => {
    const tid = traceId()
    const { grammarTypes, intensities, tensions, shotTexts } = req.body as {
      grammarTypes: string[]
      intensities: number[]
      tensions: number[]
      shotTexts?: string[]
    }

    req.log.info(`[${tid}] motion-plan: ${grammarTypes?.length || 0} shots`)

    const { handleGenerateMotionPlan } = await import(
      '../cinematic-motion-planner/motion-api-handler.js'
    )
    const result = handleGenerateMotionPlan({ grammarTypes, intensities, tensions, shotTexts })

    return { traceId: tid, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🧬 Causal Graph IR System
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/causal/build
  // 产品操作: "从 trace 构建因果图"
  // OS 链路: CausalGraphBuilder.buildFromTrace
  // ─────────────────────────────────────────────
  app.post('/api/workbench/causal/build', async (req, reply) => {
    const { traceId } = req.body as { traceId: string }
    req.log.info(`[causal] build graph from trace: ${traceId}`)
    const result = handleBuildGraph(traceId)
    return { traceId, payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/causal/edit
  // 产品操作: "编辑因果图中的一个节点（自动传播）"
  // OS 链路: CausalPropagationEngine.propagateChange + ShotRecompiler
  // ─────────────────────────────────────────────
  app.post('/api/workbench/causal/edit', async (req, reply) => {
    const { traceId, nodeId, newState } = req.body as {
      traceId: string
      nodeId: string
      newState: Record<string, any>
    }
    req.log.info(`[causal] edit node: ${nodeId}`)
    const result = handleEditNode({ traceId, nodeId, newState })
    return { traceId, payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/causal/shot-chain
  // 产品操作: "获取指定镜头的因果链"
  // OS 链路: CausalGraphBuilder.getShotChain
  // ─────────────────────────────────────────────
  app.post('/api/workbench/causal/shot-chain', async (req, reply) => {
    const { traceId, shotIndex } = req.body as { traceId: string; shotIndex: number }
    const result = handleGetShotChain({ traceId, shotIndex })
    return { traceId, payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/causal/topology
  // 产品操作: "获取因果图拓扑排序"
  // OS 链路: CausalGraphBuilder.getTopologicalNodes
  // ─────────────────────────────────────────────
  app.post('/api/workbench/causal/topology', async (req, reply) => {
    const { traceId } = req.body as { traceId: string }
    const result = handleGetTopology({ traceId })
    return { traceId, payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/causal/clear
  // 产品操作: "清空因果图缓存"
  // OS 链路: CausalGraphBuilder clear
  // ─────────────────────────────────────────────
  app.post('/api/workbench/causal/clear', async (req, reply) => {
    const { traceId } = req.body as { traceId?: string }
    const result = handleClearCache(traceId)
    return { payload: result }
  })

  // ═══════════════════════════════════════════
  // 🏛️ Narrative Constraint Layer (STAGE 4)
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/narrative/validate
  // 产品操作: "验证当前因果图的叙事一致性"
  // OS 链路: NarrativeConstraintEngine.validateArc
  // ─────────────────────────────────────────────
  app.post('/api/workbench/narrative/validate', async (req, reply) => {
    const { traceId, arcType } = req.body as { traceId: string; arcType?: string }
    req.log.info(`[narrative] validate: arc=${arcType || 'default'}`)
    const result = handleValidateNarrative({ traceId, arcType })
    return { traceId, payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/narrative/gate
  // 产品操作: "Dual-Pass Gate — 编辑 + 叙事验证"
  // OS 链路: NarrativeConstraintEngine.narrativeGate
  // ─────────────────────────────────────────────
  app.post('/api/workbench/narrative/gate', async (req, reply) => {
    const { traceId, nodeId, newState, arcType, autoRepair } = req.body as {
      traceId: string
      nodeId: string
      newState: Record<string, any>
      arcType?: string
      autoRepair?: boolean
    }
    req.log.info(`[narrative] gate: node=${nodeId}, autoRepair=${autoRepair ?? true}`)
    const result = handleDualPassGate({ traceId, nodeId, newState, arcType, autoRepair })
    return { traceId, payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/narrative/summary
  // 产品操作: "获取叙事约束摘要"
  // OS 链路: NarrativeConstraintEngine.getNarrativeSummary
  // ─────────────────────────────────────────────
  app.post('/api/workbench/narrative/summary', async (req, reply) => {
    const { traceId, arcType } = req.body as { traceId: string; arcType?: string }
    const result = handleNarrativeSummary({ traceId, arcType })
    return { traceId, payload: result }
  })

  // ═══════════════════════════════════════════
  // 🎬 Director IR Unified Kernel (STAGE 5)
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/director-ir/create
  // 产品操作: "创建新的导演 IR"
  // OS 链路: DirectorIR.createEmptyIR
  // ─────────────────────────────────────────────
  app.post('/api/workbench/director-ir/create', async (req, reply) => {
    const { title } = req.body as { title?: string }
    const result = handleCreateIR({ title })
    return { payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/director-ir/compile
  // 产品操作: "变异 IR 并重新编译（三 Pass 全量）"
  // OS 链路: DirectorIR.mutateAndCompile
  // ─────────────────────────────────────────────
  app.post('/api/workbench/director-ir/compile', async (req, reply) => {
    const { irId, mutations, options } = req.body as {
      irId: string
      mutations: any[]
      options?: any
    }
    req.log.info(`[dir-ir] compile: irId=${irId}, mutations=${mutations?.length || 0}`)
    const result = handleCompile({ irId, mutations, options })
    return { payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/director-ir/get
  // 产品操作: "获取 IR 快照"
  // OS 链路: DirectorIR.getIRSnapshot
  // ─────────────────────────────────────────────
  app.post('/api/workbench/director-ir/get', async (req, reply) => {
    const { irId } = req.body as { irId: string }
    const result = handleGetIR({ irId })
    return { payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/director-ir/migrate
  // 产品操作: "从遗留系统迁移到 IR"
  // OS 链路: DirectorIR.migrateFromLegacy
  // ─────────────────────────────────────────────
  app.post('/api/workbench/director-ir/migrate', async (req, reply) => {
    const { traceId, causalGraph } = req.body as {
      traceId: string
      causalGraph?: any
    }
    const result = handleMigrateFromLegacy({ traceId, causalGraph })
    return { payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/director-ir/clear
  // 产品操作: "清空 IR 缓存"
  // OS 链路: DirectorIR.clear
  // ─────────────────────────────────────────────
  app.post('/api/workbench/director-ir/clear', async (req, reply) => {
    const { irId } = req.body as { irId?: string }
    const result = handleClearIR(irId)
    return { payload: result }
  })

  // ═══════════════════════════════════════════
  // 📜 TIR — Textual IR Language (Frontend Compiler)
  // ═══════════════════════════════════════════

  // ─────────────────────────────────────────────
  // POST /api/workbench/tir/parse
  // 产品操作: "解析 TIR 源码 → DirectorIRGraph"
  // OS 链路: TIRParser.parse
  // ─────────────────────────────────────────────
  app.post('/api/workbench/tir/parse', async (req, reply) => {
    const { source } = req.body as { source: string }
    req.log.info(`[tir] parse: ${source.length} chars`)
    const result = handleParseTIR({ source })
    return { payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/tir/serialize
  // 产品操作: "DirectorIRGraph → TIR 源码"
  // OS 链路: TIRSerializer.serialize
  // ─────────────────────────────────────────────
  app.post('/api/workbench/tir/serialize', async (req, reply) => {
    const { source } = req.body as { source: string }
    const result = handleSerializeTIR({ source })
    return { payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/tir/validate
  // 产品操作: "验证 TIR 源码语法"
  // OS 链路: TIRParser.parse + diagnostics
  // ─────────────────────────────────────────────
  app.post('/api/workbench/tir/validate', async (req, reply) => {
    const { source } = req.body as { source: string }
    const result = handleValidateTIR({ source })
    return { payload: result }
  })

  // ─────────────────────────────────────────────
  // POST /api/workbench/tir/freeze-status
  // 产品操作: "检查 TIR 语义冻结状态"
  // OS 链路: TIR Freeze Harness
  // ─────────────────────────────────────────────
  app.post('/api/workbench/tir/freeze-status', async (req, reply) => {
    const result = handleTIRFreezeStatus()
    return { payload: result }
  })
}