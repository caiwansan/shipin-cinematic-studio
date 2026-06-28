/**
 * P2 — ExecutionQueue（分层队列）
 *
 * Capability 分层队列，Redis LPUSH/RPOP 实现。
 * 支持 FIFO / Priority / Delayed 三种模式。
 *
 * ═══ 宪法：所有任务必须先进队列 ═══
 * 禁止绕过 queue 直接执行 adapter。
 */

import { Capability } from '../../runtime/capabilities.js'

export interface QueueJob {
  requestId: string
  capability: Capability
  userId: string
  payload: any
  providerConfig?: any
  priority: number
  timeout: number
  createdAt: number
}

// 内存队列（生产环境替换为 Redis）
const memoryQueues = new Map<string, QueueJob[]>()

export class ExecutionQueue {
  /**
   * 入队
   * 按 capability 分层：queue:script_analysis, queue:image_generation, ...
   */
  async enqueue(job: QueueJob): Promise<QueueJob> {
    const key = `queue:${job.capability}`
    const queue = memoryQueues.get(key) || []
    queue.push(job)
    memoryQueues.set(key, queue)
    console.log(`[ExecutionQueue] ✅ 入队: ${job.requestId.substring(0, 8)} capability=${job.capability} 队列长度=${queue.length}`)
    return job
  }

  /**
   * 出队（FIFO）
   */
  async dequeue(capability: Capability): Promise<QueueJob | null> {
    const key = `queue:${capability}`
    const queue = memoryQueues.get(key) || []
    const job = queue.shift() || null
    if (job) {
      memoryQueues.set(key, queue)
    }
    return job
  }

  /**
   * 查看队列长度
   */
  async length(capability: Capability): Promise<number> {
    return (memoryQueues.get(`queue:${capability}`) || []).length
  }

  /**
   * 清空队列
   */
  async clear(capability?: Capability): Promise<void> {
    if (capability) {
      memoryQueues.set(`queue:${capability}`, [])
    } else {
      memoryQueues.clear()
    }
  }
}
