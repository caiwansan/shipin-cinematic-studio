/**
 * P2 — Scheduler（调度器）
 *
 * 从 Queue 中取任务，分配到 Worker Pool。
 * 支持：priority / fairness / burst smoothing
 *
 * 第一版策略：roundRobinAcrossCapabilities + priority 排序
 */

import type { QueueJob } from '../queue/execution-queue.js'
import { Capability } from '../../runtime/capabilities.js'

export class Scheduler {
  private roundRobinIndex = 0
  private capabilitiesOrder: Capability[] = [
    Capability.SCRIPT_ANALYSIS,
    Capability.PROMPT_OPTIMIZATION,
    Capability.IMAGE_GENERATION,
    Capability.VIDEO_GENERATION,
    Capability.VOICE_GENERATION,
  ]

  /**
   * 调度任务：优先按 priority，然后 roundRobin
   */
  async dispatch(job: QueueJob): Promise<QueueJob> {
    // 第一版：直接透传，无额外调度逻辑
    // 后续扩展：priority sorting、fairness balancer、burst smoothing
    return job
  }

  /**
   * 按 capability 获取下一个应调度的任务类型（用于 Worker Polling）
   */
  nextCapability(): Capability {
    const cap = this.capabilitiesOrder[this.roundRobinIndex % this.capabilitiesOrder.length]
    this.roundRobinIndex++
    return cap
  }

  /**
   * 按 priority 排序任务（降序）
   */
  sortByPriority(jobs: QueueJob[]): QueueJob[] {
    return [...jobs].sort((a, b) => b.priority - a.priority)
  }
}
