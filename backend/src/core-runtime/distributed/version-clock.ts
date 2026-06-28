// ============================================================================
// 盘古斧 AI OS — Phase 8.3: Deterministic Version Clock (确定性版本时钟)
//
// 职责：
//   1. 为每个 dagId 维护单调递增版本号
//   2. 全局确定性：同一 dag 内版本号永不重复、永不回退
//   3. 用于 snapshot + journal 的版本匹配
// ============================================================================

/** per-dagId 版本号存储 */
const versionMap: Record<string, number> = {}

/**
 * 获取 dag 的下一个版本号（单调递增，从 1 开始）
 */
export function nextVersion(dagId: string): number {
  versionMap[dagId] = (versionMap[dagId] || 0) + 1
  return versionMap[dagId]
}

/**
 * 获取 dag 当前版本号（不递增）
 */
export function currentVersion(dagId: string): number {
  return versionMap[dagId] || 0
}

/**
 * 重置所有版本号
 */
export function resetVersions(): void {
  for (const key of Object.keys(versionMap)) {
    delete versionMap[key]
  }
}

/**
 * 获取所有 dar 的版本号快照
 */
export function getAllVersions(): Record<string, number> {
  return { ...versionMap }
}
