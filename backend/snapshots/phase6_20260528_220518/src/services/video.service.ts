import { prisma } from '../utils/index.js'
import { randomUUID } from 'crypto'

export const videoService = {
  async findByProject(projectId: string) {
    return await prisma.videoTask.findMany({
      where: { projectId },
      include: { segments: true },
      orderBy: { createdAt: 'desc' },
    })
  },

  async findById(id: string) {
    return await prisma.videoTask.findUnique({
      where: { id },
      include: { segments: true, taskLogs: { orderBy: { createdAt: 'asc' } } },
    })
  },

  /**
   * 幂等服务端创建 — 用 idempotencyKey 防重复提交
   * 如果没有 idempotencyKey，自动生成
   */
  async create(projectId: string, data: any) {
    const storyboardId = data.storyboardId ?? null
    const idempotencyKey = data.idempotencyKey ?? `${projectId}:${storyboardId ?? 'no-sb'}:${randomUUID().slice(0, 8)}`

    // 幂等检查：用 idempotencyKey 去重
    const existing = await prisma.videoTask.findUnique({
      where: { idempotencyKey },
    })
    if (existing) {
      console.log(`🔄 Idempotent: returning existing task ${existing.id} for key ${idempotencyKey}`)
      return existing
    }

    return await prisma.videoTask.create({
      data: {
        projectId,
        storyboardId,
        status: 'queued',
        priority: data.priority ?? 1,
        idempotencyKey,
      },
    })
  },

  async cancel(id: string) {
    const task = await prisma.videoTask.findUnique({ where: { id } })
    if (!task) throw new Error('Task not found')

    // 状态锁：只有 queued 或 processing 状态可以取消
    const cancellableStatuses: string[] = ['queued', 'processing', 'optimizing', 'storyboarding', 'generating', 'stitching']
    if (!cancellableStatuses.includes(task.status)) {
      throw new Error(`Cannot cancel task in status: ${task.status}`)
    }

    return await prisma.videoTask.update({
      where: { id },
      data: { status: 'cancelled' as any, error: 'Cancelled by user', retryCount: 0, lockedBy: null, heartbeatAt: null },
    })
  },

  async getSegments(taskId: string) {
    return await prisma.videoSegment.findMany({
      where: { taskId },
      orderBy: { shotIndex: 'asc' },
    })
  },

  /**
   * 检查 idempotencyKey 是否已存在
   * 用于前端提交前预检
   */
  async checkIdempotency(key: string) {
    const existing = await prisma.videoTask.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, status: true },
    })
    return existing
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

