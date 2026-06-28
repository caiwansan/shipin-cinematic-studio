// @ts-nocheck
/**
 * @deprecated 已由 queue/worker-runtime.ts（BullMQ 真 Worker）取代
 * 保留以兼容旧版调度，新任务走统一队列
 */
import { prisma, taskEventEmitter, sleep } from '../utils/index.js'
import os from 'os'
import { scheduler } from './scheduler.service.js'
import { workerPool } from './worker-pool.service.js'

const WORKER_ID = `worker-${os.hostname()}-${process.pid}`
const MAX_CONCURRENCY = 3

export async function startMockWorker() {
  // 如果新 Worker 已启动，跳过旧的轮询 Worker
  if (process.env.DISABLE_LEGACY_WORKER === 'true') {
    console.log('[MockWorker] Legacy worker disabled (using unified queue)')
    return
  }
  console.log(`🧪 Mock Worker [${WORKER_ID}] started - Worker Pool V2`)

  // === Worker 注册心跳（每15秒） ===
  const heartbeatInterval = setInterval(async () => {
    try {
      const activeCount = await prisma.videoTask.count({
        where: { lockedBy: WORKER_ID, status: { notIn: ['completed', 'failed', 'queued'] } },
      })

      await workerPool.heartbeat(WORKER_ID, os.hostname(), {
        capacity: MAX_CONCURRENCY,
        currentLoad: activeCount,
        version: '2.0',
        tags: ['mock', 'video'],
        capabilities: {
          video: true,
          image: true,
          maxDuration: 30,
        },
      })
    } catch (e) {
      console.error('Heartbeat error:', e)
    }
  }, 15000)

  while (true) {
    try {
      // === 任务1: Worker 自动摘除（心跳超时 > 30s） ===
      const pruned = await workerPool.autoPrune()
      if (pruned > 0) {
        console.log(`🧹 Pruned ${pruned} stale workers`)
      }

      // === 任务2: 超时任务回收 ===
      const staleThreshold = new Date(Date.now() - 30_000)
      const staleTasks = await prisma.videoTask.findMany({
        where: {
          lockedBy: { not: null },
          heartbeatAt: { lt: staleThreshold },
          status: { in: ['processing', 'optimizing', 'storyboarding', 'generating', 'stitching'] },
        },
        orderBy: { priority: 'asc' },
      })

      for (const task of staleTasks) {
        await scheduler.handleFailure({
          taskId: task.id,
          error: `Worker ${task.lockedBy} heartbeat timeout - auto recovered`,
          workerId: WORKER_ID,
        })
      }

      // === 任务3: 按优先级 + Worker Pool 分配抢任务 ===
      for (const priority of [0, 1, 2, 3]) {
        const currentLoad = await prisma.videoTask.count({
          where: { lockedBy: WORKER_ID, status: { notIn: ['completed', 'failed', 'queued'] } },
        })
        if (currentLoad >= MAX_CONCURRENCY) break

        const pendingTasks = await prisma.videoTask.findMany({
          where: { status: 'queued', priority },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          take: MAX_CONCURRENCY - currentLoad,
        })

        for (const task of pendingTasks) {
          // 用 Worker Pool 分配
          const assigned = await workerPool.assignTask(task.id, 1)
          if (assigned && assigned.workerId === WORKER_ID) {
            processTaskSafe(task)
          }
        }
      }
    } catch (err) {
      console.error('Mock worker poll error:', err)
    }

    await sleep(3000)
  }
}

async function processTaskSafe(task: any) {
  const startTime = Date.now()
  let success = true
  let errorMsg: string | undefined

  try {
    const locked = await prisma.videoTask.updateMany({
      where: { id: task.id, status: 'queued', lockedBy: null },
      data: { status: 'processing', lockedBy: WORKER_ID, heartbeatAt: new Date() },
    })
    if (locked.count === 0) return

    await processTask(task.id)
  } catch (err) {
    success = false
    errorMsg = String(err)
    await scheduler.handleFailure({
      taskId: task.id,
      error: errorMsg,
      workerId: WORKER_ID,
    })
  } finally {
    // 报告执行结果到 Worker Pool
    const responseTime = (Date.now() - startTime) / 1000
    await workerPool.reportExecution(WORKER_ID, task.id, {
      success,
      responseTime,
      error: errorMsg,
    })
    // 释放容量
    await workerPool.releaseCapacity(WORKER_ID, 1)
  }
}

