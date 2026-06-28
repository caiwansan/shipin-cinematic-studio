/**
 * P6 — Region（区域模型）
 *
 * 全球调度中的基本地理单元。
 * 每个 Region 包含一个或多个 Cluster。
 *
 * ═══ 宪法 ═══
 * 所有全球调度决策基于 Region 拓扑。
 * 禁止 region-agnostic 的全局路由。
 */

export interface Region {
  /** 区域 ID */
  id: string
  /** 区域名称 */
  name: string
  /** 地理位置标签 */
  location: string
  /** 延迟基准 */
  baseLatency: number
  /** 成本因子（1.0 = 基准）*/
  costFactor: number
  /** 状态 */
  status: 'active' | 'degraded' | 'offline'
  /** 包含的集群 ID */
  clusterIds: string[]
  /** 最后健康检查时间 */
  lastCheck: number
}

export function createRegion(id: string, name: string, location: string, baseLatency: number, costFactor: number = 1.0): Region {
  return {
    id,
    name,
    location,
    baseLatency,
    costFactor,
    status: 'active',
    clusterIds: [],
    lastCheck: Date.now(),
  }
}
