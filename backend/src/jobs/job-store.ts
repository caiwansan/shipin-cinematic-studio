/**
 * Job Store v2 — PostgreSQL 持久化存储
 *
 * 替换 memory Map，解决 PM2 cluster 跨进程丢失问题。
 * 写入/查询直接走 DB，不依赖进程内状态。
 */

import { prisma } from '../utils/index.js'

export type JobType = 'showrunner' | 'cognition' | 'director-pipeline'
export type JobStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed'

export interface JobEntry {
  jobId: string
  type: JobType
  status: JobStatus
  progress: number        // 0-100
  currentStage: string
  result: any | null
  error: string | null
  trace: JobTraceEntry[]
  createdAt: number
  updatedAt: number
  metadata: Record<string, any>
}

export interface JobTraceEntry {
  step: string
  status: 'completed' | 'running' | 'failed'
  output?: any
  timestamp: number
}

class JobStore {
  private counter = 0

  create(type: JobType, metadata?: Record<string, any>): string {
    const jobId = `${type}_${Date.now()}_${++this.counter}`
    const now = Date.now()

    // 异步写入，不阻塞调用者
    prisma.job.create({
      data: {
        id: jobId,
        type,
        status: 'queued',
        stage: 'queued',
        progress: 0,
        payload: metadata || {},
        result: {},
        trace: [],
        error: null,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      },
    }).catch(err => {
      console.error(`[JobStore] DB create failed for ${jobId}:`, err.message)
    })

    return jobId
  }

  async get(jobId: string): Promise<JobEntry | null> {
    const row = await prisma.job.findUnique({ where: { id: jobId } })
    if (!row) return null
    return this.rowToEntry(row)
  }

  async update(jobId: string, patch: Partial<JobEntry>): Promise<boolean> {
    const data: any = {}
    if (patch.status !== undefined) data.status = patch.status
    if (patch.currentStage !== undefined) data.stage = patch.currentStage
    if (patch.progress !== undefined) data.progress = patch.progress
    if (patch.result !== undefined) data.result = patch.result
    if (patch.error !== undefined) data.error = patch.error
    if (patch.trace !== undefined) data.trace = patch.trace
    if (patch.metadata !== undefined) data.payload = patch.metadata
    data.updatedAt = new Date()

    try {
      await prisma.job.update({ where: { id: jobId }, data })
      return true
    } catch (err: any) {
      console.error(`[JobStore] DB update failed for ${jobId}:`, err.message)
      return false
    }
  }

  async addTrace(jobId: string, entry: JobTraceEntry): Promise<boolean> {
    try {
      const row = await prisma.job.findUnique({ where: { id: jobId }, select: { trace: true } })
      if (!row) return false
      const trace = (row.trace as unknown as JobTraceEntry[]) || []
      trace.push(entry)
      await prisma.job.update({
        where: { id: jobId },
        data: { trace: JSON.parse(JSON.stringify(trace)), updatedAt: new Date() },
      })
      return true
    } catch (err: any) {
      console.error(`[JobStore] addTrace failed for ${jobId}:`, err.message)
      return false
    }
  }

  async setProgress(jobId: string, progress: number, stage: string): Promise<boolean> {
    return this.update(jobId, { progress, currentStage: stage })
  }

  async complete(jobId: string, result: any): Promise<boolean> {
    return this.update(jobId, { status: 'completed', result, progress: 100, currentStage: 'completed' })
  }

  async fail(jobId: string, error: string): Promise<boolean> {
    return this.update(jobId, { status: 'failed', error, currentStage: 'failed' })
  }

  async listByProject(projectId: string): Promise<JobEntry[]> {
    const rows = await prisma.job.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return rows.map(r => this.rowToEntry(r))
  }

  private counterLocal = 0
  private nextCounter(): number {
    return Date.now() % 100000 + (++this.counterLocal)
  }

  private rowToEntry(row: any): JobEntry {
    return {
      jobId: row.id,
      type: row.type as JobType,
      status: row.status as JobStatus,
      progress: row.progress,
      currentStage: row.stage,
      result: row.result,
      error: row.error,
      trace: (row.trace as JobTraceEntry[]) || [],
      createdAt: new Date(row.createdAt).getTime(),
      updatedAt: new Date(row.updatedAt).getTime(),
      metadata: (row.payload as Record<string, any>) || {},
    }
  }
}

export const jobStore = new JobStore()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "worker-registry",
  "mode": "WORKER"
};

