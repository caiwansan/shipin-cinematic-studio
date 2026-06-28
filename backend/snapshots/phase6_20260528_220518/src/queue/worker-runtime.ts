/**
 * queue/worker-runtime.ts — 统一 Worker Runtime
 *
 * 替换旧的 mock-worker.ts 轮询架构
 * 使用真正的 BullMQ Worker 消费任务
 *
 * v2: 真实 Provider 调用（去掉 TODO mock 占位）
 */

import { createWorkerPool, type TaskType, type TaskPayload, closeAllWorkers } from './queue-manager.js'
import { withRuntimeContext, restoreContextFromSnapshot, getRuntimeContext, createContext } from '../services/runtime-context.js'
import { runtimeObserver } from '../services/runtime-observer.service.js'
import { assertRuntimeIntegrity } from '../runtime/assert-runtime-integrity.js'
import { modelAdapterRegistry } from '../model-adapters/index.js'
import type { RuntimePayload } from '../runtime/runtime-payload.js'
import { rfvl } from '../runtime/rfvl-injector.js'

// ─── Provider Router ────────────────────────────────

async function callProvider(
  taskType: string,
  userId: string,
  projectId: string,
  payload: TaskPayload
): Promise<any> {
  // Phase 1-A: 禁止匿名 runtime
  if (!userId || userId === 'anonymous') {
    throw new Error(`Runtime 拒绝: 用户未登录 (userId=${userId}), taskType=${taskType}. AI 生成需要登录后使用自己的 API Key。`)
  }

  // Phase 1-D: 优先使用 payload.runtime（显式传递），不依赖 ALS secrets
  const runtime: RuntimePayload | undefined = payload.runtime

  // Phase 1-D: 如果有显式 runtime，走 modelAdapterRegistry.execute()
  if (runtime) {
    assertRuntimeIntegrity(runtime)

    // RFVL: MSAL 决策 trace
    const proof = rfvl.startTrace(payload.traceId)
    proof.sealModelSelection({
      model: runtime.model,
      provider: runtime.provider,
      decisionSource: 'MSAL',
      hasUserConfig: true,
    })

    // Phase 5: Governance Gate — NON-BLOCKING, 包 try/catch 防止任何阻断
    let govCost = 0
    try {
      const { governanceGate } = await import('../governance/governance-gate.js')
      const govResult = governanceGate(runtime, { taskType })
      govCost = govResult.cost
    } catch (govErr: any) {
      console.warn(`[Worker] ⚠️ governance gate 异常（不阻断）: ${govErr.message}`)
    }

    console.log(`[Worker] 🎯 使用显式 RuntimePayload: provider=${runtime.provider}, model=${runtime.model}, userId=${runtime.userId?.substring(0, 8)}`)

    try {
      // Phase 6, Rule 1: 事件溯源 — adapter_execute
      try {
        const { appendExecutionEvent } = await import('../kernel/event-sourcing/execution-event-store.js')
        appendExecutionEvent({
          taskId: payload.traceId || `task-${Date.now()}`,
          type: 'adapter_execute',
          runtime: { userId: runtime.userId, provider: runtime.provider, model: runtime.model },
          input: { taskType, model: runtime.model },
        })
      } catch (_) {}

      const result = await modelAdapterRegistry.execute(runtime, runtime.model, {
        model: runtime.model,
        prompt: payload.input?.prompt || payload.input?.text || '',
        imageUrl: payload.input?.imageUrl || payload.input?.referenceImage || payload.input?.firstFrameUrl,
        duration: payload.input?.duration || 5,
        ratio: payload.input?.ratio || payload.input?.aspectRatio || '16:9',
        negativePrompt: payload.input?.negativePrompt || payload.input?.negative_prompt,
        size: payload.input?.size,
        n: payload.input?.n || 1,
        apiKey: runtime.apiKey,
        baseUrl: runtime.baseURL,
        ...payload.input,
      })

      // RFVL: Adapter 解析 + Provider 完成 trace
      const adapterList = modelAdapterRegistry.listAdapters()
      const matchedAdapter = adapterList.find(a => runtime.model.startsWith(a.modelPrefix))
      proof.sealAdapter({
        adapterName: matchedAdapter?.name || 'unknown',
        matchRule: matchedAdapter ? `prefix:${matchedAdapter.modelPrefix}` : 'no-match',
        modelName: runtime.model,
      })

      // Phase 6, Rule 1: 事件溯源 — adapter_complete
      try {
        const { appendExecutionEvent } = await import('../kernel/event-sourcing/execution-event-store.js')
        appendExecutionEvent({
          taskId: payload.traceId || `task-${Date.now()}`,
          type: 'adapter_complete',
          runtime: { userId: runtime.userId, provider: runtime.provider, model: runtime.model },
          output: { success: true },
        })
      } catch (_) {}

      // Phase 5: 审计日志（fire-and-forget，不阻阻断）
      try {
        const { auditExecution } = await import('../governance/audit/execution-audit.js')
        auditExecution(runtime, { taskType, traceId: payload.traceId }, result, govCost)
      } catch (_) {}

      console.log(`[Worker] ✅ modelAdapterRegistry 执行成功: model=${runtime.model}`)

      // RFVL: Provider 调用完成
      proof.sealProvider({
        status: 200,
        durationMs: Date.now() - proof['timestamp'], // approximate
      })
      rfvl.completeTrace(payload.traceId || proof.getTraceId())
      return result
    } catch (err: any) {
      // Phase 6, Rule 1: 事件溯源 — adapter_failed
      try {
        const { appendExecutionEvent } = await import('../kernel/event-sourcing/execution-event-store.js')
        appendExecutionEvent({
          taskId: payload.traceId || `task-${Date.now()}`,
          type: 'adapter_failed',
          runtime: { userId: runtime.userId, provider: runtime.provider, model: runtime.model },
          error: err.message,
        })
      } catch (_) {}

      console.error(`[Worker] ❌ modelAdapterRegistry 执行失败: ${err.message}`)

      // RFVL: Provider 失败 trace
      try {
        proof.sealProvider({ status: 500, durationMs: 0, error: err.message })
        rfvl.completeTrace(payload.traceId || proof.getTraceId())
      } catch (_) {}
      throw err  // 零回退零兜底
    }
  }

  // ⭐ SEEL: 没有 RuntimePayload 即违规，禁止 fallback/mock/retry
  throw new Error(`SEEL 违规: 未找到 RuntimePayload (taskType=${taskType}, userId=${userId}).
  所有 AI 生成任务必须通过 /api/tasks/ai-generate 传入 runtime payload。
  如果这是外部直接调用的路由，请先升级到队列路径。`)
}

