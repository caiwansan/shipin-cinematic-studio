/**
 * P5 — DistributedScheduler（分布式调度器）
 *
 * 替代 P4 的 stub，基于 ClusterManager 实现真正的跨节点任务调度。
 * 支持：
 *  - 负载均衡调度
 *  - 节点故障自动转派
 *  - Capability 感知调度
 *
 * ═══ 宪法 ═══
 * 所有通过 P5 分发的任务必须经过 DistributedScheduler。
 * 分布式调度器不经由 local ControlPlane，而是通过集群节点分发。
 */

import crypto from 'crypto'
import { clusterManager } from './cluster-manager.js'
import { nodeRegistry } from './node-registry.js'
import { Capability } from '../runtime/capabilities.js'
import { executionCutover } from '../control-plane/cutover/execution-cutover.js'

export interface ScheduledTask {
  taskId: string
  capability: Capability
  payload: any
  userId: string
  priority: number
  scheduledAt: number
  nodeId: string
}

class DistributedScheduler {
  private scheduled: Map<string, ScheduledTask> = new Map()

  /**
   * 调度任务执行
   * 自动选择最佳节点并分发
   */
  async schedule(capability: Capability, payload: any, userId: string): Promise<any> {
    const taskId = `task-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

    // 通过 ClusterManager 选择节点
    const result = await clusterManager.dispatchTask({
      taskId,
      capability,
      payload,
      userId,
    })

    if (!result.success) {
      throw new Error(`[DistributedScheduler] ❌ 调度失败: ${result.message}`)
    }

    // 记录调度信息
    this.scheduled.set(taskId, {
      taskId,
      capability,
      payload,
      userId,
      priority: 0,
      scheduledAt: Date.now(),
      nodeId: result.nodeId,
    })

    // 如果调度到本机，直接本地执行
    const node = nodeRegistry.get(result.nodeId)
    if (node && node.host === 'localhost') {
      console.log(`[DistributedScheduler] 🖥️ 本地执行: ${taskId.substring(0, 8)}`)
      return executionCutover.execute({ capability, userId, payload })
    }

    return {
      success: true,
      taskId,
      nodeId: result.nodeId,
      message: result.message,
    }
  }

  /**
   * 获取调度记录
   */
  getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduled.values())
  }
}

export const distributedScheduler = new DistributedScheduler()
