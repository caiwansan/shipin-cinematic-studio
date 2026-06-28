/**
 * P5 — HeartbeatService（心跳监控服务）
 *
 * 定期检查集群所有节点的心跳状态，自动剔除超时节点。
 *
 * ═══ 宪法 ═══
 * 节点存活状态必须通过心跳维护。
 * 心跳超时的节点必须被标记为 dead，不接受新任务。
 */

import { nodeRegistry } from './node-registry.js'

export interface HeartbeatOptions {
  /** 心跳检测间隔（ms） */
  intervalMs: number
  /** 超时阈值（ms） */
  timeoutMs: number
}

class HeartbeatService {
  private timer: ReturnType<typeof setInterval> | null = null
  private options: HeartbeatOptions = {
    intervalMs: 2000,
    timeoutMs: 10000,
  }

  /**
   * 启动心跳检测
   */
  start(options?: Partial<HeartbeatOptions>): void {
    if (this.timer) {
      console.warn('[HeartbeatService] ⚠️ 心跳监控已在运行')
      return
    }

    if (options) {
      this.options = { ...this.options, ...options }
    }

    this.timer = setInterval(() => {
      nodeRegistry.checkHealth(this.options.timeoutMs)
      const summary = nodeRegistry.getSummary()
      console.log(`[HeartbeatService] 💓 集群状态: ${summary.alive} alive / ${summary.degraded} degraded / ${summary.dead} dead (负载 ${(summary.avgLoad * 100).toFixed(1)}%)`)
    }, this.options.intervalMs)

    console.log(`[HeartbeatService] ✅ 心跳监控已启动 (间隔 ${this.options.intervalMs}ms, 超时 ${this.options.timeoutMs}ms)`)
  }

  /**
   * 停止心跳检测
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[HeartbeatService] ⏹️ 心跳监控已停止')
    }
  }

  /**
   * 节点上报心跳
   */
  reportHeartbeat(nodeId: string, load: number, activeTasks: number): boolean {
    const node = nodeRegistry.get(nodeId)
    if (!node) {
      console.warn(`[HeartbeatService] ⚠️ 未知节点 "${nodeId.substring(0, 8)}" 上报心跳`)
      return false
    }

    nodeRegistry.updateLoad(nodeId, load, activeTasks)
    return true
  }

  /**
   * 获取当前配置
   */
  getOptions(): HeartbeatOptions {
    return { ...this.options }
  }
}

export const heartbeatService = new HeartbeatService()
