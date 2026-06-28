import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Pipeline Job Queue v0
 *
 * DB-backed job queue，直接使用 pipeline_jobs 表。
 * 不依赖 Redis / BullMQ / Kafka。
 *
 * 核心操作：
 *   createJob  — Graph Runtime 判定某 stage 可执行后创建 job(s)
 *   pollJob    — Worker 轮询获取下一个可执行 job（带 SKIP LOCKED）
 *   completeJob — 更新 job 结果
 *   failJob    — 标记失败（支持重试）
 *
 * 规则：
 *   - 每个 job 最多重试 3 次
 *   - 用 `lockedBy` + `lockedAt` 实现 Worker 锁（30秒超时自动释放）
 *   - 同一 stage 内按 priority DESC, sortKey ASC 排序执行
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { onJobCompleted, onJobFailed, getJobSummary, aggregateStage, getStageReport } from '../services/aggregation-engine.js'

const LOCK_TIMEOUT_MS = 30000  // 30秒锁超时

// ─── 创建 job ───

async function createJob(data: {
  projectId: string
  stageKey: string
  jobType: string
  payload?: any
  sortKey?: number
  priority?: number
  maxAttempts?: number
}) {
  return prisma.pipelineJob.create({
    data: {
      projectId: data.projectId,
      stageKey: data.stageKey,
      jobType: data.jobType,
      status: 'pending',
      payload: data.payload || undefined,
      sortKey: data.sortKey,
      priority: data.priority ?? 0,
      maxAttempts: data.maxAttempts ?? 3,
    },
  })
}

// ─── 轮询下一个可执行 job（Worker 端调用） ───