// ======== Cancellation Check ========

/**
 * 检查任务是否被取消
 * 在 provider handler 调用前/后检查
 */
async function checkTaskCancelled(taskId?: string): Promise<boolean> {
  if (!taskId) return false
  try {
    const { prisma } = await import('../utils/index.js')
    const task = await prisma.videoTask.findUnique({
      where: { id: taskId },
      select: { status: true },
    })
    return task?.status === ('cancelled' as any)
  } catch {
    return false
  }
}

// ======== Task Processors ========

async function processImage(payload: TaskPayload): Promise<any> {
  // P1-1: 检查是否已取消
  if (await checkTaskCancelled(payload.taskId)) {
    console.log(`[Image Worker] Task ${payload.taskId?.substring(0, 8)} was cancelled, skipping`)
    return { cancelled: true }
  }

  console.log(`[Image Worker] Processing: project=${payload.projectId}, source=${payload.source || payload.input?.source || 'unknown'}, traceId=${payload.traceId}`)
  const result = await callProvider('image', payload.userId, payload.projectId, payload)

  // P1-1: 执行完再检查一次（防止执行期间被取消，不持久化结果）
  if (payload.taskId && await checkTaskCancelled(payload.taskId)) {
    console.log(`[Image Worker] Task ${payload.taskId.substring(0, 8)} was cancelled during execution, discarding result`)
    return { cancelled: true }
  }

  const imageUrl = result?.url || result?.imageUrl || ''
  if (imageUrl) {
    await persistImageResult(payload, imageUrl)
  }
  return { ...result, url: imageUrl }
}

