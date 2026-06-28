/**
 * P6 — CostBasedRouter（成本感知路由）
 *
 * 根据各区域/provider 的成本因子进行路由决策。
 * 配合 LatencyRouter 做均衡调度。
 */

import { regionRouter } from './region-router.js'

export interface CostProfile {
  regionId: string
  llmCost: number    // per 1k tokens
  imageCost: number  // per image
  videoCost: number  // per video
  storageCost: number // per GB
}

class CostBasedRouter {
  private profiles: Map<string, CostProfile> = new Map()

  constructor() {
    this.registerDefaults()
  }

  register(regionId: string, profile: CostProfile): void {
    this.profiles.set(regionId, profile)
  }

  getBestRegionByCost(): string {
    let bestId = ''
    let lowestCost = Infinity

    for (const [, profile] of this.profiles) {
      const total = profile.llmCost + profile.imageCost + profile.videoCost
      if (total < lowestCost) {
        lowestCost = total
        bestId = profile.regionId
      }
    }

    return bestId
  }

  private registerDefaults(): void {
    this.register('cn-beijing', { regionId: 'cn-beijing', llmCost: 0.8, imageCost: 1.0, videoCost: 1.2, storageCost: 0.5 })
    this.register('cn-shanghai', { regionId: 'cn-shanghai', llmCost: 1.0, imageCost: 1.0, videoCost: 1.0, storageCost: 0.6 })
    this.register('cn-shenzhen', { regionId: 'cn-shenzhen', llmCost: 0.9, imageCost: 1.1, videoCost: 1.3, storageCost: 0.5 })
    this.register('ap-southeast-1', { regionId: 'ap-southeast-1', llmCost: 1.5, imageCost: 1.8, videoCost: 2.0, storageCost: 1.0 })
    this.register('us-west-1', { regionId: 'us-west-1', llmCost: 2.0, imageCost: 2.5, videoCost: 3.0, storageCost: 1.5 })
  }
}

export const costBasedRouter = new CostBasedRouter()
