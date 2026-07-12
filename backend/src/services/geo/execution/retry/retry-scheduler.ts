// ===================================================
// RetryScheduler — RC2-2
// 管理重试时间和次数，生成 ExecutionEvent
// ===================================================

import type { RetryPolicy, RetryConfig } from './retry-policy'
import { createExecutionEvent } from '../event' // RC1
import type { ExecutionEvent } from '../types'

export interface RetrySchedule {
  shouldRetry: boolean
  nextDelayMs: number
  finalAttempt: boolean
  events: ExecutionEvent[]
}

export class RetryScheduler {
  constructor(private policy: RetryPolicy) {}

  /**
   * 评估是否需要重试
   * @param attempt — 已经尝试的次数（0-based）
   * @param error — 失败的异常
   * @param config — 重试配置
   * @param executionId — 执行 ID（用于生成事件）
   * @param graphId — 图 ID（用于生成事件）
   * @param nodeId — 节点 ID（用于生成事件）
   */
  async evaluate(
    attempt: number,
    error: Error,
    config: RetryConfig,
    executionId: string,
    graphId: string,
    nodeId: string,
  ): Promise<RetrySchedule> {
    const events: ExecutionEvent[] = []
    const shouldRetry = this.policy.shouldRetry(attempt, error, config)

    if (shouldRetry) {
      const nextDelayMs = await this.policy.nextDelay(attempt, config)
      const finalAttempt = (attempt + 1) >= config.maxRetries

      // 创建 node_retry 事件
      events.push(createExecutionEvent({
        executionId,
        graphId,
        type: 'node_retry',
        nodeId,
        data: {
          attempt,
          maxRetries: config.maxRetries,
          nextDelayMs,
          finalAttempt,
          error: error.message,
        },
      }))

      return { shouldRetry: true, nextDelayMs, finalAttempt, events }
    }

    return { shouldRetry: false, nextDelayMs: 0, finalAttempt: true, events }
  }
}
