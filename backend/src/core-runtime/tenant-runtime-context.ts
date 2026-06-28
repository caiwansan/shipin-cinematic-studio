// ============================================================================
// 盘古斧 AI OS — Phase 8.2c: Tenant Runtime Context (多租户执行物理层)
//
// 职责：
//   1. 为每个 tenant 定义独立的执行物理参数 (concurrency/memory/queue weight)
//   2. 根据 SLA tier 映射到对应的 isolation lane
//   3. 定义 tenant 的 degradation policy (熔断时如何降级)
//   4. 不存储运行时状态 — 纯配置映射
// ============================================================================

export type SLAVariant = 'SLA_A' | 'SLA_B' | 'SLA_C' | 'SLA_D'

/** 每个 tenant 的执行物理定义 */
export interface TenantRuntimeContext {
  tenantId: string
  slaTier: SLAVariant
  /** 最大并发执行数 */
  concurrencyBudget: number
  /** 内存预算 (MB) */
  memoryBudgetMB: number
  /** 队列调度权重 (越高优先级越高, fair scheduler 使用) */
  queueWeight: number
  /** 降级策略: minimal | moderate | aggressive | maximum */
  degradationPolicy: 'minimal' | 'moderate' | 'aggressive' | 'maximum'
  /** 隔离泳道 */
  isolationLane: 'lane_a' | 'lane_b' | 'lane_c' | 'lane_d'
  /** ═══ Phase 8.3: Distributed Runtime Context ═══ */
  distributed: {
    nodeId: string
    replayEnabled: boolean
    consistencyMode: 'DETERMINISTIC' | 'EVENTUAL' | 'NONE'
  }
}

/** 隔离泳道定义 */
export type IsolationLane = 'lane_a' | 'lane_b' | 'lane_c' | 'lane_d'

/**
 * 根据 SLA tier 创建 tenant runtime context
 *
 * SLA_A → 20 并发, 4GB, lane_a, minimal degradation
 * SLA_B → 10 并发, 2GB, lane_b, moderate degradation
 * SLA_C → 5 并发, 1GB, lane_c, aggressive degradation
 * SLA_D → 2 并发, 512MB, lane_d, maximum degradation
 */
export function createTenantRuntimeContext(
  tenantId: string,
  slaTier: string,
): TenantRuntimeContext {
  const nodeId = process.env.NODE_ID || 'node_default'
  switch (slaTier) {
    case 'SLA_A':
      return {
        tenantId,
        slaTier: 'SLA_A',
        concurrencyBudget: 20,
        memoryBudgetMB: 4096,
        queueWeight: 10,
        degradationPolicy: 'minimal',
        isolationLane: 'lane_a',
        distributed: { nodeId, replayEnabled: true, consistencyMode: 'DETERMINISTIC' },
      }
    case 'SLA_B':
      return {
        tenantId,
        slaTier: 'SLA_B',
        concurrencyBudget: 10,
        memoryBudgetMB: 2048,
        queueWeight: 6,
        degradationPolicy: 'moderate',
        isolationLane: 'lane_b',
        distributed: { nodeId, replayEnabled: true, consistencyMode: 'DETERMINISTIC' },
      }
    case 'SLA_C':
      return {
        tenantId,
        slaTier: 'SLA_C',
        concurrencyBudget: 5,
        memoryBudgetMB: 1024,
        queueWeight: 3,
        degradationPolicy: 'aggressive',
        isolationLane: 'lane_c',
        distributed: { nodeId, replayEnabled: true, consistencyMode: 'DETERMINISTIC' },
      }
    default:
      // SLA_D / unknown → 最低预算
      return {
        tenantId,
        slaTier: 'SLA_D',
        concurrencyBudget: 2,
        memoryBudgetMB: 512,
        queueWeight: 1,
        degradationPolicy: 'maximum',
        isolationLane: 'lane_d',
        distributed: { nodeId, replayEnabled: true, consistencyMode: 'EVENTUAL' },
      }
  }
}

/** 获取 tenant 的 degradationPolicy 映射到 system degradation mode */
export function tenantPolicyToDegradationMode(
  policy: TenantRuntimeContext['degradationPolicy'],
  systemDegradation: string,
): string {
  // minimal → 降级时尽量保留 FULL
  // moderate → 正常映射
  // aggressive → 跳到更严格的模式
  // maximum → 直接到 QUEUE_ONLY

  switch (policy) {
    case 'minimal':
      // 仅当 system 要求 REJECT 时才降级, 否则保持 FULL
      if (systemDegradation === 'REJECT') return 'QUEUE_ONLY'
      return 'FULL_DAG'
    case 'moderate':
      // 正常映射
      return systemDegradation
    case 'aggressive':
      // SAFE_MODE → SIMPLIFIED, REJECT → QUEUE_ONLY
      if (systemDegradation === 'SAFE_MODE') return 'SIMPLIFIED_DAG'
      if (systemDegradation === 'REJECT') return 'QUEUE_ONLY'
      return 'FULL_DAG'
    case 'maximum':
      // 只要 system 有任何降级信号（非 FULL_DAG）→ 直接 QUEUE_ONLY
      if (systemDegradation !== 'FULL_DAG') {
        return 'QUEUE_ONLY'
      }
      return 'FULL_DAG'
    default:
      return systemDegradation
  }
}
