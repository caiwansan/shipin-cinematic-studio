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

// ⭐ 视频拼接用
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { writeFileSync } from 'fs'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
const execAsync = promisify(execCb)

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

      // ⭐ 构建参考图列表：分镜图（首帧/中帧/尾帧）优先级最高 → 角色图次之
      const frameRefs: string[] = []
      const firstUrl = payload.input?.firstFrameUrl
      const midUrl = payload.input?.midFrameUrl
      const lastUrl = payload.input?.lastFrameUrl
      if (firstUrl && typeof firstUrl === 'string') frameRefs.push(firstUrl)
      if (midUrl && typeof midUrl === 'string') frameRefs.push(midUrl)
      if (lastUrl && typeof lastUrl === 'string') frameRefs.push(lastUrl)
      const charUrls = payload.input?.characterReferenceUrls
      if (Array.isArray(charUrls)) {
        for (const url of charUrls) {
          if (url && typeof url === 'string' && !frameRefs.includes(url)) {
            frameRefs.push(url)
          }
        }
      }

      // ⭐ 自动匹配：根据 narrative 文本锁定角色图和场景图（按剧情需要）
      try {
        const narrativeText = payload.input?.narrative || payload.input?.text || ''
        if (narrativeText && runtime.projectId) {
          const { PrismaClient } = require('@prisma/client') as any
          const autoPrisma = new PrismaClient()
          
          // 收集项目中所有角色名和场景名
          const [allCharImages, allSceneImages] = await Promise.all([
            autoPrisma.characterImage.findMany({
              where: { projectId: runtime.projectId },
              select: { characterName: true, imageUrl: true },
            }),
            autoPrisma.sceneImage.findMany({
              where: { projectId: runtime.projectId },
              select: { sceneName: true, imageUrl: true },
            }),
          ])
          await autoPrisma.$disconnect()

          // 角色图：如果 narrative 中出现角色名且该角色有图，追加（去重）
          const charNames = [...new Set(allCharImages.map(c => c.characterName).filter(Boolean))]
          const triggerCharUrls: string[] = []
          for (const charName of charNames) {
            if (charName && narrativeText.includes(charName)) {
              const charImg = allCharImages.find(c => c.characterName === charName)
              if (charImg?.imageUrl && !triggerCharUrls.includes(charImg.imageUrl)) {
                triggerCharUrls.push(charImg.imageUrl)
              }
            }
          }
          
          // 场景图：如果 narrative 中出现场景名且该场景有图，追加（去重）
          const sceneNames = [...new Set(allSceneImages.map(s => s.sceneName).filter(Boolean))]
          for (const sceneName of sceneNames) {
            if (sceneName && narrativeText.includes(sceneName)) {
              const sceneImg = allSceneImages.find(s => s.sceneName === sceneName)
              if (sceneImg?.imageUrl && !triggerCharUrls.includes(sceneImg.imageUrl)
                && !frameRefs.includes(sceneImg.imageUrl)) {
                triggerCharUrls.push(sceneImg.imageUrl)
              }
            }
          }
          
          // 追加到 frameRefs（分镜图/手动勾选的角色图在前，自动匹配的在后面）
          for (const url of triggerCharUrls) {
            if (!frameRefs.includes(url)) {
              frameRefs.push(url)
            }
          }
          if (triggerCharUrls.length > 0) {
            console.log(`[Worker] ⭐ 自动匹配 ${triggerCharUrls.length} 张参考图（角色/场景）`)
          }
        }
      } catch (autoErr: any) {
        console.warn('[Worker] ⚠️ 自动匹配参考图失败（不阻断）:', autoErr.message)
      }

      if (frameRefs.length === 0) {
        const fb = payload.input?.imageUrl || payload.input?.referenceImage || ''
        if (fb) frameRefs.push(fb)
      }

      // 注意：...payload.input 展开可能在最后，会覆盖前面的字段。
      // 因此重写 spread 为 explicit props，去掉 referenceImages 的冲突。
      const explicitInput: Record<string, any> = { ...payload.input }
      // 移除 payload.input 中可能冲突的旧字段，避免覆盖新值
      delete explicitInput.referenceImages
      delete explicitInput.imageUrl
      delete explicitInput.referenceImage

      const result = await modelAdapterRegistry.execute(runtime, runtime.model, {
        model: runtime.model,
        prompt: explicitInput.prompt || explicitInput.text || '',
        imageUrl: frameRefs[0] || '',
        duration: explicitInput.duration || 5,
        ratio: explicitInput.ratio || explicitInput.aspectRatio || '9:16',
        negativePrompt: explicitInput.negativePrompt || explicitInput.negative_prompt,
        size: explicitInput.size,
        n: explicitInput.n || 1,
        apiKey: runtime.apiKey,
        baseUrl: runtime.baseURL,
        perCapabilityBaseUrl: runtime.metadata?.baseUrlMap as Record<string, string> | undefined,
        mode: explicitInput.mode,
        referenceImages: frameRefs.length > 0 ? frameRefs : undefined,
        ...explicitInput,
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
/** 下载远程图片到本地 public/uploads 目录 */
async function downloadImageLocal(imageUrl: string): Promise<string> {
  if (!imageUrl || imageUrl.startsWith('/') || !imageUrl.startsWith('http')) return imageUrl
  try {
    const fs = await import('fs/promises')
    const path = await import('path')
    const https = await import('https')
    const http = await import('http')

    const uploadDir = path.resolve(process.cwd(), 'public/uploads')
    await fs.mkdir(uploadDir, { recursive: true })

    const ext = path.extname(imageUrl.split('?')[0]?.split('#')[0] || '') || '.png'
    const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`
    const filepath = path.join(uploadDir, filename)

    const body = await new Promise<Buffer>((resolve, reject) => {
      const client = imageUrl.startsWith('https') ? https : http
      const req = client.get(imageUrl, { timeout: 30000 }, (res) => {
        // 处理重定向
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const client2 = res.headers.location.startsWith('https') ? https : http
          client2.get(res.headers.location, { timeout: 30000 }, (res2) => {
            const chunks: Buffer[] = []
            res2.on('data', (c: Buffer) => chunks.push(c))
            res2.on('end', () => resolve(Buffer.concat(chunks)))
            res2.on('error', reject)
          }).on('error', reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')) })
    })

    await fs.writeFile(filepath, body)
    const localUrl = `/uploads/${filename}`
    console.log(`[Image Worker] ⬇️ 下载成功: ${imageUrl.substring(0, 40)}... → ${localUrl}`)
    return localUrl
  } catch (e: any) {
    console.warn(`[Image Worker] ⚠️ 下载失败 ${imageUrl.substring(0, 40)}...: ${e.message}，使用原URL`)
    return imageUrl
  }
}

/** 持久化图片生成结果到对应表（自动下载到本地） */
async function persistImageResult(payload: TaskPayload, imageUrl: string): Promise<void> {
  const { prisma } = await import('../utils/index.js')
  const source = payload.source || payload.input?.source || ''
  const projectId = payload.projectId

  // ⭐ 下载到本地，替换 URL
  const localUrl = await downloadImageLocal(imageUrl)
  const finalUrl = localUrl

  try {
    if (source === 'character' || source === 'face' || source === 'character_execution') {
      const name = payload.input?.characterName || payload.input?.name || 'default'
      const existing = await prisma.characterImage.findFirst({
        where: { projectId, characterName: name },
        orderBy: { sortOrder: 'desc' },
      })
      if (existing) {
        await prisma.characterImage.update({
          where: { id: existing.id },
          data: { imageUrl: finalUrl, sortOrder: existing.sortOrder },
        })
      } else {
        const existingCount = await prisma.characterImage.count({ where: { projectId } })
        await prisma.characterImage.create({
          data: { projectId, characterName: name, imageUrl: finalUrl, sortOrder: existingCount },
        })
      }
    } else if (source === 'makeup') {
      const name = payload.input?.characterName || payload.input?.name || 'default';
      const makeupKey = name + '_makeup';
      const existing = await prisma.characterImage.findFirst({
        where: { projectId, characterName: makeupKey },
      })
      if (existing) {
        await prisma.characterImage.update({
          where: { id: existing.id },
          data: { imageUrl: finalUrl },
        })
      } else {
        const existingMakeupCount = await prisma.characterImage.count({ where: { projectId, characterName: { not: { endsWith: '_makeup' } } } })
        await prisma.characterImage.create({
          data: { projectId, characterName: makeupKey, imageUrl: finalUrl, sortOrder: existingMakeupCount },
        })
      }
    } else if (source === 'scene' || source === 'scene_execution') {
      const name = payload.input?.sceneName || 'default'
      await prisma.sceneImage.upsert({
        where: {
          projectId_sceneName: { projectId, sceneName: name },
        },
        update: { imageUrl: finalUrl },
        create: { projectId, sceneName: name, imageUrl: finalUrl, sortOrder: Date.now() % 1000 },
      })
    } else if (source === 'storyboard') {
      const segmentId = String(payload.input?.segmentId || 'default')
      await prisma.storyboardImage.upsert({
        where: {
          projectId_segmentId: { projectId, segmentId },
        },
        update: { imageUrl: finalUrl },
        create: { projectId, segmentId, imageUrl: finalUrl, sortOrder: Date.now() % 1000 },
      })
    }
    console.log(`[Image Worker] Persisted ${source} result: ${projectId}/${finalUrl.substring(0, 40)}...`)
  } catch (e: any) {
    console.warn(`[Image Worker] Persist warning (${source}): ${e.message}`)
  }
}

async function processVideo(payload: TaskPayload): Promise<any> {
  // ── P1.8 Data Activation: V3 实验任务 routing ─────────────
  if (payload.input?._p18V3) {
    console.log(`[P18] 🧪 V3 pipeline: task=${payload.taskId}, pair=${payload.input._p18PairId}`)
    const { executeV3Pipeline } = await import('../services/p18/v3-worker-adapter.js')
    return executeV3Pipeline(payload)
  }

  if (await checkTaskCancelled(payload.taskId)) return { cancelled: true }

  console.log(`[Video Worker] Processing: project=${payload.projectId}, traceId=${payload.traceId}`)

  const narrative = payload.input?.narrative || ''
  const dialogue = payload.input?.dialogue || ''
  const effects = payload.input?.effects || ''

  const firstFrameDesc = payload.input?.firstFrameDescription || ''
  const lastFrameDesc = payload.input?.lastFrameDescription || ''

  const duration = payload.input?.duration || 5

  const firstFrameUrl = payload.input?.firstFrameUrl || payload.input?.referenceImage || ''
  const lastFrameUrl = payload.input?.lastFrameUrl || ''

  // ⭐ 读取 AI 优化后的逐秒镜头脚本
  const optimizedShots: any[] = payload.input?.optimizedShots || []

  return generateSingleVideo(payload, undefined, narrative, dialogue, effects, firstFrameUrl, lastFrameUrl, firstFrameDesc, lastFrameDesc, duration, optimizedShots)
}

/**
 * 构建时间连续性约束（Cross-shot Temporal Binding）
 * 防止模型将每个镜头视为独立事件，确保跨镜头状态继承
 */
function buildTemporalContinuitySection(input: any): string {
  // ── 从角色数据推导情绪连续性 ──
  const characters = input?.characters || []
  const charEmotions = characters.map((ch: any) => ch.emotion || '').filter(Boolean)
  
  // ── 从场景数据推导场景连续性 ──
  const scenes = input?.scenes || []
  const sceneTime = scenes.map((sc: any) => sc.timeOfDay || '').filter(Boolean)
  const sceneLighting = scenes.map((sc: any) => sc.lighting || '').filter(Boolean)
  const sceneMood = scenes.map((sc: any) => sc.mood || '').filter(Boolean)
  
  // ── 从叙事文本推导动作连续性 ──
  const narrative = input?.narrative || ''
  const actionKeywords = ['走', '跑', '追', '看', '拿', '放', '站', '坐', '转身', '抬头', '低头', '握', '推', '拉', '打开', '关上', '穿', '脱']
  const detectedActions = actionKeywords.filter(kw => narrative.includes(kw))
  
  // ── 从 storyboard 获取情绪基调 ──
  const storyEmotion = input?.storyboard?.emotion || ''
  const prevEmotion = input?.previousEmotion || ''
  
  // ── 构建连续性声明 ──
  const parts = ['## [时间连续性约束]']
  
  parts.push('⚠️ 本镜头不是独立事件。它继承并延续上一镜头的所有状态，禁止重置。')
  
  if (prevEmotion) {
    parts.push(`- 情绪连续性：上一镜头的情绪【${prevEmotion}】必须延续到本镜头。本镜头基调为【${storyEmotion || prevEmotion}】，情绪变化必须是渐进的，不能跳跃。`)
  } else if (storyEmotion) {
    parts.push(`- 情绪连续性：本镜头情绪基调为【${storyEmotion}】。如果角色在前一镜头有不同情绪，本镜头的情绪变化必须是连续的渐进过程，不能跳变。`)
  }
  
  if (detectedActions.length > 0) {
    parts.push(`- 动作连续性：以下动作继承自上一镜头或延续中：【${detectedActions.join('、')}】。这些动作的起始状态、位置和方向必须与上一镜头保持物理连贯。`)
  }
  
  if (sceneTime.length > 0) {
    parts.push(`- 场景时间连续性：当前时间为【${sceneTime.join('、')}】。禁止场景环境、光照、时间在镜头切换时发生非自然突变。`)
  }
  if (sceneLighting.length > 0) {
    parts.push(`- 光照连续性：当前光照模式为【${sceneLighting.join('、')}】。光线条件必须与本场景设定一致，不能因镜头切换而改变。`)
  }
  if (sceneMood.length > 0) {
    parts.push(`- 氛围连续性：当前氛围为【${sceneMood.join('、')}】。环境氛围必须在本镜头内保持稳定，仅在剧情需要时渐变。`)
  }
  
  if (narrative) {
    // 提取叙事中的时间标记
    const timeMarkers = narrative.match(/[0-9]+秒前|不久|刚刚|已经/g) || []
    if (timeMarkers.length > 0) {
      parts.push(`- 叙事时间连续性：叙事中包含【${timeMarkers.join('、')}】等时间标记，表明本镜头与上一镜头存在时间关联。镜头切换后时间线必须连续。`)
    }
  }
  
  parts.push('- 禁止：角色忽然更换服装、场景忽然变换位置、道具忽然出现或消失、时间忽然跳跃')
  parts.push('⚠️ 时间连续性约束优先级高于剧情描述。如果剧情描述中的连续性信息与连续性约束冲突，以连续性约束为准。')
  
  return parts.join('\n')
}

/**
 * 分类 CTBL 相关的生成失败模式
 */
function classifyCTBLFailure(result: any, promptLen: number, hasCTBL: boolean): string {
  const errMsg = result?.error || result?.message || ''
  
  // Rejection: model explicitly refused
  if (errMsg.includes('reject') || errMsg.includes('refuse') || errMsg.includes('拒绝') || errMsg.includes('sensitive')) return 'model_rejection'
  
  // Truncation: prompt too long
  if (promptLen > 6000 || errMsg.includes('truncat') || errMsg.includes('length') || errMsg.includes('token') || errMsg.includes('limit')) return 'prompt_truncation'
  
  // Timeout: model took too long
  if (errMsg.includes('timeout') || errMsg.includes('超时')) return 'generation_timeout'
  
  // Auth / API error
  if (errMsg.includes('auth') || errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('key')) return 'api_auth_error'
  
  // No URL returned but no explicit error
  if (!result?.url && !errMsg) return 'no_output_url'
  
  // Unknown
  return 'unknown:' + (errMsg.substring(0,40) || 'no_error_message')
}

/** 单段视频生成（旧逻辑） */
async function generateSingleVideo(
  payload: TaskPayload,
  _prismaProxy?: any, // optional override for testing
  narrative?: string,
  dialogue?: string,
  effects?: string,
  firstFrameUrl?: string,
  lastFrameUrl?: string,
  firstFrameDesc?: string,
  lastFrameDesc?: string,
  duration?: number,
  optimizedShots?: any[],
): Promise<any> {
  // Dynamic import prisma — this function can be called from different scopes
  const { prisma } = _prismaProxy || await import('../utils/index.js').then(m => ({ prisma: (m as any).prisma }));

  // If called with full args from processVideo, pass them through
  if (narrative !== undefined) {
    return innerGenerateSingleVideo(payload, prisma, narrative!, dialogue!, effects!, firstFrameUrl!, lastFrameUrl!, firstFrameDesc!, lastFrameDesc!, duration!, optimizedShots || []);
  }

  // If only payload was provided, extract from payload
  return innerGenerateSingleVideo(
    payload, prisma,
    payload.input?.narrative || '',
    payload.input?.dialogue || '',
    payload.input?.effects || '',
    payload.input?.firstFrameUrl || '',
    payload.input?.lastFrameUrl || '',
    payload.input?.firstFrameDescription || '',
    payload.input?.lastFrameDescription || '',
    payload.input?.duration || 5,
    payload.input?.optimizedShots || [],
  );
}

async function innerGenerateSingleVideo(
  payload: TaskPayload,
  prisma: any,
  narrative: string,
  dialogue: string,
  effects: string,
  firstFrameUrl: string,
  lastFrameUrl: string,
  firstFrameDesc: string,
  lastFrameDesc: string,
  duration: number,
  optimizedShots: any[] = [],
): Promise<any> {
  const frameRefs: string[] = []
  if (firstFrameUrl) frameRefs.push('首帧图（视频开头画面）')
  if (lastFrameUrl) frameRefs.push('尾帧图（视频结尾最后一秒画面）')

  const frameDescSection = [
    firstFrameDesc ? `【首帧画面描述】\n${firstFrameDesc}` : '',
    lastFrameDesc ? `【尾帧画面描述】\n${lastFrameDesc}` : '',
  ].filter(Boolean).join('\n\n')

  // ⭐ 运镜脚本：从 optimizedShots 生成逐秒镜头描述
  let shotScriptSection = ''
  if (optimizedShots.length > 0) {
    const shotLines = optimizedShots.map((shot: any) => {
      const sec = shot.second ?? 0
      const camera = shot.camera || ''
      const action = shot.action || ''
      const expression = shot.expression || ''
      const fx = shot.fx || ''
      const parts = [`【第${sec}秒】`]
      if (camera) parts.push(`运镜: ${camera}`)
      if (action) parts.push(`动作: ${action}`)
      if (expression) parts.push(`表情: ${expression}`)
      if (fx) parts.push(`特效: ${fx}`)
      return parts.join(' | ')
    }).join('\n')
    shotScriptSection = `\n## 逐秒镜头脚本（严格按秒执行）\n${shotLines}\n`
  }

  // ⭐ 读取视频风格 & 构建风格指令（优先从 promptOverrides.video 模板读取）
  const videoStyle = payload.input?.videoStyle || ''
  let styleDirective = ''
  if (videoStyle) {
    try {
      const { StyleProfileService } = await import('../services/style-profile.service.js')
      const profile = await StyleProfileService.getByName(videoStyle)
      if (profile?.promptOverrides?.['video']) {
        // 有 video 环节的 promptOverride 模板（如 anime 有完整的视频风格指令）
        const raw = profile.promptOverrides['video']
        styleDirective = '\n' + raw.replace('{{prompt}}', '').trim()
      } else if (profile?.styleTokens) {
        styleDirective = `\n## 锁定视频风格\n当前风格：【${videoStyle}】\n风格特征：${profile.styleTokens}\n所有画面（光影、色彩、线条、材质、构图、渲染质感）都必须严格遵循此风格。如果剧情描述与风格冲突，以风格为首要约束。`
      } else if (profile?.description) {
        styleDirective = `\n## 锁定视频风格\n当前风格：【${videoStyle}】\n风格特征：${profile.description}\n所有画面都必须严格遵循此风格。`
      } else {
        styleDirective = `\n## 锁定视频风格\n当前风格：【${videoStyle}】`
      }
    } catch {
      styleDirective = `\n## 锁定视频风格\n当前风格：【${videoStyle}】`
    }
  }

  const videoPrompt = [
    `视频总时长：${duration} 秒`,
    narrative ? `【剧情描述】\\n${narrative}` : '',
    dialogue ? `【对话】\\n${dialogue}` : '',
    effects ? `【特效音效】\\n${effects}` : '',
    // ⭐ 结构化角色约束
    payload.input?.characters?.length ? `## [角色约束]
${payload.input.characters.map((ch: any) => {
      const attrs = [`角色名：${ch.name || ''}`]
      if (ch.gender) attrs.push(`性别：${ch.gender}`)
      if (ch.age) attrs.push(`年龄：${ch.age}`)
      if (ch.clothing) attrs.push(`服装：${ch.clothing}`)
      if (ch.appearance) attrs.push(`外貌：${ch.appearance}`)
      return attrs.join(' | ')
    }).join('\n')}

⚠️ 角色约束优先级高于剧情描述。如果剧情描述中的角色外观与角色约束冲突，以角色约束为准。` : '',
    // ⭐ 结构化场景约束
    payload.input?.scenes?.length ? `## [场景约束]
${payload.input.scenes.map((sc: any) => {
      const attrs = [`场景名：${sc.name || ''}`]
      if (sc.environment) attrs.push(`环境：${sc.environment}`)
      if (sc.lighting) attrs.push(`光照：${sc.lighting}`)
      if (sc.mood) attrs.push(`氛围：${sc.mood}`)
      if (sc.timeOfDay) attrs.push(`时间：${sc.timeOfDay}`)
      return attrs.join(' | ')
    }).join('\n')}

⚠️ 场景约束优先级高于剧情描述。如果剧情描述中的场景与场景约束冲突，以场景约束为准。` : '',
    // ⭐ 结构化分镜/镜头语言约束
    payload.input?.storyboard ? `## [镜头语言]
景别/拍摄模式：${payload.input.storyboard.shotPattern || '未指定'}
情绪基调：${payload.input.storyboard.emotion || '未指定'}
叙事目的：${payload.input.storyboard.narrativePurpose || ''}
片段时长：${payload.input.storyboard.duration || 8} 秒

⚠️ 镜头语言约束优先级高于剧情描述。如果剧情描述中的运镜/景别与镜头语言冲突，以镜头语言为准。` : '',
    // ⭐ 时间连续性约束（跨镜头状态继承）
    (payload.input?.characters?.length || payload.input?.narrative) ? buildTemporalContinuitySection(payload.input) : '',
    styleDirective,
    shotScriptSection,  // ⭐ 逐秒镜头脚本注入
    frameDescSection ? `\n## 参考图片的画面描述（视频内容必须与这些描述一致）\n${frameDescSection}` : '',
    frameRefs.length > 0 ? `\n## 参考图片使用说明\n以下参考图片已按对应时间节点插入：\n${frameRefs.join('\n')}\n\n请严格按以下规则使用参考图片：\n- 首帧图 = 视频第 0 秒的起始画面，作为视频开头的画面基础\n- 尾帧图 = 视频最后一秒的结束画面，作为视频结尾的画面基础\n- 视频大模型需在这两帧参考图之间自动生成连贯的过渡动画\n- 保持人物、场景、道具在画面中的位置和形状稳定，仅按剧情描述变化\n- 两帧图已准确对齐到对应时间节点\n- ⚠️ 物理规则：角色身体比例不得突变，肢体不得变形或消失，手持物品必须连续存在，场景物体位置保持稳定\n- ⚠️ 禁止：角色忽然变矮/变高、肢体扭曲、手部物品消失、身体嵌入物体、角色穿透物体\n- 附加参考图说明：可能包含角色的三视定妆图（三格拼图：正面/侧面/背面）和正脸裁剪图，用于保持角色外观一致性。请从三视定妆图中自动识别并摘取角色的面部五官、服装剪裁、发型、体型等特征，在视频生成中保持这些特征一致` : '',
  ].filter(Boolean).join('\n\n')

  if (!payload.input) payload.input = {}
  const frameImageUrls: string[] = []
  if (firstFrameUrl) frameImageUrls.push(firstFrameUrl)
  if (lastFrameUrl) frameImageUrls.push(lastFrameUrl)

  // 合并参考图（前端统一用 referenceImages，
  // 兼容旧的 characterReferenceUrls 字段）
  const extraRefs: string[] = payload.input?.referenceImages ||
    payload.input?.characterReferenceUrls || []
  if (extraRefs.length > 0) {
    for (const url of extraRefs) {
      if (url && !frameImageUrls.includes(url)) {
        frameImageUrls.push(url)
      }
    }
  }

  payload.input.prompt = videoPrompt || payload.input.prompt || ''
  payload.input.imageUrl = firstFrameUrl || ''
  payload.input.imageUrl2 = lastFrameUrl || ''
  payload.input.referenceImages = frameImageUrls.length > 0 ? frameImageUrls : undefined
  payload.input.negativePrompt = payload.input?.negativePrompt || ''

  // 将所有参考图 URL 从临时签名 URL 转换为本地可公网访问的 URL
  // （火山 TOS 的签名链接阿里百炼服务器无法访问，需先下载到本地 uploads）
  async function ensureLocalUrl(url: string): Promise<string> {
    if (!url || url.startsWith('/uploads/') || url.startsWith('data:')) {
      return url
    }
    // 已是 aigc.fushtn.com 的公网 URL，阿里可直接访问，无需转存
    // （但 worker-runtime 仍需转存本地用于后续场景）
    if (url.startsWith('https://aigc.fushtn.com/')) {
      return url
    }
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!resp.ok) {
        console.warn(`[Video Worker] ⚠️ 下载参考图失败: ${resp.status} ${url.substring(0, 60)}`)
        return url
      }
      const buf = await resp.arrayBuffer()
      const ext = url.match(/\.(jpe?g|png|webp|gif)/i)?.[1] || 'jpeg'
      const filename = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const localPath = `/root/shipin-cinematic-studio/backend/public/uploads/${filename}`
      writeFileSync(localPath, Buffer.from(buf))
      const publicUrl = `${process.env.IMAGE_BASE_URL || 'https://aigc.fushtn.com'}/uploads/${filename}`
      console.log(`[Video Worker] ✅ 参考图已转存本地: ${publicUrl}`)
      try {
        const { cosService } = await import('../services/cos-service.js')
        const { cosUrl } = await cosService.uploadBuffer(Buffer.from(buf), filename, undefined)
        console.log(`[Video Worker] ✅ 参考图已上传COS: ${cosUrl}`)
        return cosUrl
      } catch (cosErr: any) {
        console.warn(`[Video Worker] ⚠️ COS上传失败，回退本地URL: ${cosErr?.message || cosErr}`)
        return publicUrl
      }
    } catch (e: any) {
      console.warn(`[Video Worker] ⚠️ 转存参考图异常: ${e?.message || e}`)
      return url
    }
  }

  if (firstFrameUrl || lastFrameUrl) {
    // 先转存所有图片 URL
    const resolvedFirstUrl = firstFrameUrl ? await ensureLocalUrl(firstFrameUrl) : ''
    const resolvedLastUrl = lastFrameUrl ? await ensureLocalUrl(lastFrameUrl) : ''

    // 阿里万相 R2V: 传多张 reference_image
    const r2vList: Array<{ type: string; url: string }> = []
    if (resolvedFirstUrl) r2vList.push({ type: 'reference_image', url: resolvedFirstUrl })
    if (resolvedLastUrl) r2vList.push({ type: 'reference_image', url: resolvedLastUrl })
    payload.input.r2vMedia = r2vList.length > 0 ? r2vList : undefined

    // 同步更新 referenceImages（所有适配器通用）
    if (r2vList.length > 0) {
      payload.input.referenceImages = r2vList.map(r => r.url)
    }

    // ★ 同时更新 imageUrl/imageUrl2（wan2.6-i2v 旧格式走的是这两个字段）
    if (resolvedFirstUrl) payload.input.imageUrl = resolvedFirstUrl
    if (!resolvedFirstUrl && resolvedLastUrl) payload.input.imageUrl = resolvedLastUrl
    if (resolvedLastUrl) payload.input.imageUrl2 = resolvedLastUrl
  }

  console.log(`[Video Worker] 📝 单段生成: prompt=${videoPrompt.length}字, 参考图${frameImageUrls.length}张, ${duration}s`)

  const result = await callProvider('video', payload.userId, payload.projectId, payload)
  
  // ── CTBL Observation Metrics ──
  const hasCTBL = videoPrompt.includes('时间连续性约束')
  const ctblTags: string[] = ['CTBL_PRESENT:' + hasCTBL]
  if (hasCTBL) {
    // Check which sub-sections are present
    ctblTags.push('CSR_EMOTION:' + videoPrompt.includes('情绪连续性'))
    ctblTags.push('CSR_SCENE:' + videoPrompt.includes('场景时间连续性'))
    ctblTags.push('CSR_ACTION:' + videoPrompt.includes('动作连续性'))
    ctblTags.push('CSR_LIGHTING:' + videoPrompt.includes('光照连续性'))
    ctblTags.push('CSR_ATMOSPHERE:' + videoPrompt.includes('氛围连续性'))
  }
  const promptLen = videoPrompt.length
  const gsr = result?.url ? 1 : 0
  const failureType = !result?.url ? classifyCTBLFailure(result, promptLen, hasCTBL) : 'none'
  ctblTags.push('GSR:' + gsr)
  ctblTags.push('PROMPT_LEN:' + promptLen)
  ctblTags.push('FAILURE:' + failureType)
  
  console.log(`[CTBL-OBS] ${ctblTags.join(' | ')} | segment=${payload.input?.segmentIndex || '?'}`)
  
  if (result?.url?.startsWith('http')) return await persistVideoResult(payload, result)
  console.warn('[Video Worker] ⚠️ provider 未返回有效视频')
  return result
}

