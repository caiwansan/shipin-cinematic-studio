/**
 * Pipeline Aggregation Engine
 *
 * 从 Job 状态 → Stage 状态的核心映射层。
 * 这是系统"状态学"的中枢——定义什么是 done、partial、failed。
 *
 * 核心职责：
 *   1. 根据 stage 下所有 job 的状态聚合出 stage 状态
 *   2. 在 job 完成/失败时自动触发聚合
 *   3. 记录状态变更事件（Event Stream）
 *   4. 提供查询接口（某 stage 的 job 完成情况统计）
 */

import { prisma } from '../utils/index.js'
import { recalcBlockedStages } from './dag-runtime.js'

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

export type StageStatus = 'blocked' | 'ready' | 'running' | 'partial' | 'done' | 'failed'
export type JobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface JobSummary {
  total: number
  done: number
  failed: number
  running: number
  pending: number
}

// ══════════════════════════════════════════════════════════
// Aggregation Rules
// ══════════════════════════════════════════════════════════

/**
 * 聚合核心：根据 stage 下所有 job 的状态，计算 stage 应处于什么状态。
 *
 * 规则表：
 * ┌─────────────────┬─────────────────────────────────────┐
 * │ 条件            │ 结果                                │
 * ├─────────────────┼─────────────────────────────────────┤
 * │ 无 jobs         │ 取决于 DAG（blocked / ready）        │
 * │ 全部 done       │ done                                │
 * │ 全部 failed     │ failed                              │
 * │ 有 running      │ running（有任务正在执行）            │
 * │ 混合 done/failed│ partial（部分失败，部分成功）        │
 * │ 仅有 pending    │ running（已创建但还没开始执行）     │
 * └─────────────────┴─────────────────────────────────────┘
 */
function aggregateStageStatus(summary: JobSummary): StageStatus {
  if (summary.total === 0) return 'ready' // 无 jobs = 初始状态

  if (summary.done === summary.total) return 'done'
  if (summary.failed === summary.total) return 'failed'
  if (summary.running > 0) return 'running'
  if (summary.pending > 0 && summary.done > 0) return 'running'
  if (summary.done > 0 && summary.failed > 0) return 'partial'
  if (summary.pending > 0) return 'running'

  return 'ready'
}

/**
 * 计算 stage 的完成进度（百分比）
 */
function aggregateProgress(summary: JobSummary): number {
  if (summary.total === 0) return 0
  return Math.round((summary.done / summary.total) * 100)
}

// ══════════════════════════════════════════════════════════
// Event Logging
// ══════════════════════════════════════════════════════════

/**
 * 记录状态变更事件。
 * 这是 Event Stream 的最小化实现——直接写到 pipeline_jobs 的 result JSON 中。
 * 未来可以抽成独立表。
 */
async function logJobEvent(jobId: string, event: string, detail?: any) {
  try {
    const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
    if (!job) return

    const events = (job.result as any)?.events || []
    events.push({
      event,
      detail,
      timestamp: new Date().toISOString(),
    })

    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: {
        result: {
          ...(job.result as any || {}),
          events,
        },
      },
    })
  } catch (e) {
    console.warn('[Aggregation] Failed to log event:', e)
  }
}

// ══════════════════════════════════════════════════════════
// Main Aggregation API
// ══════════════════════════════════════════════════════════

/**
 * 获取 stage 下所有 job 的统计摘要
 */
export async function getJobSummary(projectId: string, stageKey: string): Promise<JobSummary> {
  const stats = await prisma.pipelineJob.groupBy({
    by: ['status'],
    where: { projectId, stageKey },
    _count: { id: true },
  })

  const summary: JobSummary = { total: 0, done: 0, failed: 0, running: 0, pending: 0 }
  for (const s of stats) {
    const status = s.status as JobStatus
    summary[status] = s._count.id
    summary.total += s._count.id
  }

  return summary
}

/**
 * 聚合单个 stage —— 让 stage 状态由 job 状态决定。
 * 在 job 完成或失败时自动调用。
 */
