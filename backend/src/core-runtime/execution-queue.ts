// ============================================================================
// 盘古斧 AI OS — Phase 8.2a: Execution Queue (SLA 感知调度队列)
//
// 职责：
//   1. 作为任务缓存层，接收来自 SLA Router 的入队请求
//   2. 按 SLA tier + 入队时间排序出队（高优先出，同优按 FIFO）
//   3. 与 WorkerPool 协同：dequeue 时先 acquire slot，成功才 pop
//   4. 与 StabilizedEventBus 的 backpressure 联动：汇报队列深度
//   5. In-memory 队列（非持久化），Stateless
// ═══ Phase 8.2c: 多租户队列分区 + fair scheduling + noisy neighbor ═══
// ============================================================================

import { workerPool, type SLATier, WORKER_POOL_CONFIGS } from './worker-pool.js'
// ═══ Phase 8.2b: Circuit Breaker + Preemption ═══
import { getBreaker, shouldPreempt } from './immunity/circuit-breaker.js'
// ═══ Phase 8.2c: Tenant Isolation ═══
import { createTenantRuntimeContext } from './tenant-runtime-context.js'
import { canAcquire, acquireExecution, releaseExecution, getActiveCount } from './concurrency-budget.js'
import { detectNoisyTenant, isNoisy } from './noisy-neighbor.js'
import { selectNextTenantQueue } from './fair-scheduler.js'
import type { TenantRuntimeContext } from './tenant-runtime-context.js'

/** 执行任务定义 */
export interface ExecutionTask {
  /** 唯一任务 ID */
  id: string
  /** 租户 ID */
  tenantId: string
  /** SLA 等级 */
  slaTier: SLATier
  /** EventBus 元数据 (dagId / input / seed) */
  dagId: string
  input: Record<string, unknown>
  seed: string
  /** 入队时间 */
  enqueuedAt: number
  /** 重试次数 */
  retryCount: number
}

/** 出队结果 */
export interface DequeueResult {
  task: ExecutionTask
  /** 等待时间 (ms) */
  waitTime: number
  /** Worker Slot */
}

/**
 * SLA 感知优先级队列
 * 
 * 排序规则：
 * 1. 先按 SLA tier priority (SLA_A=1, SLA_B=2, ..., SLA_D=4)
 * 2. 同 tier 内按入队时间 (FIFO)
 * 
 * 在 dequeue() 调用前，external 逻辑 (workerLoop/ scheduler) 需要：
 *   1. 检查 backpressure — 如果系统处于 SATURATION，跳过低优
 *   2. dequeue() 返回最高优先级的可用任务
 *   3. 若 WorkerPool.acquire() 失败，该任务保留在队列中
 */
export class ExecutionQueue {
  private tasks: ExecutionTask[] = []
  private taskCounter = 0

  /** 入队 */
  enqueue(task: Omit<ExecutionTask, 'id' | 'enqueuedAt' | 'retryCount'>): ExecutionTask {
    const fullTask: ExecutionTask = {
      ...task,
      id: `task_${++this.taskCounter}_${Date.now()}`,
      enqueuedAt: Date.now(),
      retryCount: 0,
    }
    this.tasks.push(fullTask)

    // ═══ Phase 8.2c: 也入分区队列 ═══
    if (!tenantQueues[fullTask.tenantId]) {
      tenantQueues[fullTask.tenantId] = []
    }
    tenantQueues[fullTask.tenantId].push(fullTask)

    return fullTask
  }

  /**
   * 出队 — 返回当前最高优先级的可执行任务
   * 
   * ═══ Phase 8.2b: 熔断检查 + 抢占 ═══
   * ═══ Phase 8.2c: Fair scheduler + noisy neighbor check ═══
   * 
   * 策略：
   * 1. 熔断检查：跳过已被熔断的 tier (保留在队列中等待恢复)
   * 2. tenant runtime budget 检查：超过并发预算的 tenant 不取
   * 3. noisy neighbor 检查：对队列过深的 tenant 自动降级
   * 4. 按 SLA priority (高 → 低) 排序
   * 5. 同 priority 内按 enqueuedAt (旧 → 新)
   * 6. 尝试 acquire WorkerPool slot，失败则跳过该任务
   * 
   * @param backpressureTier 当前背压等级
   * @returns DequeueResult | null
   */
  dequeue(backpressureTier: string = 'LIGHT'): DequeueResult | null {
    if (this.tasks.length === 0) return null

    const allowedTiers = this.getAllowedTiers(backpressureTier)

    // ═══ Phase 8.2c: Noisy neighbor 检测 (全局一次性) ═══
    for (const [tenantId, tasks] of Object.entries(tenantQueues)) {
      if (tasks.length === 0) continue
      // 取该 tenant 最近的失败率 (从 sla-metrics 或简化为队列深度指标)
      detectNoisyTenant(tenantId, tasks.length, 0)
    }

    const sorted = [...this.tasks].sort((a, b) => {
      const priA = WORKER_POOL_CONFIGS[a.slaTier].priority
      const priB = WORKER_POOL_CONFIGS[b.slaTier].priority
      if (priA !== priB) return priA - priB
      return a.enqueuedAt - b.enqueuedAt
    })

    for (let i = 0; i < sorted.length; i++) {
      const candidate = sorted[i]
      if (!allowedTiers.includes(candidate.slaTier)) continue

      // ═══ Phase 8.2b: 熔断检查 ═══
      const breaker = getBreaker(candidate.slaTier)
      if (!breaker.canExecute()) continue

      // ═══ Phase 8.2c: tenant 并发预算检查 ═══
      const ctx = getTenantRuntime(candidate.tenantId, candidate.slaTier)
      if (!canAcquire(candidate.tenantId, ctx.concurrencyBudget)) {
        continue // 该 tenant 已达预算上限，跳过此任务
      }

      const slot = workerPool.acquire(candidate.slaTier)
      if (slot === null) continue

      const idx = this.tasks.indexOf(candidate)
      if (idx !== -1) this.tasks.splice(idx, 1)

      // ═══ Phase 8.2c: 标记 tenant 已占用一个预算 ═══
      acquireExecution(candidate.tenantId)

      return {
        task: candidate,
        waitTime: Date.now() - candidate.enqueuedAt,
      }
    }

    return null
  }

