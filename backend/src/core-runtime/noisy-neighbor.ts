// ============================================================================
// 盘古斧 AI OS — Phase 8.2c: Noisy Neighbor Protection (嘈杂邻居抑制)
//
// 职责：
//   1. 检测是否有 tenant 占用过多系统资源
//   2. 判定阈值: 队列深度 > 1000 或 失败率 > 40%
//   3. 被标记为 noisy 的 tenant 自动限制并发预算
// ============================================================================

/** 检测到的嘈杂邻居记录 */
export interface NoisyTenantRecord {
  tenantId: string
  queueSize: number
  failureRate: number
  detectedAt: number
}

/** 嘈杂邻居检测阈值 */
const QUEUE_SIZE_WARN = 200
const QUEUE_SIZE_THRESHOLD = 1000
const FAILURE_RATE_THRESHOLD = 0.4

/** 当前被标记为 noisy 的 tenant */
const noisyTenants: Map<string, NoisyTenantRecord> = new Map()

/** noisy 标记过期时间 (ms) */
const NOISY_EXPIRY_MS = 60_000

/**
 * 检测 tenant 是否为 noisy neighbor
 *
 * @param tenantId   租户 ID
 * @param queueSize  该 tenant 的队列深度
 * @param failureRate 该 tenant 的失败率 (0-1)
 * @returns true = 检测到嘈杂行为
 */
export function detectNoisyTenant(
  tenantId: string,
  queueSize: number,
  failureRate: number,
): boolean {
  if (queueSize > QUEUE_SIZE_THRESHOLD) {
    noisyTenants.set(tenantId, {
      tenantId,
      queueSize,
      failureRate,
      detectedAt: Date.now(),
    })
    return true
  }

  if (failureRate > FAILURE_RATE_THRESHOLD) {
    noisyTenants.set(tenantId, {
      tenantId,
      queueSize,
      failureRate,
      detectedAt: Date.now(),
    })
    return true
  }

  // 检查是否已过期
  const existing = noisyTenants.get(tenantId)
  if (existing && Date.now() - existing.detectedAt > NOISY_EXPIRY_MS) {
    noisyTenants.delete(tenantId)
  }

  return false
}

/**
 * 检查 tenant 是否在当前嘈杂邻居列表中
 */
export function isNoisy(tenantId: string): boolean {
  const record = noisyTenants.get(tenantId)
  if (!record) return false
  if (Date.now() - record.detectedAt > NOISY_EXPIRY_MS) {
    noisyTenants.delete(tenantId)
    return false
  }
  return true
}

/**
 * 获取所有被检测到的嘈杂邻居
 */
export function getNoisyTenants(): NoisyTenantRecord[] {
  const now = Date.now()
  const result: NoisyTenantRecord[] = []
  for (const [id, record] of noisyTenants) {
    if (now - record.detectedAt > NOISY_EXPIRY_MS) {
      noisyTenants.delete(id)
    } else {
      result.push(record)
    }
  }
  return result
}

/**
 * 手动将 tenant 从嘈杂列表中移除
 */
export function clearNoisyFlag(tenantId: string): void {
  noisyTenants.delete(tenantId)
}

/** 队列深度警告阈值 — 用于提前预警 */
export function isQueueDepthWarning(queueSize: number): boolean {
  return queueSize > QUEUE_SIZE_WARN
}

export { QUEUE_SIZE_THRESHOLD, FAILURE_RATE_THRESHOLD }
