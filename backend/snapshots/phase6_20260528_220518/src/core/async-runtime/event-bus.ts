/**
 * P4 — EventBus（事件总线）
 *
 * 异步执行架构的通信核心。
 * 基于内存事件流（生产环境替换为 Redis Stream）。
 *
 * ═══ 宪法 ═══
 * EventBus 是 P4 异步执行的心脏。
 * 所有 Agent Node 的状态变化必须通过 EventBus 传递。
 * 禁止绕过 EventBus 直接写状态。
 */

import { ExecutionEvent, ExecutionEventType, createExecutionEvent } from './events/execution-event.js'

type EventHandler = (event: ExecutionEvent) => void | Promise<void>

class EventBus {
  /** 订阅者列表 */
  private subscribers: Array<{
    filter?: (event: ExecutionEvent) => boolean
    handler: EventHandler
  }> = []
  /** 事件历史（用于 replay） */
  private eventLog: ExecutionEvent[] = []
  /** 最大历史记录数 */
  private maxLogSize = 10000

  /**
   * 发布事件
   */
  async emit(event: ExecutionEvent): Promise<void> {
    this.eventLog.push(event)
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift()
    }

    const promises = this.subscribers
      .filter(s => !s.filter || s.filter(event))
      .map(s => s.handler(event))

    await Promise.all(promises)
  }

  /**
   * 发布简化事件
   */
  async emitSimple(
    type: ExecutionEvent['type'],
    graphId: string,
    overrides?: Partial<ExecutionEvent>,
  ): Promise<void> {
    return this.emit(createExecutionEvent(type, graphId, overrides))
  }

  /**
   * 订阅事件
   */
  subscribe(handler: EventHandler, filter?: (event: ExecutionEvent) => boolean): () => void {
    const entry = { filter, handler }
    this.subscribers.push(entry)
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== entry)
    }
  }

  /**
   * 按类型订阅
   */
  on(type: ExecutionEventType, handler: EventHandler): () => void {
    return this.subscribe(handler, event => event.type === type)
  }

  /**
   * 获取事件日志（用于 replay）
   */
  getEventLog(): ExecutionEvent[] {
    return [...this.eventLog]
  }
}

export const eventBus = new EventBus()
