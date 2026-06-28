/**
 * P6 — GlobalScheduler（全球调度器）
 *
 * 最顶层的调度决策器：Region → Cluster → Node.
 * 结合 RegionRouter + ClusterManager 做多层级路由。
 *
 * ═══ 宪法 ═══
 * 全球调度是三级路由：Region → Cluster → Node。
 * 禁止跳过 GlobalScheduler 直接调度到集群。
 */

import { Capability } from '../runtime/capabilities.js'
import { regionRouter, RouteRequest } from './region-router.js'
import { executionCutover } from '../control-plane/cutover/execution-cutover.js'

export interface GlobalScheduleRequest {
  capability: Capability
  payload: any
  userId: string
  preferLowLatency?: boolean
  preferLowCost?: boolean
  preferredRegion?: string
}

class GlobalScheduler {
  /**
   * 执行全球调度
   */
  async schedule(request: GlobalScheduleRequest): Promise<any> {
    const routeRequest: RouteRequest = {
      capability: request.capability,
      userId: request.userId,
      preferLowLatency: request.preferLowLatency,
      preferLowCost: request.preferLowCost,
      preferredRegion: request.preferredRegion,
    }

    // 1. 选择最优区域
    const decision = regionRouter.selectRegion(routeRequest)

    console.log(`[GlobalScheduler] 🌍 路由到区域 "${decision.regionName}" (评分: ${decision.score.toFixed(2)}, 延迟: ${decision.factors.latency}ms, 成本: ${decision.factors.cost})`)

    // 2. 在本机 ControlPlane 执行（实际应通过 Cluster Federation 转发给目标区域集群）
    return executionCutover.execute({
      capability: request.capability,
      userId: request.userId,
      payload: request.payload,
    })
  }
}

export const globalScheduler = new GlobalScheduler()
