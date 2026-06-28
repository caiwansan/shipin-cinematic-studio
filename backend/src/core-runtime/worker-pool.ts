// ============================================================================
// 盘古斧 AI OS — Phase 8.2a: Worker Pool (SLA Tier 分级执行层)
//
// 职责：
//   1. 定义 SLA_A/B/C/D 四级 Worker Pool (concurrency + timeout + priority)
//   2. 提供 acquire() / release() 接口，供 ExecutionQueue 消费时获取 Worker Slot
//   3. 不直接执行任务 → 由 StabilizedEventBus 的 DAG executor 消费
//   4. Stateless: 不保存任务状态，只做并发控制
// ============================================================================

// ═══ Phase 8.2b: Circuit Breaker injection ═══
import { getBreaker } from './immunity/circuit-breaker.js'

export type SLATier = 'SLA_A' | 'SLA_B' | 'SLA_C' | 'SLA_D'

/** Worker Pool 配置 — 每个 SLA tier 的物理资源分配 */
export interface WorkerPoolConfig {
  /** 最大并发 Worker 数 */
  concurrency: number
  /** 执行超时 (ms) */
  timeout: number
  /** 优先级 (1=最高, 4=最低) */
  priority: number
  /** Pool 描述 */
  label: string
  /** 最大队列深度 (超过此值触发 backpressure) */
  maxQueueDepth: number
}

export const WORKER_POOL_CONFIGS: Record<SLATier, WorkerPoolConfig> = {
  SLA_A: {
    concurrency: 50,
    timeout: 5_000,
    priority: 1,
    label: 'Critical / 高并发 SLA',
    maxQueueDepth: 200,
  },
  SLA_B: {
    concurrency: 30,
    timeout: 8_000,
    priority: 2,
    label: 'Business / 标准 SLA',
    maxQueueDepth: 300,
  },
  SLA_C: {
    concurrency: 15,
    timeout: 15_000,
    priority: 3,
    label: 'Standard / 默认 SLA',
    maxQueueDepth: 500,
  },
  SLA_D: {
    concurrency: 5,
    timeout: 30_000,
    priority: 4,
    label: 'Best Effort / 尽力型',
    maxQueueDepth: 800,
  },
}

/** Worker Slot Token — acquire() 时获取，release() 时归还 */
export interface WorkerSlot {
  tier: SLATier
  slotId: number
  acquiredAt: number
}

/**
 * Worker Pool — 按 SLA tier 管理并发槽位
 * 
 * 核心设计原则：
 * - acquire(tier) → 有空槽立即返回 slot，无空槽返回 null（不阻塞）
 * - release(slot) → 归还槽位
 * - 调用方 (ExecutionQueue / Worker Loop) 必须自行处理 null（排队或降级）
 */
export class WorkerPool {
  /** 每个 tier 的当前活跃 slot 数 */
  private activeSlots: Record<SLATier, Set<number>>
  /** 每个 tier 的槽位计数器 (用于生成 slotId) */
  private slotCounters: Record<SLATier, number>

  constructor() {
    const tiers: SLATier[] = ['SLA_A', 'SLA_B', 'SLA_C', 'SLA_D']
    this.activeSlots = {} as Record<SLATier, Set<number>>
    this.slotCounters = {} as Record<SLATier, number>
    for (const tier of tiers) {
      this.activeSlots[tier] = new Set()
      this.slotCounters[tier] = 0
    }
  }

  /** 尝试获取一个 Worker Slot。返回 null 表示所有槽位已满 */
  acquire(tier: SLATier): WorkerSlot | null {
    const config = WORKER_POOL_CONFIGS[tier]
    const active = this.activeSlots[tier]

    // ═══ Phase 8.2b: Circuit Breaker check ═══
    const breaker = getBreaker(tier)
    if (!breaker.canExecute()) {
      breaker.degradationCount++
      return null
    }

    // SLA_A 超配: 利用 SLA_D 闲置 slot, 最多 120%
    const effectiveLimit = (tier === 'SLA_A' && this.activeSlots['SLA_D'].size > 0)
      ? Math.floor(config.concurrency * 1.2)
      : config.concurrency

    if (active.size >= effectiveLimit) {
      return null
    }

    const slotId = ++this.slotCounters[tier]
    active.add(slotId)
    return { tier, slotId, acquiredAt: Date.now() }
  }

  /** 归还 Worker Slot */
  release(slot: WorkerSlot): void {
    this.activeSlots[slot.tier].delete(slot.slotId)
  }

  /** 获取指定 tier 的活跃数 */
  activeCount(tier: SLATier): number {
    return this.activeSlots[tier].size
  }

  /** 获取指定 tier 的配额 */
  maxConcurrency(tier: SLATier): number {
    return WORKER_POOL_CONFIGS[tier].concurrency
  }

  /** 获取全系统活跃总览 */
  getStatus(): Record<SLATier, { active: number; max: number; utilization: number }> {
    const tiers: SLATier[] = ['SLA_A', 'SLA_B', 'SLA_C', 'SLA_D']
    const status: any = {}
    for (const tier of tiers) {
      const active = this.activeSlots[tier].size
      const max = WORKER_POOL_CONFIGS[tier].concurrency
      status[tier] = {
        active,
        max,
        utilization: max > 0 ? Math.round((active / max) * 100) : 0,
      }
    }
    return status
  }
}

/** 全局单例 Worker Pool */
export const workerPool = new WorkerPool()
