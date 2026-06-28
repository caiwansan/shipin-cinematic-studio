/**
 * api/director-v2/runtime.ts — Phase 4+5 运行时播放 + Live Bridge API
 *
 * 端点：
 *   POST /api/director/runtime/start       — 初始化并启动播放
 *   POST /api/director/runtime/tick        — 单帧推进
 *   POST /api/director/runtime/state       — 获取当前运行时快照
 *   POST /api/director/runtime/seek        — 跳转到指定场景/镜头
 *   POST /api/director/runtime/mutate      — 运行时状态覆盖（仅 runtime state）
 *   GET  /api/director/runtime/stream/:key — SSE 事件流
 *   POST /api/director/runtime/auto-tick   — 启动定时自动 tick
 *   POST /api/director/runtime/stop        — 停止并销毁 session
 */

import type { FastifyInstance } from 'fastify'
import { compileStory } from '../../director-v2/story/story-compiler.js'
import { compileExecutionPlan } from '../../director-v2/execution/story-scheduler.js'
import { liveBridge, type RuntimeMutation } from '../../director-v2/live/live-bridge.js'
import type { StoryGraph } from '../../director-v2/story/scene-graph.js'
import { sessionManager } from '../../director-v2/session/session-manager.js'
import { runtimePersistence } from '../../director-v2/session/runtime-persistence.js'

// ─── 路由注册 ──────────────────────────────────────────

