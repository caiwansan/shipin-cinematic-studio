// ============================================================
// RC3-2 — AllocationStrategy 接口
// ============================================================
// 策略模式：ResourceAllocator 通过策略接口选择最优资源。
// 当前实现基于 Provider，但接口保持抽象，未来支持任意资源类型。

import type { ProviderRegistration } from '../../provider/types'
import type { ProviderHealth } from '../../provider/provider-health'
import type { ExecutionNode } from '../../types'

export interface AllocationContext {
  node: ExecutionNode
  candidates: ProviderRegistration[]
  healthMap: Map<string, ProviderHealth>
  policy: string
}

export interface IAllocationStrategy {
  name: string
  /** 从候选 Provider 中选择最优的 */
  allocate(context: AllocationContext): Promise<{
    provider: string
    priority: number
    reason: string
  } | null>
}
