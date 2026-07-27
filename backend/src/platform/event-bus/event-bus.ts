// Re-export from event-bus module (compatibility alias for @platform/events/event-bus)
export { platformEventBus, eventBus } from './index.js'
export type { IEventBus } from './types.js'

export type { EventBus, DomainEvent, EventHandler, EventSubscription } from '../event-bus/types.js'

// InMemoryEventBus: 内存事件总线实现
export class InMemoryEventBus {
  private handlers = new Map<string, Array<(event: any) => void>>()

  async publish(event: { type: string; source: string; payload: any }): Promise<void> {
    const handlers = this.handlers.get(event.type) || []
    for (const handler of handlers) {
      await handler(event)
    }
  }

  subscribe(eventType: string, handler: (event: any) => void): string {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, [])
    this.handlers.get(eventType)!.push(handler)
    return `sub_${Date.now()}`
  }

  unsubscribe(_id: string): void {}
  listSubscriptions(): any[] { return [] }
}