  /**
   * Phase 8.2c: Fair Scheduling dequeue — 使用 fair scheduler 选择租户
   *
   * 此方法作为 dequeue() 的替代路由，由 worker loop 调用，
   * 用于防止 noisy neighbor 饿死其他租户。
   * 
   * 策略:
   * 1. 收集所有非空分区队列的快照
   * 2. fair scheduler 选择下一个 tenant
   * 3. 从该 tenant 分区队首取最早的任务
   * 4. 通过 WorkerPool acquire + concurrency budget
   */
  dequeueFair(backpressureTier: string = 'LIGHT'): DequeueResult | null {
    if (this.tasks.length === 0) return null

    const allowedTiers = this.getAllowedTiers(backpressureTier)

    // 构建分区快照
    const snapshots = []
    for (const [tenantId, tasks] of Object.entries(tenantQueues)) {
      if (tasks.length === 0) continue

      // 检查该 tenant 是否有预算
      const firstTask = tasks[0]
      const ctx = getTenantRuntime(tenantId, firstTask.slaTier)

      snapshots.push({
        tenantId,
        depth: tasks.length,
        weight: ctx.queueWeight,
        oldestWaitTime: Date.now() - tasks[0].enqueuedAt,
        isNoisy: isNoisy(tenantId),
      })
    }

    // fair scheduler 选择 tenant
    const selectedTenant = selectNextTenantQueue(snapshots)
    if (!selectedTenant) return null

    // 从选中 tenant 的分区队列中获取最老任务
    const tenantTasks = tenantQueues[selectedTenant]
    const candidate = tenantTasks[0]
    if (!candidate) return null

    // SLA tier 过滤
    if (!allowedTiers.includes(candidate.slaTier)) return null

    // 熔断检查
    const breaker = getBreaker(candidate.slaTier)
    if (!breaker.canExecute()) return null

    // 预算检查
    const ctx = getTenantRuntime(selectedTenant, candidate.slaTier)
    if (!canAcquire(selectedTenant, ctx.concurrencyBudget)) return null

    // WorkerPool slot
    const slot = workerPool.acquire(candidate.slaTier)
    if (slot === null) return null

    // 从分区队列和全局队列移除
    tenantTasks.shift()
    const globalIdx = this.tasks.indexOf(candidate)
    if (globalIdx !== -1) this.tasks.splice(globalIdx, 1)

    // 占用预算
    acquireExecution(selectedTenant)

    return {
      task: candidate,
      waitTime: Date.now() - candidate.enqueuedAt,
    }
  }

  /** 队列当前深度 */
  get length(): number {
    return this.tasks.length
  }

  /** 按 tier 分布 */
  getTierDistribution(): Record<string, number> {
    const dist: Record<string, number> = { SLA_A: 0, SLA_B: 0, SLA_C: 0, SLA_D: 0 }
    for (const t of this.tasks) {
      dist[t.slaTier] = (dist[t.slaTier] || 0) + 1
    }
    return dist
  }

  /** 清空队列 */
  clear(): void {
    this.tasks = []
  }

  /**
   * 根据背压等级决定允许出队的 SLA tier
   * 
   * LIGHT → 全部允许
   * MODERATE → SLA_A/B/C 允许 (D 限流)
   * HEAVY → SLA_A/B 允许 (C/D 限流)
   * SATURATION → 仅 SLA_A 允许
   */
  private getAllowedTiers(tier: string): SLATier[] {
    switch (tier) {
      case 'SATURATION':
        return ['SLA_A']
      case 'HEAVY':
        return ['SLA_A', 'SLA_B']
      case 'MODERATE':
        return ['SLA_A', 'SLA_B', 'SLA_C']
      case 'LIGHT':
      default:
        return ['SLA_A', 'SLA_B', 'SLA_C', 'SLA_D']
    }
  }
}

// ═══ Phase 8.2c: 多租户队列分区 ═══
//
// 在原有的全局单队列 ExecutionQueue 之外，
// 新增 per-tenant 分区队列 + fair scheduler 集成。

/** 按租户分区的队列 (phase 8.2c) */
export type TenantPartitionedQueue = Record<string, ExecutionTask[]>

/** 分区队列存储 */
export const tenantQueues: TenantPartitionedQueue = {}

/** 租户运行上下文缓存 */
export const tenantRuntimeCache: Map<string, TenantRuntimeContext> = new Map()

/**
 * 获取或创建 tenant 的运行时上下文 (带缓存)
 */
export function getTenantRuntime(tenantId: string, slaTier: string): TenantRuntimeContext {
  const cached = tenantRuntimeCache.get(tenantId)
  if (cached) return cached
  const ctx = createTenantRuntimeContext(tenantId, slaTier)
  tenantRuntimeCache.set(tenantId, ctx)
  return ctx
}

/** 全局单例 */
export const executionQueue = new ExecutionQueue()