export async function aggregateStage(projectId: string, stageKey: string): Promise<{
  prevStatus: string | null
  newStatus: string
  summary: JobSummary
  progress: number
}> {
  const stage = await prisma.pipelineStage.findUnique({
    where: { projectId_stageKey: { projectId, stageKey } },
  })
  const prevStatus = stage?.status || 'pending'

  const summary = await getJobSummary(projectId, stageKey)
  const newStatus = aggregateStageStatus(summary)
  const progress = aggregateProgress(summary)

  await prisma.pipelineStage.upsert({
    where: { projectId_stageKey: { projectId, stageKey } },
    create: {
      projectId,
      stageKey,
      status: newStatus,
      inputData: { progress },
    },
    update: {
      status: newStatus,
      inputData: { progress },
      ...(newStatus === 'done' ? { completedAt: new Date() } : {}),
    },
  })

  return { prevStatus, newStatus, summary, progress }
}

/**
 * Job 完成后的处理链：
 *   1. 标记 job done
 *   2. 记录事件
 *   3. 聚合 stage 状态
 *   4. 如果 stage 状态变化，更新 DAG 下游阻塞
 */
export async function onJobCompleted(jobId: string, result: any) {
  const job = await prisma.pipelineJob.update({
    where: { id: jobId },
    data: {
      status: 'done',
      result,
      completedAt: new Date(),
      lockedBy: null,
      lockedAt: null,
    },
  })

  await logJobEvent(jobId, 'completed', { result })

  // 聚合 stage
  const agg = await aggregateStage(job.projectId, job.stageKey)
  console.log(`[Aggregation] Job ${jobId.slice(0, 8)} done → stage ${job.stageKey}: ${agg.prevStatus} → ${agg.newStatus} (${agg.progress}%)`)

  // 如果 stage 状态变化，重新计算 DAG
  if (agg.prevStatus !== agg.newStatus) {
    await recalcBlockedStages(job.projectId)
  }

  return { job, aggregation: agg }
}

/**
 * Job 失败后的处理链：
 *   1. 检查重试次数，决定 retry 或永久失败
 *   2. 记录事件
 *   3. 聚合 stage 状态，可能导致 partial
 *   4. 更新 DAG 下游
 */
export async function onJobFailed(jobId: string, error: string) {
  const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
  if (!job) return null

  // attempts 由 pollJob 在锁定时自增
  const attempts = job.attempts

  if (attempts < job.maxAttempts) {
    // 释放锁，等待重试
    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: {
        status: 'pending',
        error,
        lockedBy: null,
        lockedAt: null,
      },
    })
    await logJobEvent(jobId, 'retry', { error, attempt: attempts })
  } else {
    // 超过最大重试次数 → 标记为永久失败
    await prisma.pipelineJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    })
    await logJobEvent(jobId, 'failed', { error, final: true })

    // 聚合 stage
    const agg = await aggregateStage(job.projectId, job.stageKey)
    console.log(`[Aggregation] Job ${jobId.slice(0, 8)} failed → stage ${job.stageKey}: ${agg.prevStatus} → ${agg.newStatus}`)

    // 更新 DAG
    if (agg.prevStatus !== agg.newStatus) {
      await recalcBlockedStages(job.projectId)
    }
  }

  return { job, error, attempts, maxRetryReached: attempts >= job.maxAttempts }
}

/**
 * 获取 stage 的详细状态报告（含进度、job 列表）
 */
export async function getStageReport(projectId: string, stageKey: string) {
  const stage = await prisma.pipelineStage.findUnique({
    where: { projectId_stageKey: { projectId, stageKey } },
  })
  const summary = await getJobSummary(projectId, stageKey)
  const progress = aggregateProgress(summary)

  const jobs = await prisma.pipelineJob.findMany({
    where: { projectId, stageKey },
    orderBy: [{ priority: 'desc' }, { sortKey: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      status: true,
      jobType: true,
      payload: true,
      result: true,
      error: true,
      attempts: true,
      sortKey: true,
      priority: true,
      createdAt: true,
      completedAt: true,
    },
  })

  return {
    stage,
    status: stage?.status || 'pending',
    progress,
    summary,
    jobs,
  }
}

// ══════════════════════════════════════════════════════════
// Route 注册（在 pipeline.ts 中调用）
// ══════════════════════════════════════════════════════════

export function getAggregationRoutes() {
  return {
    aggregateStage,
    onJobCompleted,
    onJobFailed,
    getStageReport,
    getJobSummary,
    aggregateStageStatus,
    aggregateProgress,
  }
}
