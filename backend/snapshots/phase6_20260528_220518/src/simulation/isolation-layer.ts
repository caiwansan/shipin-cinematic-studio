/**
 * Phase 6C-3.1 — Simulation Isolation Layer
 *
 * 核心目标：模拟流量完全不污染生产系统状态。
 *
 * 三个隔离维度：
 *   ① DB 隔离 — simulation 数据写独立的 simulation_* 表（不走 production 的 VideoTask 等）
 *   ② Queue 隔离 — 模拟任务独立排队，不抢 production worker slot
 *   ③ Worker 隔离 — simulation 有独立的 mock worker，不占用真实 worker 资源
 *
 * 设计原则：
 *   - Simulation Bridge 不再调真实 /api/projects/:id/tasks
 *   - 改为调 Isolation Layer 的 /api/sim-isolation/tasks
 *   - 所有 simulation task 数据写 simulation_tasks 表（DB 里是独立的）
 *   - 队列用内存级 local queue（不是 BullMQ，因为没有持久化要求）
 */

import { emitEvent } from '../services/observability.service.js'
import { prisma } from '../utils/index.js'
import { timerRegistry } from '../services/lifecycle-manager.js'

// ============================================================
// Simulation-Only Tables（通过 raw SQL 操作，不侵入 Prisma schema）
// ============================================================

/**
 * 创建隔离表（幂等）
 * 这些表只在 simulation 活动中存在，测试结束后可随意 DROP。
 */
export async function ensureIsolationTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS simulation_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL DEFAULT 'simulation',
      task_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      priority INTEGER NOT NULL DEFAULT 3,
      payload JSONB DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'simulation',
      user_model TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      error TEXT,
      duration_ms INTEGER DEFAULT 0
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS simulation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES simulation_tasks(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS simulation_costs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID REFERENCES simulation_tasks(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
      actual_cost DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // 索引
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sim_tasks_status ON simulation_tasks(status)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sim_tasks_created ON simulation_tasks(created_at DESC)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sim_logs_task ON simulation_logs(task_id)`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_sim_costs_task ON simulation_costs(task_id)`)

  console.log('[Isolation] Simulation isolation tables ready')
}

/**
 * 删除隔离表（测试结束后清理）
 */
export async function dropIsolationTables() {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS simulation_costs CASCADE`)
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS simulation_logs CASCADE`)
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS simulation_tasks CASCADE`)
  console.log('[Isolation] Simulation isolation tables dropped')
}

// ============================================================
// Simulation 任务操作（不碰任何 production 表！）
// ============================================================

interface SimTask {
  id: string
  taskType: string
  status: string
  priority: number
  payload: any
  userModel?: string
  createdAt: Date
}

/**
 * 创建模拟任务（只写 simulation_tasks 表）
 */
export async function createSimTask(params: {
  taskType: string
  priority?: number
  payload?: any
  userModel?: string
}): Promise<SimTask> {
  const result = await prisma.$queryRawUnsafe<SimTask[]>(`
    INSERT INTO simulation_tasks (task_type, status, priority, payload, source, user_model)
    VALUES ($1, 'queued', $2, $3::jsonb, 'simulation', $4)
    RETURNING id, task_type as "taskType", status, priority, payload, user_model as "userModel", created_at as "createdAt"
  `, params.taskType, params.priority ?? 3, JSON.stringify(params.payload ?? {}), params.userModel ?? null)

  return result[0]
}

/**
 * 批量创建模拟任务（spam_submit 优化）
 */
export async function bulkCreateSimTasks(count: number, params: {
  taskType: string
  priority?: number
  payload?: any
}): Promise<number> {
  let created = 0
  for (let i = 0; i < count; i++) {
    try {
      await createSimTask({
        taskType: params.taskType,
        priority: params.priority,
        payload: params.payload,
      })
      created++
    } catch {
      // skip individual failures
    }
  }
  return created
}

/**
 * 取消模拟任务
 */
export async function cancelSimTask(taskId: string): Promise<boolean> {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE simulation_tasks SET status = 'cancelled', updated_at = NOW()
    WHERE id = $1::uuid AND status = 'queued'
  `, taskId)

  await logSimEvent(taskId, 'cancelled', { reason: 'user_cancelled' })
  return result > 0
}

/**
 * 获取模拟任务状态统计
 */
export async function getSimTaskStats() {
  const rows = await prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(`
    SELECT status, COUNT(*)::int as count FROM simulation_tasks GROUP BY status ORDER BY status
  `)
  const total = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::int as count FROM simulation_tasks
  `)
  return {
    total: Number(total[0]?.count ?? 0),
    byStatus: Object.fromEntries(rows.map(r => [r.status, Number(r.count)])),
  }
}

/**
 * 记录模拟事件日志
 */
async function logSimEvent(taskId: string, event: string, data?: any) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO simulation_logs (task_id, event, data)
    VALUES ($1::uuid, $2, $3::jsonb)
  `, taskId, event, JSON.stringify(data ?? {}))
}