/** 持久化图片生成结果到对应表 */
async function persistImageResult(payload: TaskPayload, imageUrl: string): Promise<void> {
  const { prisma } = await import('../utils/index.js')
  const source = payload.source || payload.input?.source || ''
  const projectId = payload.projectId
  try {
    if (source === 'character' || source === 'face' || source === 'character_execution') {
      const name = payload.input?.characterName || payload.input?.name || 'default'
      // 查已有角色图数量，用连续索引作为 sortOrder
      const existingCount = await prisma.characterImage.count({ where: { projectId } })
      await prisma.characterImage.create({
        data: { projectId, characterName: name, imageUrl, sortOrder: existingCount },
      })
    } else if (source === 'makeup') {
      const name = payload.input?.characterName || payload.input?.name || 'default';
      // 定妆图存到 characterImage 表（用 _makeup 后缀区分角色图）
      const makeupKey = name + '_makeup';
      const existingMakeupCount = await prisma.characterImage.count({ where: { projectId, characterName: { not: { endsWith: '_makeup' } } } })
      await prisma.characterImage.create({
        data: { projectId, characterName: makeupKey, imageUrl, sortOrder: existingMakeupCount },
      });
    } else if (source === 'scene' || source === 'scene_execution') {
      const name = payload.input?.sceneName || 'default'
      await prisma.sceneImage.deleteMany({
        where: { projectId, sceneName: name },
      })
      await prisma.sceneImage.create({
        data: { projectId, sceneName: name, imageUrl, sortOrder: Date.now() % 1000 },
      })
    } else if (source === 'storyboard') {
      const segmentId = String(payload.input?.segmentId || 'default')
      await prisma.storyboardImage.deleteMany({
        where: { projectId, segmentId },
      })
      await prisma.storyboardImage.create({
        data: { projectId, segmentId, imageUrl, sortOrder: Date.now() % 1000 },
      })
    }
    console.log(`[Image Worker] Persisted ${source} result: ${projectId}/${imageUrl.substring(0, 40)}...`)
  } catch (e: any) {
    console.warn(`[Image Worker] Persist warning (${source}): ${e.message}`)
  }
}

async function processVideo(payload: TaskPayload): Promise<any> {
  if (await checkTaskCancelled(payload.taskId)) return { cancelled: true }

  console.log(`[Video Worker] Processing: project=${payload.projectId}, traceId=${payload.traceId}`)
  const result = await callProvider('video', payload.userId, payload.projectId, payload)

  if (payload.taskId && await checkTaskCancelled(payload.taskId)) {
    console.log(`[Video Worker] Task ${payload.taskId.substring(0, 8)} cancelled during execution`)
    return { cancelled: true }
  }

  // 持久化视频结果到 AiVideoSegment
  const videoUrl = result?.url || ''
  if (videoUrl) {
    try {
      const segmentId = String(payload.input?.segmentIndex || payload.input?.segmentId || '')
      if (segmentId) {
        const { prisma } = await import('../utils/index.js')
        await prisma.aiVideoSegment.updateMany({
          where: { projectId: payload.projectId, segmentId },
          data: { videoUrl },
        })
        console.log(`[Video Worker] Persisted videoUrl to AiVideoSegment: project=${payload.projectId}, segmentId=${segmentId}`)
      }
    } catch (e: any) {
      console.warn(`[Video Worker] Persist video warning: ${e.message}`)
    }
  }

  return result
}

