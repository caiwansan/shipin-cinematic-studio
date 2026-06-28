/**
 * queue/queue-manager.ts — 统一队列管理器（单 BullMQ 实例）
 *
 * 整合：原有的 task-queue.service.ts（优先级） + queue/*（taskType）
 * 现在：统一的队列 + 真正的 BullMQ Worker
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq'
import Redis from 'ioredis'
import { env } from '../config/env.js'
import { taskEventEmitter } from '../utils/index.js'
import { createTrace, addSpan, completeTrace } from '../observability/trace.js'
import { prisma } from '../utils/index.js'
import type { SnapshotPayload } from '../services/runtime-context.js'
import { getContextSnapshot, withRuntimeContext, restoreContextFromSnapshot, createContext } from '../services/runtime-context.js'
import { runtimeObserver } from '../services/runtime-observer.service.js'
import type { RuntimePayload } from '../runtime/runtime-payload.js'

export type TaskType = 'image' | 'video' | 'tts' | 'llm' | 'export' | 'frame'

export interface TaskPayload {
  taskType: TaskType
  projectId: string
  userId: string
  input: any
  priority: number
  source?: string     // character / scene / storyboard / frame / voice
  traceId?: string
  taskId?: string     // VideoTask 或 ExportTask 的 ID
  // Phase 1-D: 显式 RuntimePayload，worker 不再 reconstruct runtime
  runtime?: RuntimePayload
  // Phase 2C: RuntimeContext snapshot，已降级为仅 trace/logging
  contextSnapshot?: SnapshotPayload
}

// ======== Redis 连接 ========
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
})

// ======== 文件下载（方案 B：远程 URL → 本地存储）========
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as p from 'path'

export async function downloadFileToLocal(remoteUrl: string): Promise<string> {
  if (!remoteUrl || remoteUrl.startsWith('/') || !remoteUrl.startsWith('http')) return remoteUrl
  try {
    const uploadDir = p.resolve(process.cwd(), 'public/uploads')
    await fs.promises.mkdir(uploadDir, { recursive: true })
    const ext = p.extname(remoteUrl.split('?')[0]?.split('#')[0] || '') || '.mp4'
    const filename = `dl_${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`
    const filepath = p.join(uploadDir, filename)

    const body = await new Promise<Buffer>((resolve, reject) => {
      const client = remoteUrl.startsWith('https') ? https : http
      const req = client.get(remoteUrl, { timeout: 30000 }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const c2 = res.headers.location.startsWith('https') ? https : http
          c2.get(res.headers.location, { timeout: 30000 }, (r2) => {
            const chunks: Buffer[] = []
            r2.on('data', (c) => chunks.push(c))
            r2.on('end', () => resolve(Buffer.concat(chunks)))
            r2.on('error', reject)
          }).on('error', reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')) })
    })

    await fs.promises.writeFile(filepath, body)
    const localUrl = `/uploads/${filename}`
    console.log(`[QueueManager] ⬇️ 下载成功: ${remoteUrl.substring(0, 40)}... → ${localUrl}`)
    return localUrl
  } catch (e: any) {
    console.warn(`[QueueManager] ⚠️ 下载失败 ${remoteUrl.substring(0, 40)}...: ${e.message}，使用原URL`)
    return remoteUrl
  }
}

// ======== 统一队列 ========
export const unifiedQueue = new Queue<TaskPayload>('ai-runtime', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: { age: 3600 * 24 * 7 },
  },
})

// ======== 队列事件 ========
export const queueEvents = new QueueEvents('ai-runtime', { connection })

// ======== 旧兼容接口 ========
// 让 scheduler.service.ts 的 getQueue(priority) 工作
import { Queue as BQueue } from 'bullmq'
const legacyQueues: Record<number, BQueue> = {}
export function getQueue(priority: number = 1): BQueue {
  if (!legacyQueues[priority]) {
    const prefix = priority === 0 ? 'critical' :
                   priority === 1 ? 'normal' :
                   priority === 2 ? 'background' : 'batch'
    legacyQueues[priority] = new BQueue(`video-${prefix}`, { connection })
  }
  return legacyQueues[priority]
}

// DLQ
export const dlqQueue = new Queue('runtime-dlq', { connection })

// ======== 统一入队 ========
export async function enqueueTask(params: {
  taskType: TaskType
  projectId: string
  userId: string
  input: any
  priority?: number
  taskId?: string
  /** Phase 1-D: 显式 RuntimePayload */
  runtime?: RuntimePayload
}): Promise<string> {
  const traceId = createTrace({
    userId: params.userId,
    projectId: params.projectId,
    taskType: params.taskType,
  })

  await unifiedQueue.add(
    params.taskType,
    {
      taskType: params.taskType,
      projectId: params.projectId,
      userId: params.userId,
      input: params.input,
      source: params.input?.source || '',
      priority: params.priority ?? 1,
      traceId,
      taskId: params.taskId,
      // Phase 1-D: 显式 runtime payload，worker 直接使用
      runtime: params.runtime,
      // Phase 2C: 携带当前 TraceContext snapshot（仅 trace/logging）
      contextSnapshot: getContextSnapshot(),
    },
    {
      priority: params.priority ?? 1,
      jobId: params.taskId || undefined,
    },
  )

  // Phase 3A: Observer — 入队事件
  runtimeObserver.recordEvent('enqueue', { executionId: traceId, userId: params.userId, sessionId: '' }, {
    taskType: params.taskType,
    projectId: params.projectId,
  })

  addSpan(traceId, 'enqueue', 'ok', { taskType: params.taskType })
  return traceId
}