/**
 * ffmpeg 拼接两段视频为一段（不重新编码，纯流式拼接）
 */
async function concatTwoVideos(url1: string, url2: string, payload: TaskPayload): Promise<string> {
  const tmpDir = `/tmp/video-concat-${payload.traceId || Date.now()}`
  const tmp1 = `${tmpDir}/seg1.mp4`
  const tmp2 = `${tmpDir}/seg2.mp4`
  const outputFile = `/tmp/video-concat-${payload.traceId || Date.now()}.mp4`

  try {
    await execAsync(`mkdir -p ${tmpDir}`)

    // 下载
    const download = (url: string, dest: string) => new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(dest)
      const proto = url.startsWith('https') ? https : http
      proto.get(url, res => {
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
      }).on('error', reject)
    })

    await download(url1, tmp1)
    await download(url2, tmp2)

    // ffmpeg concat demuxer 拼接（不重新编解码，速度快、质量无损）
    const concatList = `${tmpDir}/list.txt`
    fs.writeFileSync(concatList, `file '${tmp1}'\nfile '${tmp2}'\n`)

    await execAsync(
      `ffmpeg -f concat -safe 0 -i ${concatList} -c copy -movflags +faststart ${outputFile} -y`,
      { timeout: 60000 }
    )

    // 上传到 OSS/本地
    const uploadResult: any = {}

    // 上传为 public/uploads/ 文件（前端静态服务会自动提供）
    const uploadsDir = '/root/shipin-cinematic-studio/frontend/.output/public/uploads'
    fs.mkdirSync(uploadsDir, { recursive: true })
    const fileName = `merged_${payload.traceId || Date.now()}.mp4`
    const localPath = `${uploadsDir}/${fileName}`
    fs.copyFileSync(outputFile, localPath)

    // 清理临时文件
    fs.rmSync(tmpDir, { recursive: true, force: true })
    try { fs.unlinkSync(outputFile) } catch {}

    // 返回公网 URL（基于前端静态目录）
    return `/uploads/${fileName}`
  } catch (err: any) {
    console.error('[Video Worker] ❌ 拼接失败:', err.message)
    // 清理
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    try { fs.unlinkSync(outputFile) } catch {}
    return ''
  }
}