/**
 * 记录模拟成本
 */
export async function logSimCost(params: {
  taskId: string
  model: string
  estimatedCost: number
  actualCost?: number
}) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO simulation_costs (task_id, model, estimated_cost, actual_cost)
    VALUES ($1::uuid, $2, $3, $4)
  `, params.taskId, params.model, params.estimatedCost, params.actualCost ?? params.estimatedCost)
}

/**
 * 获取模拟总成本
 */
export async function getSimCostTotal(): Promise<number> {
  const result = await prisma.$queryRawUnsafe<{ total: number }[]>(`
    SELECT COALESCE(SUM(estimated_cost), 0)::float as total FROM simulation_costs
  `)
  return result[0]?.total ?? 0
}

// ============================================================
// Simulation Worker（内存级 mock worker）
// ============================================================

const simWorkerState = {
  running: false,
  processingCount: 0,
  totalProcessed: 0,
  queue: [] as { taskId: string; taskType: string }[],
  timer: null as ReturnType<typeof setInterval> | null,
  concurrency: 3, // 模拟 worker 并发数
  processTimeMs: 500, // 模拟任务处理时间
  failRate: 0.15, // 模拟失败率
}

/**
 * 启动 Simulation Worker（独立于 production Worker Pool）
 */
export function startSimWorker(opts?: { concurrency?: number; processTimeMs?: number; failRate?: number }) {
  if (simWorkerState.running) return

  if (opts?.concurrency) simWorkerState.concurrency = opts.concurrency
  if (opts?.processTimeMs) simWorkerState.processTimeMs = opts.processTimeMs
  if (opts?.failRate !== undefined) simWorkerState.failRate = opts.failRate

  simWorkerState.running = true

  // 从 simulation_tasks 拉取 queued 任务（不碰 production）
  simWorkerState.timer = timerRegistry.setInterval(async () => {
    if (!simWorkerState.running) return
    if (simWorkerState.processingCount >= simWorkerState.concurrency) return

    try {
      const tasks = await prisma.$queryRawUnsafe<{ id: string; task_type: string }[]>(`
        SELECT id, task_type FROM simulation_tasks
        WHERE status = 'queued'
        ORDER BY priority ASC, created_at ASC
        LIMIT ${simWorkerState.concurrency - simWorkerState.processingCount}
        FOR UPDATE SKIP LOCKED
      `)

      for (const task of tasks) {
        simWorkerState.processingCount++
        simWorkerState.totalProcessed++

        // 异步处理（模拟执行）
        processSimTask(task.id, task.task_type).catch((err) => {
          console.error('[Isolation] Worker task error:', err)
          simWorkerState.processingCount--
        })
      }
    } catch (err) {
      // 表不存在时忽略
    }
  }, 200) // 每 200ms poll 一次

  emitEvent('simulation.isolation.worker_started', {
    concurrency: simWorkerState.concurrency,
    processTimeMs: simWorkerState.processTimeMs,
    failRate: simWorkerState.failRate,
  })

  console.log(`[Isolation] Simulation worker started: concurrency=${simWorkerState.concurrency} process=${simWorkerState.processTimeMs}ms`)
}

async function processSimTask(taskId: string, taskType: string) {
  const startTime = Date.now()

  // 模拟处理延迟
  await new Promise(resolve => setTimeout(resolve, simWorkerState.processTimeMs))

  const shouldFail = Math.random() < simWorkerState.failRate
  const duration = Date.now() - startTime

  if (shouldFail) {
    await prisma.$executeRawUnsafe(`
      UPDATE simulation_tasks SET status = 'failed', error = 'Simulated failure', duration_ms = $2, updated_at = NOW()
      WHERE id = $1::uuid
    `, taskId, duration)

    await logSimEvent(taskId, 'failed', { error: 'Simulated failure', taskType })
  } else {
    await prisma.$executeRawUnsafe(`
      UPDATE simulation_tasks SET status = 'completed', duration_ms = $2, completed_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid
    `, taskId, duration)

    await logSimEvent(taskId, 'completed', { taskType, duration })

    // 模拟成本记录
    const cost = taskType === 'video_gen' ? 0.008 : 0.004
    await logSimCost({ taskId, model: taskType, estimatedCost: cost })
  }
}

/**
 * 停止 Simulation Worker
 */
export function stopSimWorker() {
  simWorkerState.running = false
  if (simWorkerState.timer) {
    timerRegistry.clearInterval(simWorkerState.timer)
    simWorkerState.timer = null
  }
  console.log('[Isolation] Simulation worker stopped')
}

export function getSimWorkerState() {
  return { ...simWorkerState, timer: !!simWorkerState.timer }
}