// ======== Worker 工厂 ========
export function createWorker(
  taskType: TaskType,
  processor: (payload: TaskPayload) => Promise<any>,
  concurrency: number = 2,
): Worker {
  const worker = new Worker<TaskPayload>(
    'ai-runtime',
    async (job: Job<TaskPayload>) => {
      const payload = job.data
      const traceId = payload.traceId

      addSpan(traceId || job.id || '', `worker:${taskType}`, 'ok', {
        jobId: job.id,
        attempt: job.attemptsMade,
      })

      // 通知队列开始处理
      taskEventEmitter.emit('task:progress', {
        taskId: payload.taskId,
        projectId: payload.projectId,
        userId: payload.userId,
        status: 'running',
        traceId,
      })

      try {
        const result = await processor(payload)

        // 更新 DB 状态 — 将结果存入 error 字段（后端轮询用）
        if (payload.taskId) {
          const updateData: any = { status: 'completed' }
          if (result) {
            try {
              const existing = await prisma.videoTask.findUnique({
                where: { id: payload.taskId },
                select: { error: true }
              }).catch(() => null)
              const parsed = existing?.error ? safeParseJSON(existing.error) : {}
              updateData.error = JSON.stringify({ ...parsed, output: result })
            } catch {}
          }
          await prisma.videoTask.update({
            where: { id: payload.taskId },
            data: updateData,
          }).catch(() => {})

          // video 任务完成后，写回 AiVideoSegment.videoUrl
          if (payload.taskType === "video" && result?.url) {
            console.log(`[QueueManager] 🎬 video 回调: taskId=${payload.taskId?.substring(0,12)} projectId=${payload.projectId?.substring(0,12)} result.url=${result?.url?.substring(0,60)}...`)
            // 方案 B: 下载火山视频到本地，避免 CORS
            const realUrl = await downloadFileToLocal(result.url)

            try {
              // 直接从 payload.input 取 segmentId，error 字段可能已被 output 覆盖
              let segmentId = payload.input?.segmentId || payload.input?.segmentIndex || "";
              console.log(`[QueueManager] 📦 payload.input keys: ${Object.keys(payload.input || {}).join(", ") || "(empty)"}, segmentId from input: "${segmentId}"`)
              // 兼容: segmentIndex 可能是纯数字（如 "3"），但 DB 里存的是 "seg_3"
              if (segmentId && !segmentId.startsWith("seg_")) segmentId = "seg_" + segmentId;
              console.log(`[QueueManager] 📝 final segmentId for DB: "${segmentId}"`)
              if (segmentId) {
                const res = await prisma.aiVideoSegment.updateMany({
                  where: { projectId: payload.projectId, segmentId },
                  data: { videoUrl: realUrl },
                }).catch(() => {})
                console.log(`[QueueManager] ✅ videoUrl 更新结果: ${JSON.stringify(res)}`)

                // 同时更新 videoTask.error 中的 url 为本地 URL
                try {
                  await prisma.videoTask.update({
                    where: { id: payload.taskId },
                    data: { error: JSON.stringify({ output: { url: realUrl } }) },
                  })
                } catch (e2: any) {
                  console.warn(`[QueueManager] ⚠️ videoTask 更新失败: ${e2.message}`)
                }
              } else {
                console.warn(`[QueueManager] ⚠️ segmentId 为空，跳过更新 AiVideoSegment`)
              }
            } catch (e: any) {
              console.warn(`[QueueManager] ⚠️ AiVideoSegment 更新失败: ${e.message}`)
            }
          }
        }

        taskEventEmitter.emit('task:progress', {
          taskId: payload.taskId,
          projectId: payload.projectId,
          status: 'completed',
          result,
          traceId,
        })

        completeTrace(traceId || '')
        return result
      } catch (err: any) {
        // 更新 DB 失败状态
        if (payload.taskId) {
          await prisma.videoTask.update({
            where: { id: payload.taskId },
            data: { status: 'failed', error: err.message },
          }).catch(() => {})
        }

        taskEventEmitter.emit('task:progress', {
          taskId: payload.taskId,
          projectId: payload.projectId,
          status: 'failed',
          error: err.message,
          traceId,
        })

        completeTrace(traceId || '', err.message)
        throw err  // BullMQ 会处理重试
      }
    },
    {
      connection,
      concurrency,
      lockDuration: 60_000,
      stalledInterval: 30_000,
      maxStalledCount: 3,
    },
  )

  worker.on('error', (err) => {
    console.error(`[Worker:${taskType}] Error:`, err)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${taskType}] Job ${job?.id} failed:`, err.message)
  })

  worker.on('completed', (job) => {
    console.log(`[Worker:${taskType}] Job ${job.id} completed`)
  })

  return worker
}

// ======== Worker Pool ========
const workers: Worker[] = []

export function createWorkerPool(processors: Record<TaskType, (payload: TaskPayload) => Promise<any>>): Worker[] {
  // 使用单个通用 Worker 代替多个 Worker，避免竞争消费
  // 所有 5 种任务类型由这个 Worker 内部分发
  // Phase 2C: worker 入口重建 RuntimeContext
  const universalWorker = createWorker('image' as TaskType, async (payload: TaskPayload) => {
    const handler = processors[payload.taskType]
    if (!handler) {
      throw new Error(`No processor registered for task type: ${payload.taskType}`)
    }

    // Phase 1-D: 优先使用 payload.runtime 显式传递，ALS 仅用于 trace/logging
    const ctx = payload.contextSnapshot
      ? restoreContextFromSnapshot(payload.contextSnapshot)
      : createContext({ userId: payload.userId, projectId: payload.projectId })

    // Phase 3A: Observer — worker context restore 事件
    runtimeObserver.recordEvent(
      payload.contextSnapshot ? 'worker.context_restored' : 'worker.started',
      ctx,
      {
        taskType: payload.taskType,
        projectId: payload.projectId,
        hadSnapshot: !!payload.contextSnapshot,
      }
    )

    // 在 context 中执行处理器
    return withRuntimeContext(ctx, () => handler(payload))
  }, 3) // concurrency: 允许多个 task 并行处理（降低并发减少 DB/API 压力）

  workers.push(universalWorker)
  return [universalWorker]
}

export async function closeAllWorkers(): Promise<void> {
  await Promise.all(workers.map(w => w.close()))
}

// ======== 队列统计 ========
export async function getQueueStats() {
  const jobCounts = await unifiedQueue.getJobCounts()
  const dlqCounts = await dlqQueue.getJobCounts()
  return {
    queues: { unified: jobCounts },
    dlq: dlqCounts,
    workerCount: workers.length,
  }
}

// ======== 工具函数 ========
function safeParseJSON(s: string): any {
  try { return JSON.parse(s) } catch { return {} }
}

// ======== 兼容旧接口 ========
export async function enqueueDLQ(params: any) {
  await dlqQueue.add('dlq-process', params)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "queue-legacy",
  "mode": "SHADOW"
};

