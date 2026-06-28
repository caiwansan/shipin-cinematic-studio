/**
 * Job Queue — PostgreSQL 原生队列 (SKIP LOCKED)
 *
 * 用于 worker 可靠地获取任务，防止并发冲突。
 * 轻量级实现，不需要 Redis。
 */

import { prisma } from '../utils/index.js'

const WORKER_ID = `worker_${process.pid}_${Date.now() % 10000}`

export class JobQueue {
  /** 入队 */
  async enqueue(jobId: string, type: string, priority: number = 1, projectId?: string): Promise<void> {
    await prisma.jobQueue.create({
      data: {
        jobId,
        type,
        status: 'queued',
        priority,
        projectId,
        lockedBy: null,
        lockedAt: null,
      },
    }).catch(err => {
      console.error(`[JobQueue] enqueue failed: ${err.message}`)
    })
  }

  /** 取下一个任务 (SKIP LOCKED) */
  async dequeue(): Promise<{ id: string; jobId: string; type: string; priority: number; projectId?: string } | null> {
    // 使用原始 SQL 实现 FOR UPDATE SKIP LOCKED
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; job_id: string; type: string; priority: number; project_id: string | null
    }>>(`
      UPDATE job_queue
      SET status = 'running', locked_by = $1, locked_at = NOW()
      WHERE id = (
        SELECT id FROM job_queue
        WHERE status = 'queued'
        ORDER BY priority DESC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, job_id, type, priority, project_id
    `, WORKER_ID)

    if (!rows || rows.length === 0) return null
    const row = rows[0]
    return { id: row.id, jobId: row.job_id, type: row.type, priority: row.priority, projectId: row.project_id || undefined }
  }

  /** 完成任务 */
  async complete(id: string): Promise<void> {
    await prisma.jobQueue.update({
      where: { id },
      data: { status: 'completed', lockedBy: null, lockedAt: null },
    })
  }

  /** 标记失败 */
  async fail(id: string): Promise<void> {
    await prisma.jobQueue.update({
      where: { id },
      data: { status: 'failed', lockedBy: null, lockedAt: null },
    })
  }

  /** 释放锁（失败但可重试） */
  async release(id: string): Promise<void> {
    await prisma.jobQueue.update({
      where: { id },
      data: { status: 'queued', lockedBy: null, lockedAt: null },
    })
  }

  /** 队列大小 */
  async size(): Promise<number> {
    const result = await prisma.jobQueue.count({ where: { status: 'queued' } })
    return result
  }
}

export const jobQueue = new JobQueue()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "worker-registry",
  "mode": "WORKER"
};

