/**
 * P6 — LatencyRouter（延迟感知路由）
 *
 * 基于用户地理位置和区域延迟优化路由决策。
 * 为 GlobalScheduler 提供延迟维度的路由建议。
 */

import { regionRouter } from './region-router.js'

export interface LatencyProfile {
  userLocation: string
  regionLatencies: Array<{ regionId: string; latency: number }>
}

class LatencyRouter {
  private profiles: Map<string, LatencyProfile> = new Map()

  /**
   * 注册延迟配置
   */
  registerProfile(profile: LatencyProfile): void {
    this.profiles.set(profile.userLocation, profile)
  }

  /**
   * 获取距离用户最近的区域
   */
  getBestRegionByLatency(userLocation: string): string | null {
    const profile = this.profiles.get(userLocation)
    if (!profile) return null

    profile.regionLatencies.sort((a, b) => a.latency - b.latency)
    return profile.regionLatencies[0]?.regionId || null
  }

  /**
   * 注册默认延迟数据
   */
  registerDefaults(): void {
    this.registerProfile({
      userLocation: 'beijing',
      regionLatencies: [
        { regionId: 'cn-beijing', latency: 5 },
        { regionId: 'cn-shanghai', latency: 30 },
        { regionId: 'cn-shenzhen', latency: 50 },
        { regionId: 'ap-southeast-1', latency: 100 },
        { regionId: 'us-west-1', latency: 200 },
      ],
    })
    this.registerProfile({
      userLocation: 'shanghai',
      regionLatencies: [
        { regionId: 'cn-shanghai', latency: 5 },
        { regionId: 'cn-beijing', latency: 30 },
        { regionId: 'cn-shenzhen', latency: 40 },
        { regionId: 'ap-southeast-1', latency: 80 },
        { regionId: 'us-west-1', latency: 190 },
      ],
    })
    this.registerProfile({
      userLocation: 'singapore',
      regionLatencies: [
        { regionId: 'ap-southeast-1', latency: 5 },
        { regionId: 'cn-shenzhen', latency: 60 },
        { regionId: 'cn-shanghai', latency: 80 },
        { regionId: 'cn-beijing', latency: 100 },
        { regionId: 'us-west-1', latency: 180 },
      ],
    })
  }
}

export const latencyRouter = new LatencyRouter()