/** 持久化视频结果到 AiVideoSegment 和 videoTask */
async function persistVideoResult(payload: TaskPayload, result: any): Promise<any> {
  // ⭐ 视频下载：将火山临时 URL 下载到本地，避免 CORS 和 403
  let videoUrl = result?.url || ""
  if (videoUrl) {
    try {
      const { downloadFileToLocal } = await import("./queue-manager.js")
      const localUrl = await downloadFileToLocal(videoUrl)
      if (localUrl && localUrl !== videoUrl) {
        console.log(`[Video Worker] ⬇️ 下载成功: ${videoUrl.substring(0,60)}... → ${localUrl}`)
        videoUrl = localUrl
      }
    } catch (e) {
      console.warn(`[Video Worker] ⚠️ 视频下载失败，回退原 URL:`, e instanceof Error ? e.message : e)
    }
  }
  if (!videoUrl) return result
  if (payload.taskId && await checkTaskCancelled(payload.taskId)) {
    console.log(`[Video Worker] Task ${payload.taskId.substring(0, 8)} cancelled during execution`)
    return { cancelled: true }
  }

  // 持久化到 AiVideoSegment
  try {
    let segmentId = String(payload.input?.segmentId || payload.input?.segmentIndex || '')
    // 兼容: segmentIndex 可能是纯数字（如 "3"），但 DB 里存的是 "seg_3"
    if (segmentId && !segmentId.startsWith('seg_')) {
      segmentId = `seg_${segmentId}`
    }
    if (segmentId) {
      const { prisma } = await import('../utils/index.js')
      await prisma.aiVideoSegment.updateMany({
        where: { projectId: payload.projectId, segmentId },
        data: { videoUrl },
      })
      console.log(`[Video Worker] ✅ 持久化 AiVideoSegment: project=${payload.projectId}, segmentId=${segmentId}`)
    }
  } catch (e: any) {
    console.warn(`[Video Worker] ⚠️ 持久化 AiVideoSegment 警告: ${e.message}`)
  }

  // 更新 videoTask 状态
  if (payload.taskId) {
    try {
      const { prisma } = await import('../utils/index.js')
      await prisma.videoTask.update({
        where: { id: payload.taskId },
        data: {
          status: 'completed',
          error: JSON.stringify({ output: { url: videoUrl } }),
        },
      })
    } catch (_) {}
  }

  return result
}

