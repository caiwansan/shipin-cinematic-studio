/**
 * P6 — RegionRouter（区域路由）
 *
 * 根据延迟、成本、负载选择最优区域。
 *
 * ═══ 宪法 ═══
 * 路由决策必须考虑多维度（延迟、成本、负载）。
 * 禁止单维度路由。
 */

import type { Region } from './region.js'
import { Capability } from '../runtime/capabilities.js'

export interface RoutingDecision {
  regionId: string
  regionName: string
  score: number
  factors: {
    latency: number
    cost: number
    load: number
  }
}

export interface RouteRequest {
  capability: Capability
  userId?: string
  preferLowLatency?: boolean
  preferLowCost?: boolean
  preferredRegion?: string
  userLocation?: string
}

class RegionRouter {
  private regions: Map<string, Region> = new Map()

  constructor() {
    this.registerDefaultRegions()
  }

  /**
   * 注册区域
   */
  register(region: Region): void {
    this.regions.set(region.id, region)
  }

  /**
   * 获取最优区域
   */
  selectRegion(request: RouteRequest): RoutingDecision {
    const active = Array.from(this.regions.values()).filter(r => r.status === 'active')

    if (active.length === 0) {
      throw new Error('[RegionRouter] 无可用区域')
    }

    // 如果指定了首选区域
    if (request.preferredRegion && active.some(r => r.id === request.preferredRegion)) {
      const region = active.find(r => r.id === request.preferredRegion)!
      return {
        regionId: region.id,
        regionName: region.name,
        score: 1.0,
        factors: { latency: region.baseLatency, cost: region.costFactor, load: 0 },
      }
    }

    // 多维度评分
    const scored = active.map(region => {
      const latencyScore = request.preferLowLatency ? 1 / (region.baseLatency + 1) : 1
      const costScore = request.preferLowCost ? 1 / (region.costFactor + 0.1) : 1
      const totalScore = latencyScore * 0.4 + costScore * 0.3 + 0.3 // default 0.3 for load

      return {
        region,
        score: totalScore,
        factors: { latency: region.baseLatency, cost: region.costFactor, load: 0 },
      }
    })

    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    return {
      regionId: best.region.id,
      regionName: best.region.name,
      score: best.score,
      factors: best.factors,
    }
  }

  /**
   * 获取所有区域
   */
  listRegions(): Region[] {
    return Array.from(this.regions.values())
  }

  /**
   * 更新区域状态
   */
  updateStatus(regionId: string, status: Region['status']): void {
    const region = this.regions.get(regionId)
    if (region) {
      region.status = status
      region.lastCheck = Date.now()
    }
  }

  /**
   * 注册默认区域
   */
  private registerDefaultRegions(): void {
    this.register({
      id: 'cn-beijing',
      name: '华北-北京',
      location: 'beijing',
      baseLatency: 20,
      costFactor: 0.8,
      status: 'active',
      clusterIds: [],
      lastCheck: Date.now(),
    })
    this.register({
      id: 'cn-shanghai',
      name: '华东-上海',
      location: 'shanghai',
      baseLatency: 15,
      costFactor: 1.0,
      status: 'active',
      clusterIds: [],
      lastCheck: Date.now(),
    })
    this.register({
      id: 'cn-shenzhen',
      name: '华南-深圳',
      location: 'shenzhen',
      baseLatency: 25,
      costFactor: 0.9,
      status: 'active',
      clusterIds: [],
      lastCheck: Date.now(),
    })
    this.register({
      id: 'ap-southeast-1',
      name: '新加坡',
      location: 'singapore',
      baseLatency: 60,
      costFactor: 1.5,
      status: 'active',
      clusterIds: [],
      lastCheck: Date.now(),
    })
    this.register({
      id: 'us-west-1',
      name: '美西-硅谷',
      location: 'us-west',
      baseLatency: 180,
      costFactor: 2.0,
      status: 'active',
      clusterIds: [],
      lastCheck: Date.now(),
    })
  }
}

export const regionRouter = new RegionRouter()
