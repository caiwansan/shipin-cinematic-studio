import { Queue, QueueEvents, Worker } from 'bullmq'
import Redis from 'ioredis'
import { env } from '../config/env.js'

/**
 * 优先级队列系统
 * 
 * 队列策略：
 * - P0 (priority=0): 用户点击生成，实时响应
 * - P1 (priority=1): 项目主流程，正常任务 
 * - P2 (priority=2): 后台优化，非用户感知
 * - P3 (priority=3): 批量任务，低优先级
 * 
 * 每个优先级一个独立队列，防止高优被低优阻塞
 */

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
})

// 多优先级队列
const queues: Record<number, Queue> = {}

export function getQueue(priority: number = 1): Queue {
  if (!queues[priority]) {
    const prefix = priority === 0 ? 'critical' :
                   priority === 1 ? 'normal' :
                   priority === 2 ? 'background' : 'batch'
    queues[priority] = new Queue(`video-${prefix}`, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600 * 24 },
        removeOnFail: { age: 3600 * 24 * 7 },
      },
    })
  }
  return queues[priority]
}

// DLQ 队列（死信）
export const dlqQueue = new Queue('video-dlq', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 3600 * 24 * 30 }, // 保留30天
    removeOnFail: { age: 3600 * 24 * 30 },
  },
})

// 入队任务
export async function enqueueTask(params: {
  taskId: string
  projectId: string
  priority?: number
  storyboardIds?: string[]
  scheduledFor?: Date
}) {
  const { taskId, projectId, priority = 1, storyboardIds, scheduledFor } = params
  const queue = getQueue(priority)

  await queue.add(
    'process-video',
    { taskId, projectId, storyboardIds },
    {
      priority, // BullMQ 内部优先级
      delay: scheduledFor ? scheduledFor.getTime() - Date.now() : undefined,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: priority === 0 ? 1000 :  // P0: 1s
               priority === 1 ? 2000 :  // P1: 2s
               priority === 2 ? 5000 :  // P2: 5s
               10000, // P3: 10s
      },
    }
  )

  return { taskId, queue: `video-${priority === 0 ? 'critical' : priority === 1 ? 'normal' : priority === 2 ? 'background' : 'batch'}` }
}

// 入死信队列
export async function enqueueDLQ(params: {
  originalTaskId: string
  projectId: string
  error: string
  retryCount: number
}) {
  await dlqQueue.add('dlq-process', params, {
    attempts: 1,
  })
}

// 获取队列状态
export async function getQueueStats() {
  const queues = await Promise.all(
    [0, 1, 2, 3].map(async (priority) => {
      try {
        const q = getQueue(priority)
        const [waiting, active, completed, failed] = await Promise.all([
          q.getWaitingCount(),
          q.getActiveCount(),
          q.getCompletedCount(),
          q.getFailedCount(),
        ])
        const name = priority === 0 ? 'critical' :
                      priority === 1 ? 'normal' :
                      priority === 2 ? 'background' : 'batch'
        return { queue: `video-${name}`, priority, waiting, active, completed, failed }
      } catch {
        return { queue: `video-${priority}`, priority, waiting: -1, active: -1, completed: -1, failed: -1 }
      }
    })
  )

  const dlq = await dlqQueue.getJobCounts()
  return { queues, dlq }
}

// 清除所有队列
export async function drainAllQueues() {
  for (const priority of [0, 1, 2, 3]) {
    try {
      const q = getQueue(priority)
      await q.drain()
      await q.obliterate({ force: true })
    } catch (e) {
      // ignore
    }
  }
}