/**
 * 帧序列视频生成管道
 *
 * 步骤：
 *   1. 帧序列引擎（FSE）：逐帧生成关键帧图像（img2img 增量生成）
 *   2. 视频合成器（Composer）：关键帧序列 → ffmpeg 合成平滑视频
 *   3. 持久化结果
 */
async function processTTS(payload: TaskPayload): Promise<any> {
  if (await checkTaskCancelled(payload.taskId)) return { cancelled: true }

  console.log(`[TTS Worker] Processing: project=${payload.projectId}, source=${payload.source || payload.input?.source || 'unknown'}, traceId=${payload.traceId}`)
  const result = await callProvider('tts', payload.userId, payload.projectId, payload)

  if (payload.taskId && await checkTaskCancelled(payload.taskId)) {
    console.log(`[TTS Worker] Task ${payload.taskId.substring(0, 8)} cancelled during execution`)
    return { cancelled: true }
  }

  let url = result?.url || result?.audioUrl || ''
  const duration = result?.duration || 0
  // ⭐ TTS 音频下载到本地，避免 CSP 和外部 URL 过期
  if (url && !url.startsWith('/uploads/')) {
    try {
      const { downloadFileToLocal } = await import("./queue-manager.js")
      const localUrl = await downloadFileToLocal(url)
      if (localUrl && localUrl !== url) {
        console.log(`[TTS Worker] ⬇️ 下载成功: ${url.substring(0,60)}... → ${localUrl}`)
        url = localUrl
      }
    } catch (e) {
      console.warn(`[TTS Worker] ⚠️ 音频下载失败: ${e instanceof Error ? e.message : e}`)
    }
  }
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
            sequenceIndex: Number(payload.input?.idx ?? idx),
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

  // 方案 B: 下载到本地，避免火山 CORS
  const localUrl = await downloadImageLocal(url)

  try {
    const { prisma } = await import('../utils/index.js')
    // 使用 upsert 替代 deleteMany+create，避免竞态
    const existingFrame = await prisma.frameImage.findFirst({
      where: { projectId: payload.projectId, segmentId, frameType },
    })
    if (existingFrame) {
      await prisma.frameImage.update({
        where: { id: existingFrame.id },
        data: { imageUrl: localUrl },
      })
    } else {
      await prisma.frameImage.create({
        data: { projectId: payload.projectId, segmentId, frameType, imageUrl: localUrl },
      })
    }
    console.log(`[Frame Worker] Saved to frameImage: ${payload.projectId}/${segmentId}/${frameType}: ${localUrl}`)
  } catch (e: any) {
    console.warn(`[Frame Worker] DB save warning: ${e.message}\nproject=${payload.projectId} sid=${segmentId} type=${frameType}`)
    // 仍返回结果不阻塞生成流程
  }

  return { url: localUrl, type: frameType, segmentId }
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