async function processTTS(payload: TaskPayload): Promise<any> {
  if (await checkTaskCancelled(payload.taskId)) return { cancelled: true }

  console.log(`[TTS Worker] Processing: project=${payload.projectId}, source=${payload.source || payload.input?.source || 'unknown'}, traceId=${payload.traceId}`)
  const result = await callProvider('tts', payload.userId, payload.projectId, payload)

  if (payload.taskId && await checkTaskCancelled(payload.taskId)) {
    console.log(`[TTS Worker] Task ${payload.taskId.substring(0, 8)} cancelled during execution`)
    return { cancelled: true }
  }

  const url = result?.url || result?.audioUrl || ''
  const duration = result?.duration || 0
  if (url) {
    try {
      const { prisma, projectService } = await import('../utils/index.js')
      const existing = await projectService.getExecutionResults(payload.projectId)
      const results: Record<string, any> = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? existing as Record<string, any>
        : {}
      const ttsKey = payload.source === 'voice' ? 'voice' : 'tts'
      const idx = payload.input?.idx !== undefined ? String(payload.input.idx) : '0'
      if (!results[ttsKey]) results[ttsKey] = {}
      results[ttsKey][idx] = { url, duration, voiceId: payload.input?.voiceId || '', characterName: payload.input?.characterName || '' }
      await projectService.saveExecutionResults(payload.projectId, results)
      console.log(`[TTS Worker] Persisted TTS result: ${payload.projectId}[${ttsKey}][${idx}]`)

      // 同时写入 TTSRecord 表，持久化语音记录
      const characterName = payload.input?.characterName || ''
      const voiceId = payload.input?.voiceId || ''
      const text = payload.input?.text || ''
      if (characterName && payload.projectId) {
        await prisma.tTSRecord.create({
          data: {
            projectId: payload.projectId,
            characterName,
            voiceId,
            audioUrl: url,
            duration,
            sequenceIndex: payload.input?.idx ?? idx,
            text,
          },
        }).catch((dbErr: any) => console.warn(`[TTS Worker] TTSRecord 写入失败: ${dbErr.message}`))
      }
    } catch (e: any) {
      console.warn(`[TTS Worker] Persist warning: ${e.message}`)
    }
  }
  return result
}

async function processLLM(payload: TaskPayload): Promise<any> {
  if (await checkTaskCancelled(payload.taskId)) return { cancelled: true }

  console.log(`[LLM Worker] Processing: project=${payload.projectId}, traceId=${payload.traceId}`)
  return callProvider('llm', payload.userId, payload.projectId, payload)
}

async function processFrame(payload: TaskPayload): Promise<any> {
  if (await checkTaskCancelled(payload.taskId)) return { cancelled: true }

  console.log(`[Frame Worker] Processing: project=${payload.projectId}, type=${payload.input?.type}, traceId=${payload.traceId}`)
  
  // 1. 先通过 image provider 生成图片
  const imageResult = await callProvider('image', payload.userId, payload.projectId, payload)
  const url = imageResult?.url || imageResult?.imageUrl || ''
  if (!url) throw new Error('Frame image generation returned no URL')

  // 2. 写入 frameImage 表持久化存储（刷新不丢）
  const frameType = payload.input?.type || 'first'  // 'first' 或 'last'
  const segmentId = String(payload.input?.segmentId || 'default')
  try {
    const { prisma } = await import('../utils/index.js')
    // 删除同 segment 同类型的旧图，插入新图
    await prisma.frameImage.deleteMany({
      where: { projectId: payload.projectId, segmentId, frameType },
    })
    await prisma.frameImage.create({
      data: { projectId: payload.projectId, segmentId, frameType, imageUrl: url },
    })
    console.log(`[Frame Worker] Saved to frameImage: ${payload.projectId}/${segmentId}/${frameType}`)
  } catch (e: any) {
    console.warn(`[Frame Worker] DB save warning: ${e.message}\nproject=${payload.projectId} sid=${segmentId} type=${frameType}`)
    // 仍返回结果不阻塞生成流程
  }

  return { url, type: frameType, segmentId }
}

async function processExport(payload: TaskPayload): Promise<any> {
  console.log(`[Export Worker] Processing: project=${payload.projectId}, traceId=${payload.traceId}`)
  const { exportRuntime } = await import('../services/export-runtime.js')
  return { status: 'processing' }
}

// ======== Worker Pool ========

let poolStarted = false

export const workerPool = {
  async start(): Promise<void> {
    if (poolStarted) return

    // Phase 2, Rule 6: Worker 启动前必须先完成 boot
    const { ensureBooted } = await import('../bootstrap/worker-guard.js')
    await ensureBooted()

    poolStarted = true
    console.log('[WorkerPool] Starting unified workers with REAL providers...')
    createWorkerPool({
      image: processImage,
      video: processVideo,
      tts: processTTS,
      llm: processLLM,
      export: processExport,
      frame: processFrame,
    })
    console.log('[WorkerPool] All workers started')
  },

  async stop(): Promise<void> {
    await closeAllWorkers()
    poolStarted = false
    console.log('[WorkerPool] All workers stopped')
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "queue-legacy",
  "mode": "SHADOW"
};