export default async function (fastify: FastifyInstance) {

  // POST /api/director/runtime/start — 初始化并启动播放
  fastify.post('/api/director/runtime/start', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined

      if (!body || !body.storyGraph) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'input', message: 'storyGraph 字段缺失' },
        })
      }

      const storyGraph = body.storyGraph as StoryGraph
      if (!Array.isArray(storyGraph.scenes) || storyGraph.scenes.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'input', message: 'storyGraph.scenes 必须为非空数组' },
        })
      }

      const bundle = compileStory(storyGraph)
      const executionPlan = compileExecutionPlan(bundle)

      const sessionKey = `runtime_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const state = liveBridge.createSession(sessionKey, bundle, executionPlan)

      // 创建 session 记录
      sessionManager.createSession(storyGraph)
      // 将 session 记录重命名为与 sessionKey 一致
      sessionManager.updateExecutionSnapshot(sessionKey, {
        currentSceneId: state.runtimeState.currentSceneId,
        currentShotIndex: state.runtimeState.currentShotIndex,
        completedScenes: state.runtimeState.completedScenes,
        totalScenes: state.runtimeState.totalScenes,
        intensity: state.runtimeState.intensity,
        playbackTime: state.runtimeState.playbackTime,
        isPlaying: state.isPlaying,
      })

      // 首次持久化
      runtimePersistence.saveRuntimeSnapshot(sessionKey, state, JSON.stringify(bundle))
      const controller = liveBridge.getController(sessionKey)
      if (controller) {
        const memSnapshot = controller.getMemoryKernel()?.snapshot()
        if (memSnapshot) runtimePersistence.saveMemorySnapshot(sessionKey, memSnapshot)
      }
      runtimePersistence.saveIdentitySnapshot(sessionKey, null)

      return reply.send({
        success: true,
        data: {
          sessionKey,
          state,
          bundle: {
            story: bundle.story,
            globalArc: bundle.globalArc,
            executionPlan,
          },
        },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '运行时启动异常',
        },
      })
    }
  })

  // POST /api/director/runtime/tick — 单帧推进
  fastify.post('/api/director/runtime/tick', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      const sessionKey = body?.sessionKey as string | undefined

      if (!sessionKey || !liveBridge.getController(sessionKey)) {
        return reply.status(404).send({
          success: false,
          error: { stage: 'input', message: 'sessionKey 无效或已过期' },
        })
      }

      const controller = liveBridge.getController(sessionKey)!
      const deltaTime = (body?.deltaTime as number) ?? 1.0
      const state = controller.tick(deltaTime)

      // 每 5 tick 持久化一次
      const tickNum = state.runtimeState.playbackTime
      if (Math.floor(tickNum) % 5 === 0) {
        runtimePersistence.saveRuntimeSnapshot(sessionKey, state, '')
        const memSnapshot = controller.getMemoryKernel()?.snapshot()
        if (memSnapshot) runtimePersistence.saveMemorySnapshot(sessionKey, memSnapshot)
      }

      return reply.send({
        success: true,
        data: { state },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '运行时 tick 异常',
        },
      })
    }
  })

  // POST /api/director/runtime/state — 获取运行时快照
  fastify.post('/api/director/runtime/state', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      const sessionKey = body?.sessionKey as string | undefined

      if (!sessionKey || !liveBridge.getController(sessionKey)) {
        return reply.status(404).send({
          success: false,
          error: { stage: 'input', message: 'sessionKey 无效或已过期' },
        })
      }

      const controller = liveBridge.getController(sessionKey)!
      const state = controller.getControllerState()

      return reply.send({
        success: true,
        data: { state },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '运行时状态获取异常',
        },
      })
    }
  })

  // POST /api/director/runtime/seek — 跳转到指定场景的指定镜头
  fastify.post('/api/director/runtime/seek', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      const sessionKey = body?.sessionKey as string | undefined
      const sceneId = body?.sceneId as string | undefined
      const shotIndex = (body?.shotIndex as number) ?? 0

      if (!sessionKey || !liveBridge.getController(sessionKey)) {
        return reply.status(404).send({
          success: false,
          error: { stage: 'input', message: 'sessionKey 无效或已过期' },
        })
      }

      if (!sceneId) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'input', message: 'sceneId 缺失' },
        })
      }

      const controller = liveBridge.getController(sessionKey)!
      const state = controller.seek(sceneId, shotIndex)

      return reply.send({
        success: true,
        data: { state },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '运行时 seek 异常',
        },
      })
    }
  })

  // POST /api/director/runtime/mutate — 运行时状态覆盖
  fastify.post('/api/director/runtime/mutate', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      const sessionKey = body?.sessionKey as string | undefined
      const mutation = body?.mutation as RuntimeMutation | undefined

      if (!sessionKey || !liveBridge.getController(sessionKey)) {
        return reply.status(404).send({
          success: false,
          error: { stage: 'input', message: 'sessionKey 无效或已过期' },
        })
      }

      if (!mutation) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'input', message: 'mutation 缺失' },
        })
      }

      const state = liveBridge.applyMutation(sessionKey, mutation)

      return reply.send({
        success: true,
        data: { state },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '运行时 mutation 异常',
        },
      })
    }
  })

  // GET /api/director/runtime/stream/:sessionKey — SSE 事件流
  fastify.get('/api/director/runtime/stream/:sessionKey', async (request, reply) => {
    const { sessionKey } = request.params as { sessionKey: string }

    if (!liveBridge.getController(sessionKey)) {
      return reply.status(404).send({
        success: false,
        error: { stage: 'input', message: 'sessionKey 无效或已过期' },
      })
    }

    // Fastify SSE 模式
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const unsubscribe = liveBridge.subscribe(sessionKey, (event) => {
      try {
        const data = JSON.stringify(event)
        reply.raw.write(`data: ${data}\n\n`)
      } catch {
        // ignore serialization errors
      }
    })

    // keep-alive
    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n')
      } catch {
        clearInterval(keepAlive)
      }
    }, 10000)

    // cleanup on disconnect
    request.raw.on('close', () => {
      unsubscribe()
      clearInterval(keepAlive)
    })
  })

  // POST /api/director/runtime/auto-tick — 启动定时自动 tick
  fastify.post('/api/director/runtime/auto-tick', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      const sessionKey = body?.sessionKey as string | undefined
      const intervalMs = (body?.intervalMs as number) ?? 500

      if (!sessionKey || !liveBridge.getController(sessionKey)) {
        return reply.status(404).send({
          success: false,
          error: { stage: 'input', message: 'sessionKey 无效或已过期' },
        })
      }

      const started = liveBridge.startAutoTick(sessionKey, intervalMs)

      return reply.send({
        success: true,
        data: { autoTickStarted: started },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '自动 tick 启动异常',
        },
      })
    }
  })

  // POST /api/director/runtime/stop — 停止并销毁 session
  fastify.post('/api/director/runtime/stop', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      const sessionKey = body?.sessionKey as string | undefined

      if (!sessionKey || !liveBridge.getController(sessionKey)) {
        return reply.status(404).send({
          success: false,
          error: { stage: 'input', message: 'sessionKey 无效或已过期' },
        })
      }

      liveBridge.destroySession(sessionKey)

      // 持久化清理
      runtimePersistence.destroySession(sessionKey)
      sessionManager.markCompleted(sessionKey)

      return reply.send({
        success: true,
        data: { destroyed: true },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '停止 session 异常',
        },
      })
    }
  })
}