async function processTask(taskId: string) {
  console.log(`🎬 [${WORKER_ID}] Processing task ${taskId} with VolcEngine Seedance`)

  // 查任务详情（获取 prompt）
  const task = await prisma.videoTask.findUnique({ where: { id: taskId } })
  if (!task) throw new Error(`Task ${taskId} not found`)

  // 查关联的 storyboard 获取 prompt
  let prompt = ''
  let duration = 5
  let ratio = '16:9'

  if (task.storyboardId) {
    const storyboard = await prisma.storyboard.findUnique({ where: { id: task.storyboardId } })
    if (storyboard) {
      prompt = `${storyboard.subject || ''} ${storyboard.action || ''} ${storyboard.setting || ''}`.trim()
      duration = storyboard.duration || 5
      if (storyboard.shotType === 'closeup') ratio = '9:16'
    }
  }

  // 如果没有 prompt，用默认提示
  if (!prompt) {
    prompt = '电影级视频片段，高质量视觉效果，动态场景'
  }

  // 限制 duration 4-12秒
  duration = Math.min(12, Math.max(4, Math.round(Number(duration))))

  // 1. 提交火山引擎 video 生成任务
  await scheduler.reportProgress({
    taskId, status: 'generating', progress: 10,
    message: `提交到火山引擎 Seedance (${duration}s, ${ratio})`,
    workerId: WORKER_ID,
  })

  const { VideoAdapter } = await import('../runtime/adapters/video/VideoAdapter.js')
  const adapter = new VideoAdapter()
  const result = await adapter.execute('system', {
    prompt,
    duration,
  })
  const volcTaskId = result.taskId || ''

  // 2. 轮询等待完成
  await scheduler.reportProgress({
    taskId, status: 'generating', progress: 30,
    message: '火山引擎视频生成中...',
    workerId: WORKER_ID,
  })

  let pollCount = 0
  const result = await (async function poll() {
    while (true) {
      const { volcengineVideo } = await import('./volcengine-video.provider.js')
      const res = await volcengineVideo.poll(volcTaskId)

      if (res.status === 'succeeded') {
        return res
      }
      if (res.status === 'failed') {
        throw new Error(`火山引擎生成失败: ${res.error}`)
      }

      pollCount++
      const progress = Math.min(80, 30 + pollCount * 5)
      await scheduler.reportProgress({
        taskId, status: 'generating', progress,
        message: `视频生成中 (${pollCount * 5}s)...`,
        workerId: WORKER_ID,
      })

      await sleep(5000)
    }
  })()

  // 3. 完成
  const videoUrl = result.videoUrl!
  console.log(`✅ [${WORKER_ID}] VolcEngine done: ${videoUrl}`)

  // 4. 更新数据库
  await prisma.$transaction(async (tx) => {
    await tx.videoTask.update({
      where: { id: taskId },
      data: { status: 'completed', progress: 100, lockedBy: null, heartbeatAt: null, completedAt: new Date() },
    })

    await tx.videoSegment.create({
      data: {
        taskId,
        shotIndex: 0,
        filePath: videoUrl,
        duration,
        status: 'completed',
        resolution: result.resolution || '1080p',
      },
    })

    await tx.asset.upsert({
      where: { taskId_type: { taskId, type: 'video' } },
      create: {
        projectId: task.projectId,
        type: 'video',
        taskId,
        fileName: `volcengine_${taskId.slice(0, 8)}.mp4`,
        filePath: videoUrl,
        mimeType: 'video/mp4',
        fileSize: 0,
        duration,
      },
      update: { filePath: videoUrl },
    })
  })

  taskEventEmitter.emit('task:progress', {
    type: 'completed',
    taskId,
    status: 'completed',
    progress: 100,
    message: '火山引擎视频生成完成',
    videoUrl,
    timestamp: new Date().toISOString(),
  })

  console.log(`✅ [${WORKER_ID}] Task ${taskId} completed via VolcEngine`)
}
