// ============================================================================
// 盘古斧 AI OS — Phase 8.2c: Concurrency Budget (租户并发预算)
//
// 职责：
//   1. 按 tenant 追踪当前活跃执行数
//   2. canExecute() 检查是否达到预算上限
//   3. acquireExecution() / releaseExecution() 计数增/减
//   4. 与 WorkerPool 协同：WorkerPool 管理全局 slot，此模块管理 per-tenant budget
// ============================================================================

/** 每个 tenant 的当前活跃执行数 */
const activeExecutions: Record<string, number> = {}

/**
 * 检查 tenant 是否可以开始一次新执行
 *
 * @param tenantId 租户 ID
 * @param budget   该 tenant 的并发预算上限
 * @returns true = 在预算内, 可以执行
 */
export function canAcquire(tenantId: string, budget: number): boolean {
  const current = activeExecutions[tenantId] || 0
  return current < budget
}

/**
 * 增加 tenant 的活跃执行计数
 * 调用前必须 canAcquire() 返回 true
 */
export function acquireExecution(tenantId: string): void {
  activeExecutions[tenantId] = (activeExecutions[tenantId] || 0) + 1
}

/**
 * 减少 tenant 的活跃执行计数
 * 在 execute 完成后 finally 块中调用
 */
export function releaseExecution(tenantId: string): void {
  activeExecutions[tenantId] = Math.max(0, (activeExecutions[tenantId] || 1) - 1)
}

/**
 * 获取 tenant 当前活跃执行数
 */
export function getActiveCount(tenantId: string): number {
  return activeExecutions[tenantId] || 0
}

/**
 * 获取所有租户的活跃执行概况
 */
export function getAllActiveCounts(): Record<string, number> {
  return { ...activeExecutions }
}

/**
 * 获取当前活跃租户总数
 */
export function getActiveTenantCount(): number {
  return Object.keys(activeExecutions).filter(k => activeExecutions[k] > 0).length
}