async function pollJob(workerId: string, jobType?: string) {
  const now = new Date()

  // 清理超时锁：超过 30 秒未完成的 job 释放锁
  await prisma.pipelineJob.updateMany({
    where: {
      status: 'running',
      lockedBy: { not: null },
      lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) },
    },
    data: {
      status: 'pending',
      lockedBy: null,
      lockedAt: null,
    },
  })

  // 用 raw SQL 实现 SKIP LOCKED（Prisma 不支持直接 SKIP LOCKED）
  const whereClause = jobType
    ? `WHERE status = 'pending' AND job_type = $1`
    : `WHERE status = 'pending'`

  const params = jobType ? [jobType] : []

  // 使用 subquery update + returning 的 MySQL 兼容写法
  // 先通过 subquery 找到可执行的 job ID（已排序）
  let job: any = null
  try {
    const result = await prisma.$queryRawUnsafe<Array<{
      id: string; project_id: string; stage_key: string; job_type: string
      status: string; payload: any; sort_key: number | null; priority: number
      attempts: number; maxAttempts: number; error: string | null
    }>>(
      `SELECT id, project_id, stage_key, job_type, status, payload, sort_key, priority, attempts, "maxAttempts", error
       FROM pipeline_jobs
       ${whereClause}
       ORDER BY priority DESC, sort_key ASC, created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      ...params
    )
    if (result.length > 0) {
      job = result[0]
      // 锁定 job
      await prisma.pipelineJob.update({
        where: { id: job.id },
        data: { status: 'running', lockedBy: workerId, lockedAt: now, startedAt: now, attempts: { increment: 1 } },
      })
    }
  } catch (e) {
    // SKIP LOCKED 可能在非事务中失败，回退到简单模式
    console.warn('[PipelineJob] SKIP LOCKED failed, falling back:', e)
    const fallback = await prisma.pipelineJob.findFirst({
      where: { status: 'pending', ...(jobType ? { jobType } : {}) },
      orderBy: [{ priority: 'desc' }, { sortKey: 'asc' }, { createdAt: 'asc' }],
    })
    if (fallback) {
      job = fallback
      await prisma.pipelineJob.update({
        where: { id: job.id },
        data: { status: 'running', lockedBy: workerId, lockedAt: now, startedAt: now, attempts: { increment: 1 } },
      })
    }
  }

  return job
}

// ─── 完成 job ───

async function completeJob(jobId: string, result: any) {
  return prisma.pipelineJob.update({
    where: { id: jobId },
    data: {
      status: 'done',
      result,
      completedAt: new Date(),
      lockedBy: null,
      lockedAt: null,
    },
  })
}

// ─── 标记失败 ───

async function failJob(jobId: string, error: string) {
  const job = await prisma.pipelineJob.findUnique({ where: { id: jobId } })
  if (!job) return null

  if (job.attempts >= job.maxAttempts) {
    // 超过最大重试次数 → 标记为失败
    return prisma.pipelineJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    })
  } else {
    // 释放锁，等待下次重试
    return prisma.pipelineJob.update({
      where: { id: jobId },
      data: {
        status: 'pending',
        error,
        lockedBy: null,
        lockedAt: null,
      },
    })
  }
}

// ─── 按 stage 查询所有 job ───

async function getStageJobs(projectId: string, stageKey?: string) {
  return prisma.pipelineJob.findMany({
    where: {
      projectId,
      ...(stageKey ? { stageKey } : {}),
    },
    orderBy: [{ priority: 'desc' }, { sortKey: 'asc' }, { createdAt: 'asc' }],
  })
}

// ════════════════════════════════════════════════════════════
// Routes
// ════════════════════════════════════════════════════════════

export default async function pipelineJobRoutes(fastify: FastifyInstance) {

  // ── GET /api/pipeline/jobs/:projectId — 查询项目 job 列表
  fastify.get('/api/pipeline/jobs/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const query = request.query as { stageKey?: string }
    const jobs = await getStageJobs(projectId, query.stageKey)
    return { success: true, data: jobs } satisfies ApiResponse<unknown>;

  })

  // ── POST /api/pipeline/jobs/create — 创建 job
  fastify.post('/api/pipeline/jobs/create', async (request, reply) => {
    const { projectId, stageKey, jobType, payload, sortKey, priority, maxAttempts } = request.body as any
    if (!projectId || !stageKey || !jobType) {
      return reply.status(400).send({ success: false, error: 'projectId, stageKey, jobType required' })
    }
    const job = await createJob({ projectId, stageKey, jobType, payload, sortKey, priority, maxAttempts })
    return { success: true, data: job } satisfies ApiResponse<unknown>;

  })

  // ── POST /api/pipeline/jobs/poll — Worker 轮询 job
  fastify.post('/api/pipeline/jobs/poll', async (request, reply) => {
    const { workerId, jobType } = request.body as any
    if (!workerId) return reply.status(400).send({ success: false, error: 'workerId required' })
    const job = await pollJob(workerId, jobType)
    return { success: true, data: job } satisfies ApiResponse<unknown>;

  })

  // ── POST /api/pipeline/jobs/:id/complete — 完成 job（走 Aggregation Engine）
  fastify.post('/api/pipeline/jobs/:id/complete', async (request, reply) => {
    const { id } = request.params as any
    const { result } = request.body as any
    if (!id) return reply.status(400).send({ success: false, error: 'id required' })
    const job = await onJobCompleted(id, result || {})
    return { success: true, data: job } satisfies ApiResponse<unknown>;

  })

  // ── POST /api/pipeline/jobs/:id/fail — 标记失败（走 Aggregation Engine）
  fastify.post('/api/pipeline/jobs/:id/fail', async (request, reply) => {
    const { id } = request.params as any
    const { error } = request.body as any
    if (!id) return reply.status(400).send({ success: false, error: 'id required' })
    const result = await onJobFailed(id, error || 'unknown error')
    return { success: true, data: result } satisfies ApiResponse<unknown>;

  })

  // ── POST /api/pipeline/jobs/batch — 批量创建 job（给 generateAll 用）
  fastify.post('/api/pipeline/jobs/batch', async (request, reply) => {
    const { projectId, stageKey, jobType, items } = request.body as any
    if (!projectId || !stageKey || !jobType || !Array.isArray(items)) {
      return reply.status(400).send({ success: false, error: 'projectId, stageKey, jobType, items[] required' })
    }

    const created = await prisma.$transaction(
      items.map((item: any, i: number) =>
        prisma.pipelineJob.create({
          data: {
            projectId,
            stageKey,
            jobType,
            status: 'pending',
            payload: item.payload || {},
            sortKey: item.sortKey ?? i,
            priority: item.priority ?? 0,
            maxAttempts: item.maxAttempts ?? 3,
          },
        })
      )
    )
    return { success: true, data: created } satisfies ApiResponse<unknown>;

  })

  // ── GET /api/pipeline/jobs/stats/:projectId — 项目 job 统计
  fastify.get('/api/pipeline/jobs/stats/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const stats = await prisma.pipelineJob.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    })
    const total = stats.reduce((sum, s) => sum + s._count.id, 0)
    const result: Record<string, number> = { total }
    for (const s of stats) {
      result[s.status] = s._count.id
    }
    return { success: true, data: result } satisfies ApiResponse<unknown>;

  })

  // ── GET /api/pipeline/stage-report/:projectId/:stageKey — Stage 聚合报告
  fastify.get('/api/pipeline/stage-report/:projectId/:stageKey', async (request, reply) => {
    const { projectId, stageKey } = request.params as any
    const report = await getStageReport(projectId, stageKey)
    return { success: true, data: report } satisfies ApiResponse<unknown>;

  })

  // ── POST /api/pipeline/aggregate/:projectId/:stageKey — 手动触发 stage 聚合
  fastify.post('/api/pipeline/aggregate/:projectId/:stageKey', async (request, reply) => {
    const { projectId, stageKey } = request.params as any
    const result = await aggregateStage(projectId, stageKey)
    return { success: true, data: result } satisfies ApiResponse<unknown>;

  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

