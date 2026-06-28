// ============================================================================
// 盘古斧 AI OS — Phase 8.2a: SLA Router (租户 → Worker Pool 映射层)
//
// 职责：
//   1. 将 tenant.slaTier 映射到对应的 Worker Pool 配置
//   2. 将 tenant 的请求转换为 ExecutionTask，入队到 ExecutionQueue
//   3. Stateless: 不保存任何运行时状态，纯映射函数
//   4. 结合 Contract Hook：验证通过后才路由到 queue
// ============================================================================

import { type SLATier, WORKER_POOL_CONFIGS, type WorkerPoolConfig } from './worker-pool.js'
import { type ExecutionTask, executionQueue } from './execution-queue.js'

/** 路由结果：告知调用方 (API gateway) 任务被路由到哪个 tier */
export interface RouteResult {
  queued: boolean
  slaTier: SLATier
  poolConfig: WorkerPoolConfig
  queueDepth: number
  task?: ExecutionTask
  reason?: string
}

/** SLA 级别映射表 */
const TIER_ORDER: SLATier[] = ['SLA_A', 'SLA_B', 'SLA_C', 'SLA_D']

/**
 * 将 tenant + 请求路由到对应的 Worker Pool
 * 
 * 此函数是整个调度系统的入口：
 *   1. 解析 tenant.slaTier
 *   2. 检查队列深度是否超过该 tier 的 maxQueueDepth
 *   3. 若超限 → 降级 (SLA_A→B→C→D→reject)
 *   4. 若未超限 → 入队
 * 
 * @param tenantId  租户 ID
 * @param slaTier   SLA 等级 (来自 JWT)
 * @param dagId     DAG ID
 * @param input     执行输入
 * @param seed      确定性种子
 * @param backpressureTier 当前背压等级 (来自 StabilizedEventBus)
 * @returns RouteResult
 */
export function routeToWorkerPool(
  tenantId: string,
  slaTier: string,
  dagId: string,
  input: Record<string, unknown>,
  seed: string,
  backpressureTier: string = 'LIGHT',
): RouteResult {
  // 1. 解析 SLA tier
  const tier = parseSLATier(slaTier)
  if (!tier) {
    return {
      queued: false,
      slaTier: 'SLA_D', // fallback
      poolConfig: WORKER_POOL_CONFIGS.SLA_D,
      queueDepth: executionQueue.length,
      reason: `UNKNOWN_SLA_TIER: ${slaTier}, fell back to SLA_D`,
    }
  }

  const config = WORKER_POOL_CONFIGS[tier]

  // 2. 计算实际可用 tier (考虑背压降级)
  const effectiveTier = resolveTierWithBackpressure(tier, backpressureTier)

  // 3. 检查队列深度
  const queueDepth = executionQueue.length
  const maxDepth = WORKER_POOL_CONFIGS[effectiveTier].maxQueueDepth
  if (queueDepth >= maxDepth) {
    // 队列过深 → 降级或拒绝
    const downgraded = downgradeTier(effectiveTier)
    if (!downgraded) {
      return {
        queued: false,
        slaTier: effectiveTier,
        poolConfig: WORKER_POOL_CONFIGS[effectiveTier],
        queueDepth,
        reason: `QUEUE_FULL: tier ${effectiveTier} queue depth ${queueDepth} >= max ${maxDepth}, no lower tier available`,
      }
    }
    // 用降级后的 tier 再试入队
    const downgradedConfig = WORKER_POOL_CONFIGS[downgraded]
    if (queueDepth < downgradedConfig.maxQueueDepth) {
      const task = executionQueue.enqueue({
        tenantId,
        slaTier: downgraded,
        dagId,
        input,
        seed,
      })
      return {
        queued: true,
        slaTier: downgraded,
        poolConfig: downgradedConfig,
        queueDepth: executionQueue.length,
        task,
        reason: `DOWNGRADED: ${effectiveTier}→${downgraded}`,
      }
    }
    return {
      queued: false,
      slaTier: effectiveTier,
      poolConfig: WORKER_POOL_CONFIGS[effectiveTier],
      queueDepth,
      reason: `QUEUE_FULL: no available tier`,
    }
  }

  // 4. 入队
  const task = executionQueue.enqueue({
    tenantId,
    slaTier: effectiveTier,
    dagId,
    input,
    seed,
  })

  return {
    queued: true,
    slaTier: effectiveTier,
    poolConfig: WORKER_POOL_CONFIGS[effectiveTier],
    queueDepth: executionQueue.length,
    task,
  }
}

/**
 * 解析 SLA tier 字符串
 */
function parseSLATier(s: string): SLATier | null {
  const upper = s.toUpperCase() as SLATier
  if (TIER_ORDER.includes(upper)) return upper
  return null
}

/**
 * 根据背压等级决定实际可用的 SLA tier
 * 
 * LIGHT → 不变
 * MODERATE → 如果当前是 SLA_D 则降级为不可用
 * HEAVY → SLA_C/D 不可执行
 * SATURATION → 仅 SLA_A
 */
function resolveTierWithBackpressure(tier: SLATier, backpressureTier: string): SLATier {
  switch (backpressureTier) {
    case 'SATURATION':
      return tier === 'SLA_A' ? tier : 'SLA_D' // 非 SLA_A 全降为 D (可能在后续 downgrade 中被拒绝)
    case 'HEAVY':
      return tier
    case 'MODERATE':
      return tier === 'SLA_D' ? 'SLA_C' : tier // SLA_D 提升到 C 以获得执行机会
    default:
      return tier
  }
}

/**
 * 降级 SLA tier (A→B→C→D→null)
 */
function downgradeTier(tier: SLATier): SLATier | null {
  const idx = TIER_ORDER.indexOf(tier)
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[idx + 1]
}
