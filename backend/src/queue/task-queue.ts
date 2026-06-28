/**
 * queue/task-queue.ts — 任务入队 API（已迁移到统一队列）
 *
 * 保留兼容接口，内部使用 unifiedQueue
 * 入队时同时写入 DB（TaskQueue）并发送到 BullMQ
 */
import crypto from 'crypto'
import { prisma } from '../utils/index.js'
import { enqueueTask, type TaskType } from './queue-manager.js'

export interface EnqueueTaskInput {
  userId: string
  projectId?: string
  taskType: TaskType
  priority: number      // 0-100, 越低越优先
  inputPayload: any
  provider?: string
  maxRetries?: number
}

export interface EnqueueResult {
  success: boolean
  taskId: string
  queueName: string
}

/**
 * 将任务入队（DB + BullMQ）
 * @deprecated 使用 queue-manager.enqueueTask 替代
 */
export async function enqueueTaskToQueue(input: EnqueueTaskInput): Promise<EnqueueResult> {
  const { userId, projectId, taskType, priority, inputPayload } = input
  const taskId = crypto.randomUUID()

  // 写入 DB
  await prisma.taskQueue.create({
    data: {
      id: taskId,
      userId,
      type: taskType,
      priority,
      status: 'queued',
      payload: typeof inputPayload === 'string' ? inputPayload : JSON.stringify(inputPayload),
      maxRetries: input.maxRetries ?? 3,
      estimatedCost: 0,
    },
  })

  // 入队统一队列
  await enqueueTask({
    taskType,
    projectId: projectId || '',
    userId,
    input: inputPayload,
    priority,
    taskId,
  })

  console.log(`[TaskQueue] Enqueued ${taskType}/${taskId.substring(0,8)} for user ${userId.substring(0,8)} priority=${priority}`)

  return { success: true, taskId, queueName: taskType }
}

/**
 * 查询任务状态
 */
export async function getTaskStatus(taskId: string): Promise<{
  status: string
  result?: any
  error?: string
} | null> {
  const task = await prisma.taskQueue.findUnique({
    where: { id: taskId },
    select: { status: true, error: true },
  })
  if (!task) return null
  return { status: task.status, error: task.error || undefined }
}

/**
 * 更新任务状态为完成
 */
export async function completeTask(taskId: string, result: any): Promise<void> {
  await prisma.taskQueue.update({
    where: { id: taskId },
    data: {
      status: 'completed',
      endTime: new Date(),
      payload: typeof result === 'string' ? result : JSON.stringify(result),
    },
  })
}

/**
 * 更新任务状态为失败
 */
export async function failTask(taskId: string, error: string): Promise<void> {
  await prisma.taskQueue.update({
    where: { id: taskId },
    data: {
      status: 'failed',
      endTime: new Date(),
      error,
    },
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "queue-legacy",
  "mode": "SHADOW"
};

