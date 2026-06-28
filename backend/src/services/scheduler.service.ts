import { prisma, taskEventEmitter } from '../utils/index.js'
import { getQueue, enqueueDLQ, getQueueStats } from './task-queue.service.js'

// 各优先级队列的并发上限
const PRIORITY_CONCURRENCY: Record<number, number> = {
  0: 3,  // P0: 最多3个并发
  1: 5,  // P1: 最多5个
  2: 8,  // P2: 最多8个
  3: 10, // P3: 最多10个
}

// 指数退避时间表（秒）
const BACKOFF_SCHEDULE = [1, 2, 5, 10, 30]

/**
 * Scheduler V2 — 智能任务调度器
 * 
 * 功能：
 * - 优先级调度 (P0~P3)
 * - 指数退避重试
 * - 死信队列
 * - 队列状态监控
 */
export const scheduler = {
  /**
   * 提交一个任务到调度器
   */
  async submit(params: {
    projectId: string
    storyboardId?: string
    priority?: number
    taskType?: string
    idempotencyKey?: string
  }) {
    const { projectId, storyboardId, priority = 1, idempotencyKey } = params

    // 幂等检查
    if (idempotencyKey) {
      const existing = await prisma.videoTask.findUnique({
        where: { idempotencyKey },
      })
      if (existing) {
        return { task: existing, isNew: false }
      }
    }

    // 创建任务
    const task = await prisma.videoTask.create({
      data: {
        projectId,
        storyboardId: storyboardId ?? null,
        status: 'queued',
        priority,
        idempotencyKey,
      },
    })

    // 入队（异步，不阻塞返回）
    const queue = getQueue(priority)
    await queue.add('process-video', {
      taskId: task.id,
      projectId,
      storyboardId,
    }, {
      priority,
      attempts: 3,
      backoff: { type: 'exponential', delay: BACKOFF_SCHEDULE[0] * 1000 },
    })

    return { task, isNew: true }
  },

  /**
   * 处理任务的进度更新（由 worker 调用）
   */
  async reportProgress(params: {
    taskId: string
    status: string
    progress: number
    message: string
    workerId: string
  }) {
    const { taskId, status, progress, message, workerId } = params

    // 更新数据库
    await prisma.videoTask.update({
      where: { id: taskId },
      data: {
        status: status as any,
        progress,
        lockedBy: workerId,
        heartbeatAt: new Date(),
      },
    })

    // 写日志
    const log = await prisma.taskLog.create({
      data: { taskId, level: 'info', message, eventId: `${taskId}:${status}:${Date.now()}` },
    })

    // 推 SSE
    taskEventEmitter.emit('task:progress', {
      type: 'progress',
      taskId,
      status,
      progress,
      message,
      eventId: log.eventId,
      timestamp: new Date().toISOString(),
    })
  },

  /**
   * 处理任务失败（指数退避 + DLQ）
   */
  async handleFailure(params: {
    taskId: string
    error: string
    workerId: string
  }) {
    const { taskId, error, workerId } = params

    const task = await prisma.videoTask.findUnique({ where: { id: taskId } })
    if (!task) return

    const newRetryCount = task.retryCount + 1

    if (newRetryCount < task.maxRetries) {
      // 指数退避：回队列，下次重试
      const backoffSeconds = BACKOFF_SCHEDULE[Math.min(newRetryCount - 1, BACKOFF_SCHEDULE.length - 1)]

      await prisma.videoTask.update({
        where: { id: taskId },
        data: {
          status: 'queued',
          lockedBy: null,
          heartbeatAt: null,
          retryCount: newRetryCount,
          error: `${error} (retry ${newRetryCount}/${task.maxRetries})`,
        },
      })

      // 延迟入队
      const queue = getQueue(task.priority)
      await queue.add('process-video', {
        taskId: task.id,
        projectId: task.projectId,
      }, {
        delay: backoffSeconds * 1000,
        priority: task.priority,
        attempts: task.maxRetries - newRetryCount + 1,
      })

      // 通知
      taskEventEmitter.emit('task:progress', {
        type: 'retry',
        taskId,
        status: 'queued',
        progress: task.progress,
        message: `任务失败，${backoffSeconds}秒后重试 (${newRetryCount}/${task.maxRetries})`,
        timestamp: new Date().toISOString(),
      })

      console.log(`🔁 Task ${taskId} failed, retry ${newRetryCount}/${task.maxRetries} in ${backoffSeconds}s`)
    } else {
      // 超过最大重试 → 进死信队列
      await prisma.videoTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          lockedBy: null,
          heartbeatAt: null,
          retryCount: newRetryCount,
          error: `${error} (exceeded ${task.maxRetries} retries)`,
        },
      })

      // 写 DLQ
      await enqueueDLQ({
        originalTaskId: taskId,
        projectId: task.projectId,
        error: `${error} (exceeded ${task.maxRetries} retries)`,
        retryCount: newRetryCount,
      })

      // 通知
      taskEventEmitter.emit('task:progress', {
        type: 'failed',
        taskId,
        status: 'failed',
        progress: task.progress,
        message: `任务失败，已进入死信队列`,
        timestamp: new Date().toISOString(),
      })

      console.log(`💀 Task ${taskId} sent to DLQ after ${task.maxRetries} retries`)
    }
  },

  /**
   * 获取调度器状态
   */
  async getStatus() {
    const queueStats = await getQueueStats()

    const taskDistribution = await prisma.videoTask.groupBy({
      by: ['status'],
      _count: true,
    })

    const dlqCount = await prisma.deadLetterTask.count()

    const activeWorkers = await prisma.workerRegistration.count({
      where: { status: 'active', healthy: true },
    })

    return {
      queues: queueStats.queues,
      dlq: {
        ...queueStats.dlq,
        total: dlqCount,
      },
      tasks: taskDistribution.reduce((acc, t) => {
        acc[t.status] = t._count
        return acc
      }, {} as Record<string, number>),
      workers: activeWorkers,
    }
  },
}
