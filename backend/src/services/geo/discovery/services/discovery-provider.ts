// ============================================================
// DiscoveryProvider 接口 — 新旧引擎统一接口
// 支持 Feature Flag 切换
// ============================================================

import type { DiscoveryEnvelope } from '../../domain/discovery-envelope.js'

export interface DiscoveryProvider {
  /** 引擎标识 */
  readonly name: string

  /** 执行一次完整的品牌认知扫描 */
  discover(projectId: string, entityId: string, entityName: string): Promise<DiscoveryEnvelope>

  /** 健康检查 */
  health(): Promise<{ ok: boolean; latencyMs: number }>

  /** 能力声明 */
  capabilities(): string[]
}
